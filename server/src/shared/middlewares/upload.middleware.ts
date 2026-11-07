// Importing modules
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import fs from "node:fs";
import env from "../config/env.config.js";
import storageService from "../services/storage.service.js";
import BadRequest from "../errors/BadRequest.error.js";

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dest = storageService.tempPath;
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        cb(null, dest);
    },
    filename: (_req, file, cb) => {
        const randomName = `upload_${Date.now()}_${crypto.randomBytes(8).toString("hex")}${path.extname(file.originalname).toLowerCase()}`;
        cb(null, randomName);
    },
});

const fileFilter = (
    _req: any,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [
        ".pdf",
        ".jpg",
        ".jpeg",
        ".png",
        ".doc",
        ".docx",
        ".ppt",
        ".pptx",
        ".xls",
        ".xlsx",
        ".odt",
        ".odp",
        ".ods",
        ".txt",
    ];

    if (!allowed.includes(ext)) {
        return cb(new BadRequest(`Unsupported file format '${ext}'. Allowed formats: PDF, JPG, PNG, DOC/DOCX, PPT/PPTX, XLS/XLSX, ODT, ODP, ODS, TXT`));
    }

    cb(null, true);
};

export const documentUpload = multer({
    storage,
    limits: {
        fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    },
    fileFilter,
});
