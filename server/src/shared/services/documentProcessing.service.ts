// Importing modules
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";
import { fileTypeFromFile } from "file-type";
import { execa } from "execa";
import env from "../config/env.config.js";
import logger from "../config/logger.config.js";
import { IPageDimension } from "../models/document.model.js";

export interface IPdfAnalysisResult {
    pageCount: number;
    pageDimensions: IPageDimension[];
    isEncrypted: boolean;
    isValid: boolean;
}

const SUPPORTED_EXTENSIONS = new Set([
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
]);

class DocumentProcessingService {
    // Detect page size name from points (1 pt = 1/72 inch)
    detectPaperSize(width: number, height: number): string {
        const w = Math.min(width, height);
        const h = Math.max(width, height);

        // Tolerance in points
        const tol = 12;

        if (Math.abs(w - 595.28) < tol && Math.abs(h - 841.89) < tol) return "A4";
        if (Math.abs(w - 841.89) < tol && Math.abs(h - 1190.55) < tol) return "A3";
        if (Math.abs(w - 419.53) < tol && Math.abs(h - 595.28) < tol) return "A5";
        if (Math.abs(w - 612) < tol && Math.abs(h - 792) < tol) return "LETTER";

        return "CUSTOM";
    }

    parsePageSelection(selectionInput: unknown, maxPages: number): number[] {
        if (!selectionInput) {
            // Default to all pages
            return Array.from({ length: maxPages }, (_, i) => i + 1);
        }

        let pageNumbers: number[] = [];

        if (Array.isArray(selectionInput)) {
            for (const item of selectionInput) {
                const num = Number(item);
                if (!Number.isInteger(num) || num < 1 || num > maxPages) {
                    throw new Error(`Invalid page number: ${item}. Must be between 1 and ${maxPages}.`);
                }
                pageNumbers.push(num);
            }
        } else if (typeof selectionInput === "string") {
            const parts = selectionInput.split(",").map((s) => s.trim()).filter(Boolean);
            if (parts.length === 0) {
                throw new Error("Page selection range expression is empty.");
            }

            for (const part of parts) {
                if (part.includes("-")) {
                    const rangeParts = part.split("-").map((s) => s.trim());
                    if (rangeParts.length !== 2) {
                        throw new Error(`Malformed page range: "${part}"`);
                    }
                    const start = Number(rangeParts[0]);
                    const end = Number(rangeParts[1]);

                    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > maxPages || start > end) {
                        throw new Error(`Invalid page range: "${part}". Must be between 1 and ${maxPages}.`);
                    }

                    for (let p = start; p <= end; p++) {
                        pageNumbers.push(p);
                    }
                } else {
                    const num = Number(part);
                    if (!Number.isInteger(num) || num < 1 || num > maxPages) {
                        throw new Error(`Invalid page number: "${part}". Must be between 1 and ${maxPages}.`);
                    }
                    pageNumbers.push(num);
                }
            }
        } else {
            throw new Error("Invalid page selection format.");
        }

        if (pageNumbers.length === 0) {
            throw new Error("Selected page list cannot be empty.");
        }

        // Deduplicate while preserving order
        const seen = new Set<number>();
        const uniquePages: number[] = [];
        for (const p of pageNumbers) {
            if (!seen.has(p)) {
                seen.add(p);
                uniquePages.push(p);
            }
        }

