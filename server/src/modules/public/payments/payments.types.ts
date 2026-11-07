// Importing modules
import { Request } from "express";

export interface CreatePaymentOrderRequest extends Request {
    body: {
        jobId: string;
    };
}
