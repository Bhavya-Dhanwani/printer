// Importing module
import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IPrinterCapabilities {
    color: boolean;
    duplex: boolean;
    supportedPaperSizes: string[];
}

export interface IPrinter {
    _id: mongoose.Types.ObjectId;
    shopId: mongoose.Types.ObjectId;
    name: string;
    model?: string;
    agentId?: mongoose.Types.ObjectId;
    connectionType: "USB" | "NETWORK";
    status: "ONLINE" | "OFFLINE" | "BUSY" | "ERROR";
    capabilities: IPrinterCapabilities;
    lastHeartbeatAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

const printerSchema = new Schema<IPrinter>(
    {
        shopId: {
            type: Schema.Types.ObjectId,
            required: [true, "Shop ID is required"],
            index: true,
        },
        name: {
            type: String,
            required: [true, "Printer name is required"],
            trim: true,
        },
        model: {
            type: String,
            required: false,
            trim: true,
        },
        agentId: {
            type: Schema.Types.ObjectId,
            ref: "Agent",
            required: false,
            index: true,
        },
        connectionType: {
            type: String,
            enum: ["USB", "NETWORK"],
            default: "USB",
        },
        status: {
            type: String,
            enum: ["ONLINE", "OFFLINE", "BUSY", "ERROR"],
            default: "ONLINE",
            index: true,
        },
        capabilities: {
            color: { type: Boolean, default: false },
            duplex: { type: Boolean, default: false },
            supportedPaperSizes: { type: [String], default: ["A4"] },
        },
        lastHeartbeatAt: {
            type: Date,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

printerSchema.index({ shopId: 1, name: 1 }, { unique: true });

const PrinterModel = mongoose.model<IPrinter>("Printer", printerSchema);

export default PrinterModel;
