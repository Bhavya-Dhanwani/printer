// Importing modules
import { body, param } from "express-validator";
import validateErrors from "../../../shared/utils/validateErrors.util.js";

const documentUploadValidators = [
    body("shopId")
        .notEmpty()
        .withMessage("Shop ID is required")
        .isMongoId()
        .withMessage("Shop ID must be a valid MongoDB ObjectId"),
    validateErrors,
];

const documentParamValidators = [
    param("documentId")
        .notEmpty()
        .withMessage("Document ID is required")
        .isMongoId()
        .withMessage("Document ID must be a valid MongoDB ObjectId"),
    validateErrors,
];

const quoteValidators = [
    param("documentId")
        .notEmpty()
        .withMessage("Document ID is required")
        .isMongoId()
        .withMessage("Document ID must be a valid MongoDB ObjectId"),
    body("copies")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Copies must be an integer between 1 and 100"),
    body("colorMode")
        .optional()
        .isIn(["BW", "COLOR"])
        .withMessage("Color mode must be either 'BW' or 'COLOR'"),
    body("duplex")
        .optional()
        .isBoolean()
        .withMessage("Duplex must be a boolean"),
    body("paperSize")
        .optional()
        .isIn(["A4", "A3", "A5", "LETTER"])
        .withMessage("Paper size must be A4, A3, A5 or LETTER"),
    body("orientation")
        .optional()
        .isIn(["AUTO", "PORTRAIT", "LANDSCAPE"])
        .withMessage("Orientation must be AUTO, PORTRAIT or LANDSCAPE"),
    body("scaling")
        .optional()
        .isIn(["FIT", "ACTUAL_SIZE", "SHRINK"])
        .withMessage("Scaling must be FIT, ACTUAL_SIZE or SHRINK"),
    validateErrors,
];

export { documentUploadValidators, documentParamValidators, quoteValidators };
