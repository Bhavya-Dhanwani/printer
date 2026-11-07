// Importing modules
import { execa } from "execa";
import os from "node:os";

export interface IDiscoveredPrinter {
    name: string;
    model: string;
    connectionType: "USB" | "NETWORK";
    status: "ONLINE" | "OFFLINE";
    capabilities: {
        color: boolean;
        duplex: boolean;
        supportedPaperSizes: string[];
    };
}

export async function discoverPrinters(): Promise<IDiscoveredPrinter[]> {
    if (os.platform() !== "win32") {
        // Fallback for non-Windows development
        return [
            {
                name: "Virtual-Default-Printer",
                model: "Generic Virtual Document Writer",
                connectionType: "USB",
                status: "ONLINE",
                capabilities: {
                    color: true,
                    duplex: true,
                    supportedPaperSizes: ["A4", "A3", "LETTER"],
                },
            },
        ];
    }

    try {
        // Run PowerShell Get-Printer
        const { stdout } = await execa("powershell", [
            "-NoProfile",
            "-Command",
            "Get-Printer | Select-Object Name, Type, DriverName, PortName | ConvertTo-Json -Compress",
        ]);

        if (!stdout || stdout.trim() === "") {
            return [];
        }

        const raw = JSON.parse(stdout);
        const printersArray = Array.isArray(raw) ? raw : [raw];

        return printersArray.map((p: any) => {
            const port = (p.PortName || "").toLowerCase();
            const connectionType: "USB" | "NETWORK" =
                port.includes("usb") || port.includes("dot4") ? "USB" : "NETWORK";

            return {
                name: p.Name || "Unnamed Printer",
                model: p.DriverName || "Generic Printer",
                connectionType,
                status: "ONLINE",
                capabilities: {
                    color: true, // Auto-discoverable or true by default
                    duplex: true,
                    supportedPaperSizes: ["A4", "A3", "A5", "LETTER"],
                },
            };
        });
    } catch (err) {
        console.warn("Failed to discover Windows printers via PowerShell:", err);
        return [
            {
                name: "Default Windows Printer",
                model: "Generic Driver",
                connectionType: "USB",
                status: "ONLINE",
                capabilities: {
                    color: true,
                    duplex: true,
                    supportedPaperSizes: ["A4", "LETTER"],
                },
            },
        ];
    }
}
