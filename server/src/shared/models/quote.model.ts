// Importing module
import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IQuote extends MongooseDocument {
    shopId: mongoose.Types.ObjectId;
    documentId: mongoose.Types.ObjectId;
    selectedPages: number[];
    pageCount: number;
    copies: number;
    totalPrintedPages: number;
    estimatedPhysicalSheets: number;
    colorMode: "BW" | "COLOR";
    duplex: boolean;
    paperSize: "A4" | "A3" | "A5" | "LETTER";
    orientation: "AUTO" | "PORTRAIT" | "LANDSCAPE";
    scaling: "FIT" | "ACTUAL_SIZE" | "SHRINK";
    amountPaise: number;
    amountRupees: number;
    currency: "INR";
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const quoteSchema = new Schema<IQuote>(
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
        selectedPages: {
            type: [Number],
            required: true,
        },
        pageCount: {
            type: Number,
            required: true,
        },
        copies: {
            type: Number,
            required: true,
            min: 1,
            default: 1,
        },
        totalPrintedPages: {
            type: Number,
            required: true,
        },
        estimatedPhysicalSheets: {
            type: Number,
            required: true,
        },
        colorMode: {
            type: String,
            enum: ["BW", "COLOR"],
            required: true,
        },
        duplex: {
            type: Boolean,
            required: true,
        },
        paperSize: {
            type: String,
            enum: ["A4", "A3", "A5", "LETTER"],
            required: true,
        },
        orientation: {
            type: String,
            enum: ["AUTO", "PORTRAIT", "LANDSCAPE"],
            required: true,
        },
        scaling: {
            type: String,
            enum: ["FIT", "ACTUAL_SIZE", "SHRINK"],
            required: true,
        },
        amountPaise: {
            type: Number,
            required: true,
        },
        amountRupees: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            enum: ["INR"],
            default: "INR",
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

quoteSchema.index({ documentId: 1, expiresAt: 1 });

const QuoteModel = mongoose.model<IQuote>("Quote", quoteSchema);

export default QuoteModel;
