// Importing module
import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IPrintSettings {
    selectedPages: number[];
    copies: number;
    colorMode: "BW" | "COLOR";
    duplex: boolean;
    paperSize: "A4" | "A3" | "A5" | "LETTER";
    orientation: "AUTO" | "PORTRAIT" | "LANDSCAPE";
    scaling: "FIT" | "ACTUAL_SIZE" | "SHRINK";
}

export interface IPrintPricing {
    pageCount: number;
    copies: number;
    amountPerPagePaise: number;
    totalAmountPaise: number;
    currency: "INR";
}

export interface IPrintJob extends MongooseDocument {
    shopId: mongoose.Types.ObjectId;
    documentId: mongoose.Types.ObjectId;
    printerId?: mongoose.Types.ObjectId;
    quoteId?: mongoose.Types.ObjectId;
    idempotencyKey?: string;
    settings: IPrintSettings;
    pricing: IPrintPricing;
    paymentStatus: "CREATED" | "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
    printStatus:
        | "CREATED"
        | "PAYMENT_PENDING"
        | "PAID"
        | "QUEUED"
        | "DISPATCHING"
        | "ACCEPTED_BY_AGENT"
        | "PRINTING"
        | "SUBMITTED_TO_PRINTER"
        | "COMPLETED"
        | "FAILED"
        | "CANCELLED"
        | "REFUND_PENDING"
        | "REFUNDED";
    agentId?: mongoose.Types.ObjectId;
    dispatchAttempts: number;
    printReadyPath?: string;
    checksumSha256?: string;
    cancellationReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const printJobSchema = new Schema<IPrintJob>(
    {
        shopId: {
            type: Schema.Types.ObjectId,
            required: [true, "Shop ID is required"],
            index: true,
        },
        documentId: {
            type: Schema.Types.ObjectId,
            ref: "Document",
            required: [true, "Document ID is required"],
            index: true,
        },
        printerId: {
            type: Schema.Types.ObjectId,
            ref: "Printer",
            required: false,
            index: true,
        },
        quoteId: {
            type: Schema.Types.ObjectId,
            ref: "Quote",
            required: false,
            index: true,
        },
        idempotencyKey: {
            type: String,
            required: false,
            index: true,
            sparse: true,
        },
        settings: {
            selectedPages: { type: [Number], required: true },
            copies: { type: Number, required: true, min: 1, default: 1 },
            colorMode: { type: String, enum: ["BW", "COLOR"], default: "BW" },
            duplex: { type: Boolean, default: false },
            paperSize: { type: String, enum: ["A4", "A3", "A5", "LETTER"], default: "A4" },
            orientation: { type: String, enum: ["AUTO", "PORTRAIT", "LANDSCAPE"], default: "AUTO" },
            scaling: { type: String, enum: ["FIT", "ACTUAL_SIZE", "SHRINK"], default: "FIT" },
        },
        pricing: {
            pageCount: { type: Number, required: true },
            copies: { type: Number, required: true },
            amountPerPagePaise: { type: Number, required: true },
            totalAmountPaise: { type: Number, required: true },
            currency: { type: String, enum: ["INR"], default: "INR" },
        },
        paymentStatus: {
            type: String,
            enum: ["CREATED", "PENDING", "SUCCESS", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"],
            default: "PENDING",
            index: true,
        },
        printStatus: {
            type: String,
            enum: [
                "CREATED",
                "PAYMENT_PENDING",
                "PAID",
                "QUEUED",
                "DISPATCHING",
                "ACCEPTED_BY_AGENT",
                "PRINTING",
                "SUBMITTED_TO_PRINTER",
                "COMPLETED",
                "FAILED",
                "CANCELLED",
                "REFUND_PENDING",
                "REFUNDED",
            ],
            default: "PAYMENT_PENDING",
            index: true,
        },
        agentId: {
            type: Schema.Types.ObjectId,
            ref: "Agent",
            required: false,
            index: true,
        },
        dispatchAttempts: {
            type: Number,
            default: 0,
        },
        printReadyPath: {
            type: String,
            required: false,
        },
        checksumSha256: {
            type: String,
            required: false,
        },
        cancellationReason: {
            type: String,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

printJobSchema.index({ shopId: 1, createdAt: -1 });
printJobSchema.index({ printStatus: 1, paymentStatus: 1 });

const PrintJobModel = mongoose.model<IPrintJob>("PrintJob", printJobSchema);

export default PrintJobModel;
