// Importing modules
import { Request } from "express";

export interface DocumentUploadRequest extends Request {
    body: {
        shopId: string;
    };
    file?: Express.Multer.File;
}

export interface DocumentParamRequest extends Request {
    params: {
        documentId: string;
    };
}

export interface QuoteCreateRequest extends Request {
    params: {
        documentId: string;
    };
    body: {
        selectedPages?: number[];
        copies?: number;
        colorMode?: "BW" | "COLOR";
        duplex?: boolean;
        paperSize?: "A4" | "A3" | "A5" | "LETTER";
        orientation?: "AUTO" | "PORTRAIT" | "LANDSCAPE";
        scaling?: "FIT" | "ACTUAL_SIZE" | "SHRINK";
    };
}
