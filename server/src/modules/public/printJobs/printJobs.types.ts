// Importing modules
import { Request } from "express";

export interface CreatePrintJobRequest extends Request {
    body: {
        quoteId: string;
        documentId: string;
        printerId?: string;
        settings?: {
            selectedPages: number[];
            copies: number;
            colorMode: "BW" | "COLOR";
            duplex: boolean;
            paperSize: "A4" | "A3" | "A5" | "LETTER";
            orientation: "AUTO" | "PORTRAIT" | "LANDSCAPE";
            scaling: "FIT" | "ACTUAL_SIZE" | "SHRINK";
        };
    };
    headers: Request["headers"] & {
        "idempotency-key"?: string;
    };
}

export interface PrintJobParamRequest extends Request {
    params: {
        jobId: string;
    };
}

export interface CancelPrintJobRequest extends Request {
    params: {
        jobId: string;
    };
    body: {
        reason?: string;
    };
}
