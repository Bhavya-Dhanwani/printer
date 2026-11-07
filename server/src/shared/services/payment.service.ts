// Importing modules
import crypto from "node:crypto";
import Razorpay from "razorpay";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";
import PaymentDao from "../dao/payment.dao.js";
import PrintJobDao from "../dao/printJob.dao.js";
import PrintJobEventDao from "../dao/printJobEvent.dao.js";

class PaymentService {
    razorpayClient: Razorpay | null = null;
    paymentDao: PaymentDao;
    printJobDao: PrintJobDao;
    eventDao: PrintJobEventDao;

    constructor() {
        this.paymentDao = new PaymentDao();
        this.printJobDao = new PrintJobDao();
        this.eventDao = new PrintJobEventDao();

        if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
            this.razorpayClient = new Razorpay({
                key_id: env.RAZORPAY_KEY_ID,
                key_secret: env.RAZORPAY_KEY_SECRET,
            });
        } else {
            logger.warn("Razorpay credentials not configured. Running in mock/development mode.");
        }
    }

    async createOrder(jobId: string, amountPaise: number): Promise<{
        paymentId: string;
        jobId: string;
        razorpayOrderId: string;
        amount: number;
        currency: "INR";
        status: string;
        keyId: string;
    }> {
        // Reuse existing pending payment order if exists
        const existingPayment = await this.paymentDao.findByPrintJobId(jobId);
        if (existingPayment && existingPayment.status === "CREATED") {
            return {
                paymentId: existingPayment._id.toString(),
                jobId,
                razorpayOrderId: existingPayment.razorpayOrderId,
                amount: existingPayment.amountPaise,
                currency: "INR",
                status: existingPayment.status,
                keyId: env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
            };
        }

        let razorpayOrderId = `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        if (this.razorpayClient) {
            const order = await this.razorpayClient.orders.create({
                amount: amountPaise,
                currency: "INR",
                receipt: jobId,
                notes: { jobId },
            });
            razorpayOrderId = order.id;
        }

        const payment = await this.paymentDao.createPayment({
            printJobId: jobId as any,
            razorpayOrderId,
            amountPaise,
            currency: "INR",
            status: "CREATED",
        });

        await this.eventDao.logEvent({
            printJobId: jobId,
            event: "PAYMENT_ORDER_CREATED",
            newStatus: "PAYMENT_PENDING",
            message: `Razorpay order created: ${razorpayOrderId}`,
            metadata: { razorpayOrderId, amountPaise },
        });

        return {
            paymentId: payment._id.toString(),
            jobId,
            razorpayOrderId,
            amount: amountPaise,
            currency: "INR",
            status: "CREATED",
            keyId: env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
        };
    }

    verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string): boolean {
        if (!env.RAZORPAY_WEBHOOK_SECRET) {
            // In dev without secret configured, if signature matches test token allow or log
            logger.warn("RAZORPAY_WEBHOOK_SECRET not configured.");
            return true;
        }

        const hmac = crypto.createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET);
        hmac.update(typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8"));
        const digest = hmac.digest("hex");

        if (digest.length !== signatureHeader.length) {
            return false;
        }

        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
    }

    async processWebhookEvent(eventPayload: any, eventId?: string): Promise<{ success: boolean; message: string }> {
        const eventType = eventPayload?.event;
        const paymentEntity = eventPayload?.payload?.payment?.entity;
        const orderEntity = eventPayload?.payload?.order?.entity;

        const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
        const razorpayPaymentId = paymentEntity?.id;
        const amountPaise = paymentEntity?.amount || orderEntity?.amount;

        if (!razorpayOrderId) {
            return { success: false, message: "Missing razorpayOrderId in webhook payload" };
        }

        const payment = await this.paymentDao.findByRazorpayOrderId(razorpayOrderId);
        if (!payment) {
            logger.warn({ razorpayOrderId }, "Webhook received for unknown Razorpay order");
            return { success: false, message: "Payment order not found" };
        }

        // Idempotency: if already SUCCESS, acknowledge safely
        if (payment.status === "SUCCESS") {
            return { success: true, message: "Payment already successfully processed" };
        }

        if (eventType === "payment.captured" || eventType === "order.paid") {
            if (amountPaise && payment.amountPaise !== amountPaise) {
                logger.error({ expected: payment.amountPaise, received: amountPaise }, "Webhook amount mismatch");
                return { success: false, message: "Payment amount mismatch" };
            }

            // Update payment record
            await this.paymentDao.updateById(payment._id.toString(), {
                status: "SUCCESS",
                razorpayPaymentId,
                webhookEventId: eventId,
            });

            // Update PrintJob
            const printJob = await this.printJobDao.updateById(payment.printJobId.toString(), {
                paymentStatus: "SUCCESS",
                printStatus: "PAID",
            });

            await this.eventDao.logEvent({
                printJobId: payment.printJobId.toString(),
                event: "PAYMENT_SUCCESS",
                previousStatus: "PAYMENT_PENDING",
                newStatus: "PAID",
                message: `Payment confirmed via webhook: ${razorpayPaymentId}`,
                metadata: { razorpayOrderId, razorpayPaymentId, amountPaise },
            });

            // Enqueue job for print dispatch
            const { queueService } = await import("./queue.service.js");
            await queueService.enqueuePrintDispatch(payment.printJobId.toString());

            return { success: true, message: "Payment processed and job queued for dispatch" };
        }

        if (eventType === "payment.failed") {
            await this.paymentDao.updateById(payment._id.toString(), {
                status: "FAILED",
                razorpayPaymentId,
                webhookEventId: eventId,
            });

            await this.printJobDao.updateById(payment.printJobId.toString(), {
                paymentStatus: "FAILED",
            });

            await this.eventDao.logEvent({
                printJobId: payment.printJobId.toString(),
                event: "PAYMENT_FAILED",
                previousStatus: "PAYMENT_PENDING",
                newStatus: "FAILED",
                message: "Payment failed via webhook",
                metadata: { razorpayOrderId, razorpayPaymentId },
            });

            return { success: true, message: "Payment marked as failed" };
        }

        return { success: true, message: `Event ${eventType} recorded` };
    }
}

const paymentService = new PaymentService();
export default paymentService;
