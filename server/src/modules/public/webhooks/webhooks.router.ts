// Importing modules
import express from "express";
import WebhooksController from "./webhooks.controller.js";

const router = express.Router();
const controller = new WebhooksController();

/*
    @route POST /api/webhooks/razorpay
    @desc Razorpay payment webhook endpoint
    @access Public (Signature Verified)
*/
router.post("/razorpay", controller.razorpay);

export default router;
