// Importing modules
import { body, param } from "express-validator";
import validateErrors from "../../../shared/utils/validateErrors.util.js";

const createPrintJobValidators = [
    body("quoteId")
        .notEmpty()
        .withMessage("Quote ID is required")
        .isMongoId()
        .withMessage("Quote ID must be a valid MongoDB ObjectId"),
    body("documentId")
        .notEmpty()
        .withMessage("Document ID is required")
        .isMongoId()
        .withMessage("Document ID must be a valid MongoDB ObjectId"),
    body("printerId")
        .optional()
        .isMongoId()
        .withMessage("Printer ID must be a valid MongoDB ObjectId"),
    validateErrors,
];

const printJobParamValidators = [
    param("jobId")
        .notEmpty()
        .withMessage("Job ID is required")
        .isMongoId()
        .withMessage("Job ID must be a valid MongoDB ObjectId"),
    validateErrors,
];

const cancelPrintJobValidators = [
    param("jobId")
        .notEmpty()
        .withMessage("Job ID is required")
        .isMongoId()
        .withMessage("Job ID must be a valid MongoDB ObjectId"),
    body("reason")
        .optional()
        .isString()
        .withMessage("Reason must be a string"),
    validateErrors,
];

export { createPrintJobValidators, printJobParamValidators, cancelPrintJobValidators };
