// Importing modules
import { Server as HttpServer } from "node:http";
import { Server as SocketIOServer, Socket } from "socket.io";
import crypto from "node:crypto";
import logger from "../config/logger.config.js";
import AgentDao from "../dao/agent.dao.js";
import PrinterDao from "../dao/printer.dao.js";
import PrintJobDao from "../dao/printJob.dao.js";
import PrintJobEventDao from "../dao/printJobEvent.dao.js";
import { comparePassword } from "../utils/hashing.util.js";

interface AuthenticatedSocket extends Socket {
    agentId?: string;
    shopId?: string;
}

class SocketService {
    io: SocketIOServer | null = null;
    agentDao: AgentDao;
    printerDao: PrinterDao;
    printJobDao: PrintJobDao;
    eventDao: PrintJobEventDao;

    // Track active connected agents: agentId -> socketId
    activeAgents: Map<string, string> = new Map();

    constructor() {
        this.agentDao = new AgentDao();
        this.printerDao = new PrinterDao();
        this.printJobDao = new PrintJobDao();
        this.eventDao = new PrintJobEventDao();
    }

    init(server: HttpServer): void {
        this.io = new SocketIOServer(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
            },
            maxHttpBufferSize: 1e6, // 1MB
        });

        this.io.on("connection", (socket: AuthenticatedSocket) => {
            logger.info(`Socket connected: ${socket.id}`);

            // Agent authentication
            socket.on("agent:authenticate", async (data: { agentId: string; deviceToken: string }) => {
                try {
                    const { agentId, deviceToken } = data;
                    if (!agentId || !deviceToken) {
                        socket.emit("agent:error", { message: "agentId and deviceToken are required" });
                        return;
                    }

                    const agent = await this.agentDao.findByIdWithToken(agentId);
                    if (!agent) {
                        socket.emit("agent:error", { message: "Invalid agent credentials" });
                        return;
                    }

                    const isValid = await comparePassword(deviceToken, agent.deviceTokenHash);
                    if (!isValid) {
                        socket.emit("agent:error", { message: "Authentication failed" });
                        return;
                    }

                    socket.agentId = agent._id.toString();
                    socket.shopId = agent.shopId.toString();
                    this.activeAgents.set(socket.agentId, socket.id);

                    await this.agentDao.updateById(socket.agentId, {
                        status: "CONNECTED",
                        lastHeartbeatAt: new Date(),
                    });

                    socket.emit("agent:authenticated", {
                        agentId: socket.agentId,
                        shopId: socket.shopId,
                        message: "Successfully authenticated",
                    });

                    logger.info(`Agent authenticated: ${socket.agentId} on socket ${socket.id}`);
                } catch (error: any) {
                    logger.error({ error: error?.message }, "Agent authentication error");
                    socket.emit("agent:error", { message: "Internal server error during authentication" });
                }
            });

            // Agent heartbeat
            socket.on("agent:heartbeat", async (data: { agentId?: string; printers?: Array<{ printerId: string; status: "ONLINE" | "OFFLINE" | "BUSY" | "ERROR" }> }) => {
                if (!socket.agentId) return;

                const now = new Date();
                await this.agentDao.updateById(socket.agentId, {
                    lastHeartbeatAt: now,
                    status: "CONNECTED",
                });

                if (Array.isArray(data?.printers)) {
                    for (const p of data.printers) {
                        if (p.printerId) {
                            await this.printerDao.updateById(p.printerId, {
                                status: p.status || "ONLINE",
                                lastHeartbeatAt: now,
                            });
                        }
                    }
                }

                socket.emit("agent:heartbeat:ack", { timestamp: now.toISOString() });
            });

            // Printer registration from agent
            socket.on("printer:register", async (data: { name: string; model?: string; connectionType?: "USB" | "NETWORK"; capabilities?: { color: boolean; duplex: boolean; supportedPaperSizes: string[] } }) => {
                if (!socket.agentId || !socket.shopId) {
                    socket.emit("agent:error", { message: "Unauthorized: Please authenticate first" });
                    return;
                }

                try {
                    const printer = await this.printerDao.createOrUpdatePrinter(
                        socket.shopId,
                        data.name,
                        {
                            model: data.model,
                            connectionType: data.connectionType || "USB",
                            agentId: socket.agentId as any,
                            status: "ONLINE",
                            capabilities: {
                                color: Boolean(data.capabilities?.color),
                                duplex: Boolean(data.capabilities?.duplex),
                                supportedPaperSizes: data.capabilities?.supportedPaperSizes || ["A4"],
                            },
                            lastHeartbeatAt: new Date(),
                        }
                    );

                    socket.emit("printer:registered", {
                        printerId: printer?._id.toString(),
                        name: printer?.name,
                        status: printer?.status,
                    });
                } catch (err: any) {
                    socket.emit("agent:error", { message: err?.message || "Printer registration failed" });
                }
            });

            // Print Job progress callbacks from agent
            socket.on("print:job:accepted", async (data: { jobId: string }) => {
                if (!socket.agentId) return;
                await this.updateJobStatus(data.jobId, "ACCEPTED_BY_AGENT", "Print job accepted by agent", socket.agentId);
            });

            socket.on("print:job:started", async (data: { jobId: string }) => {
                if (!socket.agentId) return;
                await this.updateJobStatus(data.jobId, "PRINTING", "Print job execution started", socket.agentId);
            });

            socket.on("print:job:submitted", async (data: { jobId: string; spoolerJobId?: number }) => {
                if (!socket.agentId) return;
                await this.updateJobStatus(
                    data.jobId,
                    "SUBMITTED_TO_PRINTER",
                    "Print job submitted to Windows spooler",
                    socket.agentId,
                    { spoolerJobId: data.spoolerJobId }
                );
            });

            socket.on("print:job:completed", async (data: { jobId: string }) => {
                if (!socket.agentId) return;
                await this.updateJobStatus(data.jobId, "COMPLETED", "Physical printing confirmed completed", socket.agentId);
            });

            socket.on("print:job:failed", async (data: { jobId: string; reason?: string }) => {
                if (!socket.agentId) return;
                await this.updateJobStatus(
                    data.jobId,
                    "FAILED",
                    `Printing failed: ${data.reason || "Unknown agent error"}`,
                    socket.agentId,
                    { reason: data.reason }
                );
            });

            // Disconnect handling
            socket.on("disconnect", async () => {
                if (socket.agentId) {
                    logger.info(`Agent disconnected: ${socket.agentId}`);
                    this.activeAgents.delete(socket.agentId);

                    await this.agentDao.updateById(socket.agentId, {
                        status: "DISCONNECTED",
                    });

                    // Mark printers associated with this agent as OFFLINE
                    await this.printerDao.markPrintersOfflineByAgentId(socket.agentId);
                }
            });
        });
    }

    private async updateJobStatus(
        jobId: string,
        status: any,
        message: string,
        agentId: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        const job = await this.printJobDao.findById(jobId);
        if (!job) return;

        const previousStatus = job.printStatus;
        await this.printJobDao.updateById(jobId, { printStatus: status });

        await this.eventDao.logEvent({
            printJobId: jobId,
            event: `STATUS_${status}`,
            previousStatus,
            newStatus: status,
            message,
            agentId,
            metadata,
        });
    }

    isAgentConnected(agentId: string): boolean {
        return this.activeAgents.has(agentId);
    }

    async dispatchJobToAgent(agentId: string, payload: {
        jobId: string;
        printerId: string;
        printerName: string;
        downloadUrl: string;
        checksumSha256?: string;
        settings: any;
    }): Promise<boolean> {
        const socketId = this.activeAgents.get(agentId);
        if (!socketId || !this.io) {
            return false;
        }

        this.io.to(socketId).emit("print:job:available", payload);
        return true;
    }
}

const socketService = new SocketService();
export default socketService;
