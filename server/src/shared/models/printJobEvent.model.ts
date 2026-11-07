// Importing module
import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IPrintJobEvent extends MongooseDocument {
    printJobId: mongoose.Types.ObjectId;
    event: string;
    previousStatus?: string;
    newStatus: string;
    message?: string;
    agentId?: mongoose.Types.ObjectId;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}

const printJobEventSchema = new Schema<IPrintJobEvent>(
    {
        printJobId: {
            type: Schema.Types.ObjectId,
            ref: "PrintJob",
            required: [true, "Print Job ID is required"],
            index: true,
        },
        event: {
            type: String,
            required: [true, "Event name is required"],
        },
        previousStatus: {
            type: String,
            required: false,
        },
        newStatus: {
            type: String,
            required: [true, "New status is required"],
        },
        message: {
            type: String,
            required: false,
        },
        agentId: {
            type: Schema.Types.ObjectId,
            ref: "Agent",
            required: false,
        },
        metadata: {
            type: Schema.Types.Mixed,
            required: false,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

printJobEventSchema.index({ printJobId: 1, createdAt: 1 });

const PrintJobEventModel = mongoose.model<IPrintJobEvent>("PrintJobEvent", printJobEventSchema);

export default PrintJobEventModel;
