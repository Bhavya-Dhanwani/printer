// Importing module
import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IAgent extends MongooseDocument {
    shopId: mongoose.Types.ObjectId;
    deviceName: string;
    deviceTokenHash: string;
    status: "CONNECTED" | "DISCONNECTED";
    version?: string;
    lastHeartbeatAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const agentSchema = new Schema<IAgent>(
    {
        shopId: {
            type: Schema.Types.ObjectId,
            required: [true, "Shop ID is required"],
            index: true,
        },
        deviceName: {
            type: String,
            required: [true, "Device name is required"],
            trim: true,
        },
        deviceTokenHash: {
            type: String,
            required: [true, "Device token hash is required"],
            select: false,
        },
        status: {
            type: String,
            enum: ["CONNECTED", "DISCONNECTED"],
            default: "DISCONNECTED",
            index: true,
        },
        version: {
            type: String,
            required: false,
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

agentSchema.index({ shopId: 1, deviceName: 1 });

const AgentModel = mongoose.model<IAgent>("Agent", agentSchema);

export default AgentModel;