        return uniquePages;
    }

    async validateFileSignature(
        filePath: string,
        originalExtension: string
    ): Promise<{ detectedMimeType: string; isSupported: boolean; isValid: boolean }> {
        const ext = originalExtension.toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(ext)) {
            return { detectedMimeType: "application/octet-stream", isSupported: false, isValid: false };
        }

        if (ext === ".txt") {
            // Text files do not have magic bytes; check valid UTF-8/ASCII
            return { detectedMimeType: "text/plain", isSupported: true, isValid: true };
        }

        const fileTypeResult = await fileTypeFromFile(filePath);

        if (ext === ".pdf") {
            const isPdf = fileTypeResult?.mime === "application/pdf";
            return {
                detectedMimeType: fileTypeResult?.mime || "application/octet-stream",
                isSupported: isPdf,
                isValid: isPdf,
            };
        }

        if (ext === ".jpg" || ext === ".jpeg") {
            const isJpg = fileTypeResult?.mime === "image/jpeg";
            return {
                detectedMimeType: fileTypeResult?.mime || "application/octet-stream",
                isSupported: isJpg,
                isValid: isJpg,
            };
        }

        if (ext === ".png") {
            const isPng = fileTypeResult?.mime === "image/png";
            return {
                detectedMimeType: fileTypeResult?.mime || "application/octet-stream",
                isSupported: isPng,
                isValid: isPng,
            };
        }

        // Office files (docx, xlsx, pptx are ZIP archives; doc, xls, ppt are CFBF/OLE compound files)
        const mime = fileTypeResult?.mime as string | undefined;

        const isOfficeZip =
            mime === "application/zip" ||
            mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
            mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation";

        const isOfficeOle =
            mime === "application/x-cfb" ||
            mime === "application/msword" ||
            mime === "application/vnd.ms-excel" ||
            mime === "application/vnd.ms-powerpoint";

        const isOdf =
            mime === "application/vnd.oasis.opendocument.text" ||
            mime === "application/vnd.oasis.opendocument.spreadsheet" ||
            mime === "application/vnd.oasis.opendocument.presentation" ||
            mime === "application/zip";

        const isValidOffice = isOfficeZip || isOfficeOle || isOdf;

        return {
            detectedMimeType: fileTypeResult?.mime || "application/octet-stream",
            isSupported: isValidOffice,
            isValid: isValidOffice,
        };
    }

    async analyzePdf(filePath: string): Promise<IPdfAnalysisResult> {
        try {
            const fileBytes = await fs.promises.readFile(filePath);
            const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });

            const pageCount = pdfDoc.getPageCount();
            const pageDimensions: IPageDimension[] = [];

            for (let i = 0; i < pageCount; i++) {
                const page = pdfDoc.getPage(i);
                const { width, height } = page.getSize();
                const orientation = width > height ? "LANDSCAPE" : "PORTRAIT";
                const detectedSize = this.detectPaperSize(width, height);

                pageDimensions.push({
                    page: i + 1,
                    width: Math.round(width * 100) / 100,
                    height: Math.round(height * 100) / 100,
                    orientation,
                    detectedSize,
                });
            }

            return {
                pageCount,
                pageDimensions,
                isEncrypted: pdfDoc.isEncrypted,
                isValid: true,
            };
        } catch (error: any) {
            logger.error({ error: error?.message, filePath }, "PDF analysis failed");
            return {
                pageCount: 0,
                pageDimensions: [],
                isEncrypted: false,
                isValid: false,
            };
        }
    }

    async convertImageToPdf(inputPath: string, outputPath: string): Promise<void> {
        // Read image and normalize orientation with Sharp
        const image = sharp(inputPath).rotate();
        const metadata = await image.metadata();

        const imgWidth = metadata.width || 800;
        const imgHeight = metadata.height || 600;

        // A4 standard points: 595.28 x 841.89
        const a4Width = 595.28;
        const a4Height = 841.89;

        // Scale image to fit within A4 preserving aspect ratio
        const scale = Math.min(a4Width / imgWidth, a4Height / imgHeight);
        const targetWidth = Math.round(imgWidth * scale);
        const targetHeight = Math.round(imgHeight * scale);

        const normalizedPngBuffer = await image.png().toBuffer();

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([a4Width, a4Height]);
        const embeddedImage = await pdfDoc.embedPng(normalizedPngBuffer);

        // Center the image on the A4 page
        const x = (a4Width - targetWidth) / 2;
        const y = (a4Height - targetHeight) / 2;

        page.drawImage(embeddedImage, {
            x,
            y,
            width: targetWidth,
            height: targetHeight,
        });

        const pdfBytes = await pdfDoc.save();
        await fs.promises.writeFile(outputPath, pdfBytes);
    }

    async convertTextToPdf(inputPath: string, outputPath: string): Promise<void> {
        const textContent = await fs.promises.readFile(inputPath, "utf-8");
        const lines = textContent.split(/\r?\n/);

        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontSize = 10;
        const lineHeight = 14;
        const margin = 50;

        const a4Width = 595.28;
        const a4Height = 841.89;
        const maxLinesPerPage = Math.floor((a4Height - 2 * margin) / lineHeight);

        let currentPage = pdfDoc.addPage([a4Width, a4Height]);
        let lineCountOnPage = 0;

        for (const line of lines) {
            if (lineCountOnPage >= maxLinesPerPage) {
                currentPage = pdfDoc.addPage([a4Width, a4Height]);
                lineCountOnPage = 0;
            }

            const y = a4Height - margin - (lineCountOnPage + 1) * lineHeight;
            const safeLine = line.slice(0, 100); // truncate very long unwrapped lines
            currentPage.drawText(safeLine, {
                x: margin,
                y,
                size: fontSize,
                font,
                color: rgb(0, 0, 0),
            });

            lineCountOnPage++;
        }

        const pdfBytes = await pdfDoc.save();
        await fs.promises.writeFile(outputPath, pdfBytes);
    }

    private findLibreOfficeBinary(): string {
        if (env.LIBREOFFICE_PATH && fs.existsSync(env.LIBREOFFICE_PATH)) {
            return env.LIBREOFFICE_PATH;
        }

        // Standard Windows paths
        const commonWindowsPaths = [
            "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
            "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
        ];

        for (const winPath of commonWindowsPaths) {
            if (fs.existsSync(winPath)) {
                return winPath;
            }
        }

        return "soffice";
    }

    async convertOfficeToPdf(inputPath: string, outputDir: string, expectedPdfName: string): Promise<string> {
        const loBinary = this.findLibreOfficeBinary();
        const uniqueProfileDir = path.join(os.tmpdir(), `lo_profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

        try {
            await fs.promises.mkdir(uniqueProfileDir, { recursive: true });

            const profileUrl = `file:///${uniqueProfileDir.replace(/\\/g, "/")}`;

            await execa(
                loBinary,
                [
                    "--headless",
                    `"-env:UserInstallation=${profileUrl}"`,
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    outputDir,
                    inputPath,
                ],
                {
                    timeout: env.DOCUMENT_PROCESSING_TIMEOUT_MS,
                    reject: true,
                }
            );

            // LibreOffice produces a file with the input's basename and .pdf extension in outputDir
            const inputBase = path.parse(inputPath).name;
            const generatedPdfPath = path.join(outputDir, `${inputBase}.pdf`);
            const targetPdfPath = path.join(outputDir, expectedPdfName);

            if (fs.existsSync(generatedPdfPath)) {
                if (generatedPdfPath !== targetPdfPath) {
                    await fs.promises.rename(generatedPdfPath, targetPdfPath);
                }
                return targetPdfPath;
            }

            throw new Error(`LibreOffice conversion completed but expected output PDF not found.`);
        } finally {
            // Clean up temporary profile directory
            try {
                if (fs.existsSync(uniqueProfileDir)) {
                    await fs.promises.rm(uniqueProfileDir, { recursive: true, force: true });
                }
            } catch (err) {
                // Ignore profile cleanup errors
            }
        }
    }

    async extractSelectedPages(
        sourcePdfPath: string,
        targetPdfPath: string,
        selectedPages: number[]
    ): Promise<void> {
        const sourceBytes = await fs.promises.readFile(sourcePdfPath);
        const sourcePdf = await PDFDocument.load(sourceBytes);
        const outputPdf = await PDFDocument.create();

        // 1-based to 0-based indexing
        const pageIndices = selectedPages.map((p) => p - 1);
        const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndices);

        for (const page of copiedPages) {
            outputPdf.addPage(page);
        }

        const outputBytes = await outputPdf.save();
        await fs.promises.writeFile(targetPdfPath, outputBytes);
    }
}

const documentProcessingService = new DocumentProcessingService();
export default documentProcessingService;
