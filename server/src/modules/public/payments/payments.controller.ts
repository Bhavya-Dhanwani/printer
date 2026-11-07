// Importing modules
import { Response } from "express";
import { CreatePaymentOrderRequest } from "./payments.types.js";
import PrintJobDao from "../../../shared/dao/printJob.dao.js";
import NotFound from "../../../shared/errors/NotFound.error.js";
import BadRequest from "../../../shared/errors/BadRequest.error.js";
import Ok from "../../../shared/responses/Ok.response.js";
import paymentService from "../../../shared/services/payment.service.js";

class PaymentsController {
    printJobDao: PrintJobDao;

    constructor() {
        this.printJobDao = new PrintJobDao();
    }

    createOrder = async (req: CreatePaymentOrderRequest, res: Response) => {
        const { jobId } = req.body;

        const printJob = await this.printJobDao.findById(jobId);
        if (!printJob) {
            throw new NotFound("Print job not found");
        }

        if (printJob.paymentStatus === "SUCCESS") {
            throw new BadRequest("Payment has already been completed for this job");
        }

        const amountPaise = printJob.pricing.totalAmountPaise;
        const orderData = await paymentService.createOrder(jobId, amountPaise);

        return Ok(res, "Razorpay payment order created", orderData);
    };
}

export default PaymentsController;
