// Importing modules
import express from "express";
import PaymentsController from "./payments.controller.js";
import { createOrderValidators } from "./payments.validator.js";
import { createPaymentLimiter } from "../../../shared/middlewares/rateLimit.middleware.js";

const router = express.Router();
const controller = new PaymentsController();

/*
    @route POST /api/payments/create-order
    @desc Create Razorpay payment order for print job
    @access Public
*/
router.post(
    "/create-order",
    createPaymentLimiter,
    createOrderValidators,
    controller.createOrder
);

export default router;
