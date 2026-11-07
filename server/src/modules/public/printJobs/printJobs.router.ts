// Importing modules
import express from "express";
import PrintJobsController from "./printJobs.controller.js";
import {
    createPrintJobValidators,
    printJobParamValidators,
    cancelPrintJobValidators,
} from "./printJobs.validator.js";
import {
    createPrintJobLimiter,
    printJobStatusLimiter,
    printJobEventsLimiter,
    cancelJobLimiter,
} from "../../../shared/middlewares/rateLimit.middleware.js";

const router = express.Router();
const controller = new PrintJobsController();

/*
    @route POST /api/print-jobs
    @desc Create new print job from quote
    @access Public
*/
router.post(
    "/",
    createPrintJobLimiter,
    createPrintJobValidators,
    controller.create
);

/*
    @route GET /api/print-jobs/:jobId
    @desc Get print job status
    @access Public
*/
router.get(
    "/:jobId",
    printJobStatusLimiter,
    printJobParamValidators,
    controller.getStatus
);

/*
    @route GET /api/print-jobs/:jobId/events
    @desc Get print job audit history
    @access Public
*/
router.get(
    "/:jobId/events",
    printJobEventsLimiter,
    printJobParamValidators,
    controller.getEvents
);

/*
    @route POST /api/print-jobs/:jobId/cancel
    @desc Cancel a print job
    @access Public
*/
router.post(
    "/:jobId/cancel",
    cancelJobLimiter,
    cancelPrintJobValidators,
    controller.cancel
);

export default router;
