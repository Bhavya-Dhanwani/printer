// Importing module
import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IPayment extends MongooseDocument {
    printJobId: mongoose.Types.ObjectId;
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    amountPaise: number;
    currency: "INR";
    status: "CREATED" | "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
    webhookEventId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
    {
        printJobId: {
            type: Schema.Types.ObjectId,
            ref: "PrintJob",
            required: [true, "Print Job ID is required"],
            index: true,
        },
        razorpayOrderId: {
            type: String,
            required: [true, "Razorpay Order ID is required"],
            unique: true,
            index: true,
        },
        razorpayPaymentId: {
            type: String,
            required: false,
            index: true,
            sparse: true,
        },
        amountPaise: {
            type: Number,
            required: [true, "Amount in paise is required"],
        },
        currency: {
            type: String,
            enum: ["INR"],
            default: "INR",
        },
        status: {
            type: String,
            enum: ["CREATED", "PENDING", "SUCCESS", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"],
            default: "CREATED",
            index: true,
        },
        webhookEventId: {
            type: String,
            required: false,
            index: true,
            sparse: true,
        },
    },
    {
        timestamps: true,
    }
);

paymentSchema.index({ printJobId: 1, createdAt: -1 });

const PaymentModel = mongoose.model<IPayment>("Payment", paymentSchema);

export default PaymentModel;
