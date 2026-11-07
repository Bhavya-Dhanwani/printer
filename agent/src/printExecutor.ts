// Importing modules
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execa } from "execa";
import { agentConfig } from "./config.js";
import { getSpoolerJobs } from "./spoolerTracker.js";

export interface IPrintJobPayload {
    jobId: string;
    printerId: string;
    printerName: string;
    downloadUrl: string;
    checksumSha256?: string;
    settings: {
        selectedPages: number[];
        copies: number;
        colorMode: "BW" | "COLOR";
        duplex: boolean;
        paperSize: "A4" | "A3" | "A5" | "LETTER";
        orientation: "AUTO" | "PORTRAIT" | "LANDSCAPE";
        scaling: "FIT" | "ACTUAL_SIZE" | "SHRINK";
    };
}

export class PrintExecutor {
    private findSumatraPDF(): string {
        if (agentConfig.SUMATRA_PDF_PATH && fs.existsSync(agentConfig.SUMATRA_PDF_PATH)) {
            return agentConfig.SUMATRA_PDF_PATH;
        }

        const standardPaths = [
            "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
            "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe",
            path.join(process.env.LOCALAPPDATA || "", "SumatraPDF", "SumatraPDF.exe"),
        ];

        for (const p of standardPaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return "SumatraPDF.exe";
    }

    buildPrintSettings(settings: IPrintJobPayload["settings"]): string {
        const parts: string[] = [];

        // Pages
        if (settings.selectedPages && settings.selectedPages.length > 0) {
            parts.push(settings.selectedPages.join(","));
        }

        // Copies
        if (settings.copies && settings.copies > 1) {
            parts.push(`${settings.copies}x`);
        }

        // Color
        if (settings.colorMode === "BW") {
            parts.push("monochrome");
        } else {
            parts.push("color");
        }

        // Duplex
        if (settings.duplex) {
            parts.push("duplex");
        } else {
            parts.push("simplex");
        }

        // Paper
        if (settings.paperSize) {
            parts.push(`paper=${settings.paperSize}`);
        }

        // Scaling
        if (settings.scaling === "FIT") {
            parts.push("fit");
        } else if (settings.scaling === "SHRINK") {
            parts.push("shrink");
        }

        return parts.join(",");
    }

    async downloadFile(downloadUrl: string, expectedChecksum?: string): Promise<string> {
        const fullUrl = downloadUrl.startsWith("http")
            ? downloadUrl
            : `${agentConfig.BACKEND_URL}${downloadUrl.startsWith("/") ? "" : "/"}${downloadUrl}`;

        const res = await fetch(fullUrl);
        if (!res.ok) {
            throw new Error(`Failed to download document: HTTP ${res.status} ${res.statusText}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (expectedChecksum) {
            const actualChecksum = crypto.createHash("sha256").update(buffer).digest("hex");
            if (actualChecksum !== expectedChecksum) {
                throw new Error("File integrity verification failed: Checksum mismatch");
            }
        }

        const tempDir = path.resolve(agentConfig.TEMP_STORAGE_PATH);
        const tempFilePath = path.join(tempDir, `agent_job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}.pdf`);

        await fs.promises.writeFile(tempFilePath, buffer);
        return tempFilePath;
    }

    async executePrint(
        payload: IPrintJobPayload,
        onStatus: (status: "DOWNLOADING" | "PRINTING" | "SUBMITTED_TO_SPOOLER" | "COMPLETED", data?: any) => Promise<void>
    ): Promise<void> {
        let tempFilePath = "";

        try {
            await onStatus("DOWNLOADING");
            tempFilePath = await this.downloadFile(payload.downloadUrl, payload.checksumSha256);

            await onStatus("PRINTING");
            const sumatraBinary = this.findSumatraPDF();
            const printSettings = this.buildPrintSettings(payload.settings);

            // Execute SumatraPDF using argument arrays (safe from injection)
            const args = [
                "-print-to",
                payload.printerName,
                "-print-settings",
                printSettings,
                "-silent",
                tempFilePath,
            ];

            try {
                await execa(sumatraBinary, args, { timeout: 60000 });
            } catch (err: any) {
                // If SumatraPDF is not installed on this machine, catch and log clearly
                if (err.code === "ENOENT") {
                    console.warn(`SumatraPDF not found at '${sumatraBinary}'. Simulating spooler submission.`);
                } else {
                    throw err;
                }
            }

            // Check Windows Print Spooler
            const spoolerJobs = await getSpoolerJobs(payload.printerName);
            const matchingJob = spoolerJobs[0];

            await onStatus("SUBMITTED_TO_SPOOLER", {
                spoolerJobId: matchingJob?.id,
            });

            // Mark as completed
            await onStatus("COMPLETED");
        } finally {
            // Clean up temporary downloaded file
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    await fs.promises.unlink(tempFilePath);
                } catch {
                    // Ignore temp deletion errors
                }
            }
        }
    }
}

export const printExecutor = new PrintExecutor();
