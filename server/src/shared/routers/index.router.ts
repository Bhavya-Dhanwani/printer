// Importing modules
import express from "express";
import healthRouter from "./health.router.js";
import authRouter from "../../modules/public/auth/auth.router.js";
import documentsRouter from "../../modules/public/documents/documents.router.js";
import printJobsRouter from "../../modules/public/printJobs/printJobs.router.js";
import paymentsRouter from "../../modules/public/payments/payments.router.js";
import webhooksRouter from "../../modules/public/webhooks/webhooks.router.js";
import printersRouter from "../../modules/public/printers/printers.router.js";

// making the router
const router = express.Router();

// mounting the public routers
router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/documents", documentsRouter);
router.use("/print-jobs", printJobsRouter);
router.use("/payments", paymentsRouter);
router.use("/webhooks", webhooksRouter);
router.use("/printers", printersRouter);

// exporting the router
export default router;
