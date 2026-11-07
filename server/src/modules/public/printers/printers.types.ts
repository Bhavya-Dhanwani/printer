// Importing modules
import { Request } from "express";

export interface RegisterPrinterRequest extends Request {
    body: {
        name: string;
        model?: string;
        connectionType?: "USB" | "NETWORK";
        agentId: string;
        capabilities?: {
            color?: boolean;
            duplex?: boolean;
            supportedPaperSizes?: string[];
        };
    };
}

export interface PrinterParamRequest extends Request {
    params: {
        printerId: string;
    };
}

export interface RegisterAgentRequest extends Request {
    body: {
        shopId: string;
        deviceName: string;
        version?: string;
    };
}

export interface AgentHeartbeatRequest extends Request {
    body: {
        agentId: string;
        status?: "CONNECTED" | "DISCONNECTED";
        printers?: Array<{
            printerId: string;
            status: "ONLINE" | "OFFLINE" | "BUSY" | "ERROR";
        }>;
    };
}
