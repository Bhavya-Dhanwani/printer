// Importing modules
import { Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { DocumentUploadRequest, DocumentParamRequest, QuoteCreateRequest } from "./documents.types.js";
import DocumentDao from "../../../shared/dao/document.dao.js";
import BadRequest from "../../../shared/errors/BadRequest.error.js";
import NotFound from "../../../shared/errors/NotFound.error.js";
import Accepted from "../../../shared/responses/Accepted.response.js";
import Ok from "../../../shared/responses/Ok.response.js";
import env from "../../../shared/config/env.config.js";
import storageService from "../../../shared/services/storage.service.js";
import { queueService } from "../../../shared/services/queue.service.js";
import documentProcessingService from "../../../shared/services/documentProcessing.service.js";
import pricingService from "../../../shared/services/pricing.service.js";

class DocumentsController {
    documentDao: DocumentDao;

    constructor() {
        this.documentDao = new DocumentDao();
    }

    upload = async (req: DocumentUploadRequest, res: Response) => {
        if (!req.file) {
            throw new BadRequest("No file uploaded");
        }

        const { shopId } = req.body;
        const uploadedFile = req.file;
        const ext = path.extname(uploadedFile.originalname).toLowerCase();
        const expiresAt = new Date(Date.now() + env.DOCUMENT_RETENTION_MINUTES * 60 * 1000);

        // Pre-create document record to get ID
        const document = await this.documentDao.createDocument({
            shopId: shopId as any,
            originalName: uploadedFile.originalname,
            originalPath: uploadedFile.path,
            mimeType: uploadedFile.mimetype,
            detectedMimeType: uploadedFile.mimetype,
            extension: ext,
            fileSize: uploadedFile.size,
            status: "UPLOADED",
            expiresAt,
        });

        const docId = document._id.toString();

        // Move file from temporary upload root into isolated original directory
        const originalDir = storageService.getDocumentOriginalDir(docId);
        const permanentOriginalPath = path.join(originalDir, `original${ext}`);

        await fs.promises.rename(uploadedFile.path, permanentOriginalPath);
        await this.documentDao.updateById(docId, { originalPath: permanentOriginalPath });

        // Enqueue document processing asynchronously via BullMQ
        await queueService.enqueueDocumentProcessing(docId);

        return Accepted(res, "Document uploaded and queued for processing", {
            documentId: docId,
            status: "UPLOADED",
            processingStatus: "QUEUED",
            originalName: uploadedFile.originalname,
            fileSize: uploadedFile.size,
            estimatedProcessingTimeMs: 3000,
        });
    };

    getStatus = async (req: DocumentParamRequest, res: Response) => {
        const { documentId } = req.params;
        const doc = await this.documentDao.findById(documentId);

        if (!doc) {
            throw new NotFound("Document not found");
        }

        return Ok(res, "Document status retrieved", {
            documentId: doc._id.toString(),
            status: doc.status,
            originalName: doc.originalName,
            pageCount: doc.pageCount,
            mimeType: doc.mimeType,
            pageDimensions: doc.pageDimensions || [],
            processingError: doc.processingError,
        });
    };

    getPreview = async (req: DocumentParamRequest, res: Response) => {
        const { documentId } = req.params;
        const doc = await this.documentDao.findById(documentId);

        if (!doc) {
            throw new NotFound("Document not found");
        }

        if (doc.status !== "READY" || !doc.processedPath) {
            throw new BadRequest(`Document is not ready for preview. Current status: ${doc.status}`);
        }

        return Ok(res, "Preview details retrieved", {
            previewUrl: `/api/documents/${documentId}/content`,
            expiresInSeconds: 300,
            contentType: "application/pdf",
        });
    };

    getContent = async (req: DocumentParamRequest, res: Response) => {
        const { documentId } = req.params;
        const doc = await this.documentDao.findById(documentId);

        if (!doc) {
            throw new NotFound("Document not found");
        }

        if (doc.status !== "READY" || !doc.processedPath || !fs.existsSync(doc.processedPath)) {
            throw new BadRequest(`Document content is not ready or has expired.`);
        }

        const stat = await fs.promises.stat(doc.processedPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'inline; filename="preview.pdf"');

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize) {
                res.status(416).send("Requested range not satisfiable\n" + start + " >= " + fileSize);
                return;
            }

            const chunksize = end - start + 1;
            const file = fs.createReadStream(doc.processedPath, { start, end });
            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunksize,
                "Content-Type": "application/pdf",
            });
            file.pipe(res);
        } else {
            res.setHeader("Content-Length", fileSize);
            res.setHeader("Accept-Ranges", "bytes");
            const stream = fs.createReadStream(doc.processedPath);
            stream.pipe(res);
        }
    };

    createQuote = async (req: QuoteCreateRequest, res: Response) => {
        const { documentId } = req.params;
        const doc = await this.documentDao.findById(documentId);

        if (!doc) {
            throw new NotFound("Document not found");
        }

        if (doc.status !== "READY" || !doc.pageCount) {
            throw new BadRequest("Document is not ready or has not finished processing");
        }

        const rawPages = req.body.selectedPages;
        const selectedPages = documentProcessingService.parsePageSelection(rawPages, doc.pageCount);

        const settings = {
            selectedPages,
            copies: req.body.copies || 1,
            colorMode: req.body.colorMode || "BW",
            duplex: Boolean(req.body.duplex),
            paperSize: req.body.paperSize || "A4",
            orientation: req.body.orientation || "AUTO",
            scaling: req.body.scaling || "FIT",
        };

        const quote = await pricingService.calculateQuote(doc.shopId.toString(), documentId, settings);

        return Ok(res, "Quote generated successfully", quote);
    };
}

export default DocumentsController;
