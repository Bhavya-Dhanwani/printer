// Importing modules
import { Queue, Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";
import DocumentDao from "../dao/document.dao.js";
import PrintJobDao from "../dao/printJob.dao.js";
import PrinterDao from "../dao/printer.dao.js";
import PrintJobEventDao from "../dao/printJobEvent.dao.js";
import documentProcessingService from "./documentProcessing.service.js";
import storageService from "./storage.service.js";
import socketService from "./socket.service.js";

class QueueService {
    redisConnection: Redis | null = null;
    documentQueue: Queue | null = null;
    printDispatchQueue: Queue | null = null;
    cleanupQueue: Queue | null = null;

    documentWorker: Worker | null = null;
    printDispatchWorker: Worker | null = null;
    cleanupWorker: Worker | null = null;

    documentDao: DocumentDao;
    printJobDao: PrintJobDao;
    printerDao: PrinterDao;
    eventDao: PrintJobEventDao;

    constructor() {
        this.documentDao = new DocumentDao();
        this.printJobDao = new PrintJobDao();
        this.printerDao = new PrinterDao();
        this.eventDao = new PrintJobEventDao();

        this.initRedisAndQueues();
    }

    private initRedisAndQueues(): void {
        try {
            this.redisConnection = new Redis(env.REDIS_URL, {
                maxRetriesPerRequest: null,
                retryStrategy: (times) => {
                    if (times > 3) {
                        logger.warn("Redis connection failing, backoff retrying...");
                        return Math.min(times * 1000, 10000);
                    }
                    return 1000;
                },
                lazyConnect: true,
            });

            this.redisConnection.on("error", (err) => {
                logger.warn({ error: err?.message }, "Redis connection error");
            });

            const connection = this.redisConnection;

            this.documentQueue = new Queue("document-processing", { connection });
            this.printDispatchQueue = new Queue("print-dispatch", { connection });
            this.cleanupQueue = new Queue("file-cleanup", { connection });

            this.initWorkers(connection);
        } catch (error: any) {
            logger.error({ error: error?.message }, "Failed to initialize BullMQ queues");
        }
    }

    private initWorkers(connection: Redis): void {
        // Document Processing Worker
        this.documentWorker = new Worker(
            "document-processing",
            async (job: Job<{ documentId: string }>) => {
                const { documentId } = job.data;
                await this.processDocumentJob(documentId);
            },
            {
                connection,
                concurrency: env.MAX_CONCURRENT_CONVERSIONS,
            }
        );

        this.documentWorker.on("failed", async (job, err) => {
            logger.error({ jobId: job?.id, error: err?.message }, "Document processing job failed");
        });

        // Print Dispatch Worker
        this.printDispatchWorker = new Worker(
            "print-dispatch",
            async (job: Job<{ printJobId: string }>) => {
                const { printJobId } = job.data;
                await this.processPrintDispatchJob(printJobId);
            },
            {
                connection,
                concurrency: env.MAX_CONCURRENT_PRINT_JOBS,
            }
        );

        // Cleanup Worker
        this.cleanupWorker = new Worker(
            "file-cleanup",
            async () => {
                await this.processCleanupJob();
            },
            {
                connection,
                concurrency: 1,
            }
        );
    }

    async enqueueDocumentProcessing(documentId: string): Promise<void> {
        try {
            if (this.documentQueue) {
                await this.documentQueue.add(
                    "process-doc",
                    { documentId },
                    {
                        attempts: 2,
                        backoff: { type: "exponential", delay: 2000 },
                        removeOnComplete: true,
                    }
                );
            } else {
                // If Redis queue is offline, execute synchronously or asynchronously in background
                setImmediate(() => this.processDocumentJob(documentId));
            }
        } catch (err) {
            logger.warn({ err }, "Redis unavailable, falling back to direct asynchronous document processing");
            setImmediate(() => this.processDocumentJob(documentId));
        }
    }

    async enqueuePrintDispatch(printJobId: string): Promise<void> {
        try {
            if (this.printDispatchQueue) {
                await this.printDispatchQueue.add(
                    "dispatch-job",
                    { printJobId },
                    {
                        attempts: 3,
                        backoff: { type: "exponential", delay: 3000 },
                        removeOnComplete: true,
                    }
                );
            } else {
                setImmediate(() => this.processPrintDispatchJob(printJobId));
            }
        } catch (err) {
            logger.warn({ err }, "Redis unavailable, falling back to direct asynchronous print dispatch");
            setImmediate(() => this.processPrintDispatchJob(printJobId));
        }
    }

    async processDocumentJob(documentId: string): Promise<void> {
        const doc = await this.documentDao.findById(documentId);
        if (!doc) {
            logger.warn({ documentId }, "Document not found for processing");
            return;
        }

        try {
            await this.documentDao.updateById(documentId, { status: "PROCESSING" });

            const ext = doc.extension.toLowerCase();
            const originalPath = doc.originalPath;

            // Validate file signature
            const signatureResult = await documentProcessingService.validateFileSignature(originalPath, ext);
            if (!signatureResult.isSupported || !signatureResult.isValid) {
                throw new Error(`Invalid or unsupported file format signature: ${signatureResult.detectedMimeType}`);
            }

            const processedDir = storageService.getDocumentProcessedDir(documentId);
            const targetPdfPath = path.join(processedDir, "processed.pdf");

            if (ext === ".pdf") {
                await fs.promises.copyFile(originalPath, targetPdfPath);
            } else if (ext === ".jpg" || ext === ".jpeg" || ext === ".png") {
                await documentProcessingService.convertImageToPdf(originalPath, targetPdfPath);
            } else if (ext === ".txt") {
                await documentProcessingService.convertTextToPdf(originalPath, targetPdfPath);
            } else {
                // Office documents: doc, docx, ppt, pptx, xls, xlsx, odt, odp, ods
                await documentProcessingService.convertOfficeToPdf(originalPath, processedDir, "processed.pdf");
            }

            // Analyze PDF
            const analysis = await documentProcessingService.analyzePdf(targetPdfPath);
            if (!analysis.isValid) {
                throw new Error("Generated PDF could not be parsed or is corrupted.");
            }

            if (analysis.isEncrypted) {
                throw new Error("Password-protected or encrypted PDFs are not supported.");
            }

            if (analysis.pageCount > env.MAX_DOCUMENT_PAGES) {
                throw new Error(`Document exceeds maximum limit of ${env.MAX_DOCUMENT_PAGES} pages (found ${analysis.pageCount}).`);
            }

            await this.documentDao.updateById(documentId, {
                status: "READY",
                processedPath: targetPdfPath,
                detectedMimeType: signatureResult.detectedMimeType,
                pageCount: analysis.pageCount,
                pageDimensions: analysis.pageDimensions,
            });

            logger.info({ documentId, pageCount: analysis.pageCount }, "Document processing completed successfully");
        } catch (error: any) {
            logger.error({ documentId, error: error?.message }, "Document processing failed");
            await this.documentDao.updateById(documentId, {
                status: "PROCESSING_FAILED",
                processingError: error?.message || "Document processing failed",
            });
        }
    }

    async processPrintDispatchJob(printJobId: string): Promise<void> {
        const job = await this.printJobDao.findById(printJobId);
        if (!job) return;

        if (job.paymentStatus !== "SUCCESS") {
            logger.warn({ printJobId }, "Cannot dispatch unpaid print job");
            return;
        }

        try {
            await this.printJobDao.updateById(printJobId, { printStatus: "DISPATCHING" });

            const doc = await this.documentDao.findById(job.documentId.toString());
            if (!doc || doc.status !== "READY" || !doc.processedPath) {
                throw new Error("Document is not in READY state or processed PDF is missing");
            }

            // Generate print-ready PDF containing selected pages
            const printJobDir = storageService.getPrintJobDir(printJobId);
            const printReadyPdfPath = path.join(printJobDir, "print-ready.pdf");

            await documentProcessingService.extractSelectedPages(
                doc.processedPath,
                printReadyPdfPath,
                job.settings.selectedPages
            );

            // Compute SHA-256 checksum
            const fileBuffer = await fs.promises.readFile(printReadyPdfPath);
            const checksum = crypto.createHash("sha256").update(fileBuffer).digest("hex");

            await this.printJobDao.updateById(printJobId, {
                printReadyPath: printReadyPdfPath,
                checksumSha256: checksum,
                dispatchAttempts: (job.dispatchAttempts || 0) + 1,
            });

            // Find target printer & agent
            let printer = null;
            if (job.printerId) {
                printer = await this.printerDao.findById(job.printerId.toString());
            }

            const agentId = printer?.agentId?._id?.toString() || printer?.agentId?.toString();

            if (agentId && socketService.isAgentConnected(agentId)) {
                const downloadUrl = `/api/documents/${doc._id}/content`;
                const dispatched = await socketService.dispatchJobToAgent(agentId, {
                    jobId: printJobId,
                    printerId: printer?._id.toString() || "",
                    printerName: printer?.name || "Default Printer",
                    downloadUrl,
                    checksumSha256: checksum,
                    settings: job.settings,
                });

                if (dispatched) {
                    await this.printJobDao.updateById(printJobId, {
                        printStatus: "QUEUED",
                        agentId: agentId as any,
                    });

                    await this.eventDao.logEvent({
                        printJobId,
                        event: "JOB_DISPATCHED",
                        previousStatus: "DISPATCHING",
                        newStatus: "QUEUED",
                        message: `Print job dispatched to agent ${agentId}`,
                        agentId,
                    });
                }
            } else {
                logger.warn({ printJobId, agentId }, "Printer agent is currently offline. Job queued for recovery.");
                await this.printJobDao.updateById(printJobId, { printStatus: "QUEUED" });
            }
        } catch (error: any) {
            logger.error({ printJobId, error: error?.message }, "Print dispatch job failed");
            await this.printJobDao.updateById(printJobId, { printStatus: "FAILED" });
            await this.eventDao.logEvent({
                printJobId,
                event: "DISPATCH_FAILED",
                previousStatus: "DISPATCHING",
                newStatus: "FAILED",
                message: error?.message || "Print dispatch failed",
            });
        }
    }

    async processCleanupJob(): Promise<void> {
        try {
            // 1. Expired documents cleanup
            const now = new Date();
            const expiredDocs = await this.documentDao.findExpiredDocuments(now);

            for (const doc of expiredDocs) {
                const docId = doc._id.toString();
                // Check if document has active print jobs
                const activeJobs = await this.printJobDao.findActiveJobsByDocumentId(docId);
                if (activeJobs.length > 0) {
                    // Do not delete while there are active print jobs
                    continue;
                }

                // Delete temp, original, and processed directories
                await storageService.deleteDirectory(storageService.getDocumentTempDir(docId));
                await storageService.deleteDirectory(storageService.getDocumentOriginalDir(docId));
                await storageService.deleteDirectory(storageService.getDocumentProcessedDir(docId));

                await this.documentDao.updateById(docId, { status: "DELETED" });
                logger.info({ documentId: docId }, "Cleaned up expired document files");
            }

            // 2. Completed / Failed print jobs older than COMPLETED_JOB_RETENTION_MINUTES
            const cutoffDate = new Date(Date.now() - env.COMPLETED_JOB_RETENTION_MINUTES * 60 * 1000);
            const finishedJobs = await this.printJobDao.findCompletedJobsForCleanup(cutoffDate);

            for (const job of finishedJobs) {
                const jobId = job._id.toString();
                await storageService.deleteDirectory(storageService.getPrintJobDir(jobId));
            }
        } catch (error: any) {
            logger.error({ error: error?.message }, "Cleanup worker failed");
        }
    }
}

export const queueService = new QueueService();
