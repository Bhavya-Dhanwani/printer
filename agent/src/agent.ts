// Importing modules
import { io, Socket } from "socket.io-client";
import { agentConfig } from "./config.js";
import { discoverPrinters } from "./printerDiscovery.js";
import { printExecutor, IPrintJobPayload } from "./printExecutor.js";

class PrinterAgent {
    socket: Socket | null = null;
    heartbeatTimer: NodeJS.Timeout | null = null;
    processedJobIds: Set<string> = new Set();
    registeredPrinters: Map<string, string> = new Map(); // printerName -> printerId

    async start(): Promise<void> {
        console.log(`[PrinterAgent] Starting agent for shop: ${agentConfig.SHOP_ID || "Default"}`);
        console.log(`[PrinterAgent] Connecting to backend at: ${agentConfig.BACKEND_URL}`);

        this.socket = io(agentConfig.BACKEND_URL, {
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            randomizationFactor: 0.5,
        });

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        if (!this.socket) return;

        this.socket.on("connect", () => {
            console.log(`[PrinterAgent] Connected to backend on socket: ${this.socket?.id}`);
            this.authenticate();
        });

        this.socket.on("agent:authenticated", async (data: any) => {
            console.log("[PrinterAgent] Authenticated successfully with backend.", data);
            await this.registerLocalPrinters();
            this.startHeartbeat();
        });

        this.socket.on("agent:error", (err: any) => {
            console.error("[PrinterAgent] Server error:", err?.message || err);
        });

        this.socket.on("printer:registered", (data: any) => {
            console.log(`[PrinterAgent] Printer registered with backend: ${data.name} (ID: ${data.printerId})`);
            this.registeredPrinters.set(data.name, data.printerId);
        });

        this.socket.on("print:job:available", async (payload: IPrintJobPayload) => {
            await this.handlePrintJob(payload);
        });

        this.socket.on("disconnect", (reason: string) => {
            console.warn(`[PrinterAgent] Disconnected from backend: ${reason}`);
            this.stopHeartbeat();
        });
    }

    private authenticate(): void {
        if (!agentConfig.AGENT_ID || !agentConfig.DEVICE_TOKEN) {
            console.warn("[PrinterAgent] AGENT_ID or DEVICE_TOKEN not configured. Please register agent first.");
            return;
        }

        this.socket?.emit("agent:authenticate", {
            agentId: agentConfig.AGENT_ID,
            deviceToken: agentConfig.DEVICE_TOKEN,
        });
    }

    private async registerLocalPrinters(): Promise<void> {
        const printers = await discoverPrinters();
        console.log(`[PrinterAgent] Discovered ${printers.length} local printer(s).`);

        for (const p of printers) {
            this.socket?.emit("printer:register", {
                name: p.name,
                model: p.model,
                connectionType: p.connectionType,
                capabilities: p.capabilities,
            });
        }
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            const printersList = Array.from(this.registeredPrinters.entries()).map(([_, printerId]) => ({
                printerId,
                status: "ONLINE" as const,
            }));

            this.socket?.emit("agent:heartbeat", {
                agentId: agentConfig.AGENT_ID,
                status: "CONNECTED",
                printers: printersList,
            });
        }, agentConfig.HEARTBEAT_INTERVAL_MS);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private async handlePrintJob(payload: IPrintJobPayload): Promise<void> {
        const { jobId } = payload;

        // Duplicate-print protection
        if (this.processedJobIds.has(jobId)) {
            console.warn(`[PrinterAgent] Ignoring duplicate print job notification: ${jobId}`);
            return;
        }

        console.log(`[PrinterAgent] Received print job: ${jobId} for printer: ${payload.printerName}`);
        this.processedJobIds.add(jobId);

        // Acknowledge acceptance
        this.socket?.emit("print:job:accepted", { jobId });

        try {
            await printExecutor.executePrint(payload, async (status, data) => {
                if (status === "PRINTING") {
                    this.socket?.emit("print:job:started", { jobId });
                } else if (status === "SUBMITTED_TO_SPOOLER") {
                    this.socket?.emit("print:job:submitted", {
                        jobId,
                        spoolerJobId: data?.spoolerJobId,
                    });
                } else if (status === "COMPLETED") {
                    this.socket?.emit("print:job:completed", { jobId });
                }
            });

            console.log(`[PrinterAgent] Print job finished successfully: ${jobId}`);
        } catch (error: any) {
            console.error(`[PrinterAgent] Print job failed: ${jobId}`, error?.message || error);
            this.socket?.emit("print:job:failed", {
                jobId,
                reason: error?.message || "Execution error during printing",
            });
        }
    }
}

const agent = new PrinterAgent();
agent.start().catch((err) => {
    console.error("[PrinterAgent] Fatal startup error:", err);
});
