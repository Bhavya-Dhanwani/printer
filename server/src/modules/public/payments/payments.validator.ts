// Importing modules
import { body } from "express-validator";
import validateErrors from "../../../shared/utils/validateErrors.util.js";

const createOrderValidators = [
    body("jobId")
        .notEmpty()
        .withMessage("Job ID is required")
        .isMongoId()
        .withMessage("Job ID must be a valid MongoDB ObjectId"),
    validateErrors,
];

export { createOrderValidators };
