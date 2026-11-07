// Importing modules
import { Response } from "express";
import crypto from "node:crypto";
import {
    RegisterPrinterRequest,
    PrinterParamRequest,
    RegisterAgentRequest,
    AgentHeartbeatRequest,
} from "./printers.types.js";
import PrinterDao from "../../../shared/dao/printer.dao.js";
import AgentDao from "../../../shared/dao/agent.dao.js";
import NotFound from "../../../shared/errors/NotFound.error.js";
import Created from "../../../shared/responses/Created.response.js";
import Ok from "../../../shared/responses/Ok.response.js";
import env from "../../../shared/config/env.config.js";
import { hashPassword } from "../../../shared/utils/hashing.util.js";

class PrintersController {
    printerDao: PrinterDao;
    agentDao: AgentDao;

    constructor() {
        this.printerDao = new PrinterDao();
        this.agentDao = new AgentDao();
    }

    register = async (req: RegisterPrinterRequest, res: Response) => {
        const { name, model, connectionType, agentId, capabilities } = req.body;

        const agent = await this.agentDao.findById(agentId);
        if (!agent) {
            throw new NotFound("Printer agent not found");
        }

        const printer = await this.printerDao.createOrUpdatePrinter(
            agent.shopId.toString(),
            name,
            {
                model,
                connectionType: connectionType || "USB",
                agentId: agent._id,
                status: "ONLINE",
                capabilities: {
                    color: Boolean(capabilities?.color),
                    duplex: Boolean(capabilities?.duplex),
                    supportedPaperSizes: capabilities?.supportedPaperSizes || ["A4"],
                },
                lastHeartbeatAt: new Date(),
            }
        );

        return Ok(res, "Printer registered successfully", {
            printerId: printer?._id.toString(),
            status: "ONLINE",
        });
    };

    getStatus = async (req: PrinterParamRequest, res: Response) => {
        const { printerId } = req.params;
        const printer = await this.printerDao.findById(printerId);

        if (!printer) {
            throw new NotFound("Printer not found");
        }

        const agentDoc: any = printer.agentId;
        const now = Date.now();
        const lastHeartbeat = printer.lastHeartbeatAt ? new Date(printer.lastHeartbeatAt).getTime() : 0;
        const isStale = now - lastHeartbeat > env.PRINTER_AGENT_OFFLINE_THRESHOLD_MS;

        const printerStatus = isStale ? "OFFLINE" : printer.status;
        const agentStatus = isStale ? "DISCONNECTED" : (agentDoc?.status || "CONNECTED");

        return Ok(res, "Printer status retrieved", {
            printerId: printer._id.toString(),
            status: printerStatus,
            agentStatus,
            lastHeartbeatAt: printer.lastHeartbeatAt,
        });
    };

    registerAgent = async (req: RegisterAgentRequest, res: Response) => {
        const { shopId, deviceName, version } = req.body;

        const rawDeviceToken = crypto.randomBytes(32).toString("hex");
        const deviceTokenHash = await hashPassword(rawDeviceToken);

        const agent = await this.agentDao.createAgent({
            shopId: shopId as any,
            deviceName,
            deviceTokenHash,
            status: "DISCONNECTED",
            version: version || "1.0.0",
        });

        return Created(res, "Printer agent registered successfully", {
            agentId: agent._id.toString(),
            deviceToken: rawDeviceToken,
            shopId,
            deviceName,
        });
    };

    heartbeat = async (req: AgentHeartbeatRequest, res: Response) => {
        const { agentId, printers } = req.body;
        const agent = await this.agentDao.findById(agentId);

        if (!agent) {
            throw new NotFound("Agent not found");
        }

        const now = new Date();
        await this.agentDao.updateById(agentId, {
            status: "CONNECTED",
            lastHeartbeatAt: now,
        });

        if (Array.isArray(printers)) {
            for (const p of printers) {
                if (p.printerId) {
                    await this.printerDao.updateById(p.printerId, {
                        status: p.status || "ONLINE",
                        lastHeartbeatAt: now,
                    });
                }
            }
        }

        return Ok(res, "Heartbeat acknowledged", {
            agentId,
            timestamp: now.toISOString(),
        });
    };
}

export default PrintersController;
