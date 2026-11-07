// Importing modules
import { Request, Response } from "express";
import paymentService from "../../../shared/services/payment.service.js";
import BadRequest from "../../../shared/errors/BadRequest.error.js";
import logger from "../../../shared/config/logger.config.js";

class WebhooksController {
    razorpay = async (req: Request, res: Response) => {
        const signature = (req.headers["x-razorpay-signature"] as string) || "";
        const rawBody = (req as any).rawBody || JSON.stringify(req.body);

        if (!signature) {
            logger.warn("Razorpay webhook received without x-razorpay-signature header");
            throw new BadRequest("Missing webhook signature");
        }

        const isSignatureValid = paymentService.verifyWebhookSignature(rawBody, signature);
        if (!isSignatureValid) {
            logger.error("Invalid Razorpay webhook signature");
            throw new BadRequest("Invalid webhook signature");
        }

        const eventId = (req.headers["x-razorpay-event-id"] as string) || req.body?.event_id;
        const result = await paymentService.processWebhookEvent(req.body, eventId);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Webhook processed",
        });
    };
}

export default WebhooksController;
