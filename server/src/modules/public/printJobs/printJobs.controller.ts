// Importing modules
import { Response } from "express";
import { CreatePrintJobRequest, PrintJobParamRequest, CancelPrintJobRequest } from "./printJobs.types.js";
import PrintJobDao from "../../../shared/dao/printJob.dao.js";
import DocumentDao from "../../../shared/dao/document.dao.js";
import QuoteDao from "../../../shared/dao/quote.dao.js";
import PrinterDao from "../../../shared/dao/printer.dao.js";
import PrintJobEventDao from "../../../shared/dao/printJobEvent.dao.js";
import BadRequest from "../../../shared/errors/BadRequest.error.js";
import NotFound from "../../../shared/errors/NotFound.error.js";
import Created from "../../../shared/responses/Created.response.js";
import Ok from "../../../shared/responses/Ok.response.js";

class PrintJobsController {
    printJobDao: PrintJobDao;
    documentDao: DocumentDao;
    quoteDao: QuoteDao;
    printerDao: PrinterDao;
    eventDao: PrintJobEventDao;

    constructor() {
        this.printJobDao = new PrintJobDao();
        this.documentDao = new DocumentDao();
        this.quoteDao = new QuoteDao();
        this.printerDao = new PrinterDao();
        this.eventDao = new PrintJobEventDao();
    }

    create = async (req: CreatePrintJobRequest, res: Response) => {
        const { quoteId, documentId, printerId } = req.body;
        const idempotencyKey = (req.headers["idempotency-key"] as string) || undefined;

        // Idempotency check
        if (idempotencyKey) {
            const existing = await this.printJobDao.findByIdempotencyKey(idempotencyKey);
            if (existing) {
                return Ok(res, "Print job already exists", {
                    jobId: existing._id.toString(),
                    status: existing.printStatus,
                    amountPaise: existing.pricing.totalAmountPaise,
                    currency: existing.pricing.currency,
                });
            }
        }

        // Validate document
        const document = await this.documentDao.findById(documentId);
        if (!document) {
            throw new NotFound("Document not found");
        }
        if (document.status !== "READY") {
            throw new BadRequest(`Document is not ready for printing. Current status: ${document.status}`);
        }

        // Validate quote
        const quote = await this.quoteDao.findById(quoteId);
        if (!quote) {
            throw new NotFound("Quote not found");
        }
        if (new Date() > quote.expiresAt) {
            throw new BadRequest("Quote has expired. Please generate a new quote.");
        }
        if (quote.documentId.toString() !== documentId) {
            throw new BadRequest("Quote does not match the specified document");
        }

        // Validate printer capabilities if printerId provided
        let targetPrinterId: any = undefined;
        if (printerId) {
            const printer = await this.printerDao.findById(printerId);
            if (!printer) {
                throw new NotFound("Printer not found");
            }
            if (printer.shopId.toString() !== document.shopId.toString()) {
                throw new BadRequest("Printer does not belong to the document's shop");
            }

            // Verify capabilities
            if (quote.colorMode === "COLOR" && !printer.capabilities.color) {
                throw new BadRequest("Selected printer does not support color printing");
            }
            if (quote.duplex && !printer.capabilities.duplex) {
                throw new BadRequest("Selected printer does not support duplex printing");
            }
            if (!printer.capabilities.supportedPaperSizes.includes(quote.paperSize)) {
                throw new BadRequest(`Selected printer does not support paper size ${quote.paperSize}`);
            }

            targetPrinterId = printer._id;
        }

        // Create PrintJob
        const printJob = await this.printJobDao.createPrintJob({
            shopId: document.shopId,
            documentId: document._id,
            printerId: targetPrinterId,
            quoteId: quote._id,
            idempotencyKey,
            settings: {
                selectedPages: quote.selectedPages,
                copies: quote.copies,
                colorMode: quote.colorMode,
                duplex: quote.duplex,
                paperSize: quote.paperSize,
                orientation: quote.orientation,
                scaling: quote.scaling,
            },
            pricing: {
                pageCount: quote.pageCount,
                copies: quote.copies,
                amountPerPagePaise: Math.round(quote.amountPaise / quote.totalPrintedPages),
                totalAmountPaise: quote.amountPaise,
                currency: "INR",
            },
            paymentStatus: "PENDING",
            printStatus: "PAYMENT_PENDING",
            dispatchAttempts: 0,
        });

        const jobId = printJob._id.toString();

        await this.eventDao.logEvent({
            printJobId: jobId,
            event: "JOB_CREATED",
            newStatus: "PAYMENT_PENDING",
            message: "Print job created with status PAYMENT_PENDING",
        });

        return Created(res, "Print job created", {
            jobId,
            status: "PAYMENT_PENDING",
            amountPaise: quote.amountPaise,
            currency: "INR",
        });
    };

    getStatus = async (req: PrintJobParamRequest, res: Response) => {
        const { jobId } = req.params;
        const job = await this.printJobDao.findById(jobId);

        if (!job) {
            throw new NotFound("Print job not found");
        }

        const printerDoc: any = job.printerId;

        return Ok(res, "Print job status retrieved", {
            jobId: job._id.toString(),
            paymentStatus: job.paymentStatus,
            printStatus: job.printStatus,
            printer: printerDoc
                ? {
                      printerId: printerDoc._id?.toString() || job.printerId?.toString(),
                      name: printerDoc.name,
                      status: printerDoc.status,
                  }
                : null,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
        });
    };

    getEvents = async (req: PrintJobParamRequest, res: Response) => {
        const { jobId } = req.params;
        const job = await this.printJobDao.findById(jobId);

        if (!job) {
            throw new NotFound("Print job not found");
        }

        const events = await this.eventDao.findByJobId(jobId);

        const formatted = events.map((e) => ({
            event: e.event,
            status: e.newStatus,
            message: e.message,
            createdAt: e.createdAt,
        }));

        return Ok(res, "Print job events retrieved", formatted);
    };

    cancel = async (req: CancelPrintJobRequest, res: Response) => {
        const { jobId } = req.params;
        const { reason } = req.body;

        const job = await this.printJobDao.findById(jobId);
        if (!job) {
            throw new NotFound("Print job not found");
        }

        // Cannot cancel if already submitted to printer or completed
        const uncancelableStatuses = ["SUBMITTED_TO_PRINTER", "COMPLETED", "CANCELLED"];
        if (uncancelableStatuses.includes(job.printStatus)) {
            throw new BadRequest(`Cannot cancel print job in state '${job.printStatus}'`);
        }

        const refundStatus = job.paymentStatus === "SUCCESS" ? "REFUND_PENDING" : "NOT_REQUIRED";
        const newPrintStatus = "CANCELLED";

        await this.printJobDao.updateById(jobId, {
            printStatus: newPrintStatus,
            cancellationReason: reason || "Customer requested cancellation",
        });

        await this.eventDao.logEvent({
            printJobId: jobId,
            event: "JOB_CANCELLED",
            previousStatus: job.printStatus,
            newStatus: newPrintStatus,
            message: reason || "Customer requested cancellation",
            metadata: { refundStatus },
        });

        return Ok(res, "Print job cancelled", {
            jobId,
            status: "CANCELLED",
            refundStatus,
        });
    };
}

export default PrintJobsController;
