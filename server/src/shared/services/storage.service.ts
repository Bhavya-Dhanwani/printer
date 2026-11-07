// Importing modules
import fs from "node:fs";
import path from "node:path";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";

class StorageService {
    tempPath: string;
    originalPath: string;
    processedPath: string;
    printPath: string;

    constructor() {
        this.tempPath = path.resolve(env.TEMP_STORAGE_PATH);
        this.originalPath = path.resolve(env.ORIGINAL_STORAGE_PATH);
        this.processedPath = path.resolve(env.PROCESSED_STORAGE_PATH);
        this.printPath = path.resolve(env.PRINT_STORAGE_PATH);

        this.initDirectories();
    }

    private initDirectories(): void {
        const dirs = [this.tempPath, this.originalPath, this.processedPath, this.printPath];
        for (const dir of dirs) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                logger.info(`Created storage directory: ${dir}`);
            }
        }
    }

    getDocumentTempDir(documentId: string): string {
        const dir = path.join(this.tempPath, `doc_${documentId}`);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    getDocumentOriginalDir(documentId: string): string {
        const dir = path.join(this.originalPath, `doc_${documentId}`);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    getDocumentProcessedDir(documentId: string): string {
        const dir = path.join(this.processedPath, `doc_${documentId}`);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    getPrintJobDir(jobId: string): string {
        const dir = path.join(this.printPath, `job_${jobId}`);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    }

    async deleteDirectory(targetPath: string): Promise<void> {
        try {
            if (fs.existsSync(targetPath)) {
                await fs.promises.rm(targetPath, { recursive: true, force: true });
            }
        } catch (error) {
            logger.error({ error, targetPath }, "Failed to delete directory");
        }
    }

    async deleteFile(filePath: string): Promise<void> {
        try {
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
        } catch (error) {
            logger.error({ error, filePath }, "Failed to delete file");
        }
    }
}

const storageService = new StorageService();
export default storageService;
