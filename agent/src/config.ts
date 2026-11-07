// Importing modules
import { config } from "dotenv";
import z from "zod";
import path from "node:path";
import fs from "node:fs";

config();

const agentConfigSchema = z.object({
    BACKEND_URL: z.string().url().default("http://localhost:5000"),
    SHOP_ID: z.string().default(""),
    AGENT_ID: z.string().default(""),
    DEVICE_TOKEN: z.string().default(""),
    DEVICE_NAME: z.string().default("Shop-Desktop-Printer-Agent"),
    HEARTBEAT_INTERVAL_MS: z.coerce.number().default(20000),
    SUMATRA_PDF_PATH: z.string().default(""),
    TEMP_STORAGE_PATH: z.string().default("./storage/agent-temp"),
});

const parsed = agentConfigSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("Agent configuration invalid:", parsed.error.format());
    process.exit(1);
}

export const agentConfig = parsed.data;

const resolvedTemp = path.resolve(agentConfig.TEMP_STORAGE_PATH);
if (!fs.existsSync(resolvedTemp)) {
    fs.mkdirSync(resolvedTemp, { recursive: true });
}
