// Importing module
import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IPageDimension {
    page: number;
    width: number;
    height: number;
    orientation: "PORTRAIT" | "LANDSCAPE";
    detectedSize: string;
}

export interface IDocument extends MongooseDocument {
    shopId: mongoose.Types.ObjectId;
    originalName: string;
    originalPath: string;
    processedPath?: string;
    mimeType: string;
    detectedMimeType: string;
    extension: string;
    fileSize: number;
    pageCount?: number;
    pageDimensions?: IPageDimension[];
    status: "UPLOADING" | "UPLOADED" | "PROCESSING" | "READY" | "PROCESSING_FAILED" | "EXPIRED" | "DELETED";
    processingError?: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
}

// defining the schema for document model
const documentSchema = new Schema<IDocument>(
    {
        shopId: {
            type: Schema.Types.ObjectId,
            required: [true, "Shop ID is required"],
            index: true,
        },
        originalName: {
            type: String,
            required: [true, "Original name is required"],
            trim: true,
        },
        originalPath: {
            type: String,
            required: [true, "Original path is required"],
        },
        processedPath: {
            type: String,
            required: false,
        },
        mimeType: {
            type: String,
            required: true,
        },
        detectedMimeType: {
            type: String,
            required: true,
        },
        extension: {
            type: String,
            required: true,
        },
        fileSize: {
            type: Number,
            required: true,
        },
        pageCount: {
            type: Number,
            required: false,
        },
        pageDimensions: [
            {
                page: { type: Number, required: true },
                width: { type: Number, required: true },
                height: { type: Number, required: true },
                orientation: { type: String, required: true },
                detectedSize: { type: String, required: true },
            },
        ],
        status: {
            type: String,
            enum: ["UPLOADING", "UPLOADED", "PROCESSING", "READY", "PROCESSING_FAILED", "EXPIRED", "DELETED"],
            default: "UPLOADED",
            index: true,
        },
        processingError: {
            type: String,
            required: false,
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

documentSchema.index({ shopId: 1, createdAt: -1 });

const DocumentModel = mongoose.model<IDocument>("Document", documentSchema);

export default DocumentModel;
