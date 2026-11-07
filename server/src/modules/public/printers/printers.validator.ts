// Importing modules
import { body, param } from "express-validator";
import validateErrors from "../../../shared/utils/validateErrors.util.js";

const registerPrinterValidators = [
    body("name")
        .notEmpty()
        .withMessage("Printer name is required")
        .isString()
        .withMessage("Printer name must be a string"),
    body("agentId")
        .notEmpty()
        .withMessage("Agent ID is required")
        .isMongoId()
        .withMessage("Agent ID must be a valid MongoDB ObjectId"),
    body("connectionType")
        .optional()
        .isIn(["USB", "NETWORK"])
        .withMessage("Connection type must be USB or NETWORK"),
    body("capabilities.color")
        .optional()
        .isBoolean()
        .withMessage("Color capability must be a boolean"),
    body("capabilities.duplex")
        .optional()
        .isBoolean()
        .withMessage("Duplex capability must be a boolean"),
    body("capabilities.supportedPaperSizes")
        .optional()
        .isArray()
        .withMessage("Supported paper sizes must be an array of strings"),
    validateErrors,
];

const printerParamValidators = [
    param("printerId")
        .notEmpty()
        .withMessage("Printer ID is required")
        .isMongoId()
        .withMessage("Printer ID must be a valid MongoDB ObjectId"),
    validateErrors,
];

const registerAgentValidators = [
    body("shopId")
        .notEmpty()
        .withMessage("Shop ID is required")
        .isMongoId()
        .withMessage("Shop ID must be a valid MongoDB ObjectId"),
    body("deviceName")
        .notEmpty()
        .withMessage("Device name is required"),
    validateErrors,
];

const agentHeartbeatValidators = [
    body("agentId")
        .notEmpty()
        .withMessage("Agent ID is required")
        .isMongoId()
        .withMessage("Agent ID must be a valid MongoDB ObjectId"),
    validateErrors,
];

export {
    registerPrinterValidators,
    printerParamValidators,
    registerAgentValidators,
    agentHeartbeatValidators,
};
