// Importing modules
import express from "express";
import DocumentsController from "./documents.controller.js";
import { documentUploadValidators, documentParamValidators, quoteValidators } from "./documents.validator.js";
import { documentUpload } from "../../../shared/middlewares/upload.middleware.js";
import {
    uploadRateLimiter,
    documentStatusLimiter,
    documentPreviewLimiter,
    documentContentLimiter,
    quoteRateLimiter,
} from "../../../shared/middlewares/rateLimit.middleware.js";

const router = express.Router();
const controller = new DocumentsController();

/*
    @route POST /api/documents/upload
    @desc Upload document for printing
    @access Public
*/
router.post(
    "/upload",
    uploadRateLimiter,
    documentUpload.single("file"),
    documentUploadValidators,
    controller.upload
);

/*
    @route GET /api/documents/:documentId
    @desc Get document status and metadata
    @access Public
*/
router.get(
    "/:documentId",
    documentStatusLimiter,
    documentParamValidators,
    controller.getStatus
);

/*
    @route GET /api/documents/:documentId/preview
    @desc Get document preview URL
    @access Public
*/
router.get(
    "/:documentId/preview",
    documentPreviewLimiter,
    documentParamValidators,
    controller.getPreview
);

/*
    @route GET /api/documents/:documentId/content
    @desc Stream document content
    @access Public
*/
router.get(
    "/:documentId/content",
    documentContentLimiter,
    documentParamValidators,
    controller.getContent
);

/*
    @route POST /api/documents/:documentId/quote
    @desc Generate printing quote
    @access Public
*/
router.post(
    "/:documentId/quote",
    quoteRateLimiter,
    quoteValidators,
    controller.createQuote
);

export default router;
