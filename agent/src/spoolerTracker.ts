// Importing modules
import { execa } from "execa";
import os from "node:os";

export interface ISpoolerJob {
    id: number;
    printerName: string;
    jobStatus: string;
    documentName: string;
    totalPages: number;
}

export async function getSpoolerJobs(printerName: string): Promise<ISpoolerJob[]> {
    if (os.platform() !== "win32") {
        return [];
    }

    try {
        const { stdout } = await execa("powershell", [
            "-NoProfile",
            "-Command",
            `Get-PrintJob -PrinterName "${printerName.replace(/"/g, '`"')}" | Select-Object Id, PrinterName, JobStatus, DocumentName, TotalPages | ConvertTo-Json -Compress`,
        ]);

        if (!stdout || stdout.trim() === "") {
            return [];
        }

        const raw = JSON.parse(stdout);
        const jobs = Array.isArray(raw) ? raw : [raw];

        return jobs.map((j: any) => ({
            id: Number(j.Id),
            printerName: j.PrinterName || printerName,
            jobStatus: j.JobStatus || "Printing",
            documentName: j.DocumentName || "",
            totalPages: Number(j.TotalPages) || 1,
        }));
    } catch {
        // Printer queue may be empty or command not supported
        return [];
    }
}
