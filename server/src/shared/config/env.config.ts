// Importing modules
import { config } from "dotenv";
import z from "zod";
import envConstants from "../constants/env.constants.js";

// loading environment variables
config();

// defining the schema for environment variables
const envSchema = z.object({
    PORT: z.coerce.number().default(envConstants.PORT),
    NODE_ENV: z.enum(["development", "production", "test"]).default(envConstants.NODE_ENV),
    MONGO_URI: z.string().default(envConstants.MONGO_URI),
    CORS_ORIGIN: z.string().default(envConstants.CORS_ORIGIN),
    ACCESS_TOKEN_SECRET: z.string().default(envConstants.ACCESS_TOKEN_SECRET),
    REFRESH_TOKEN_SECRET: z.string().default(envConstants.REFRESH_TOKEN_SECRET),
    SMTP_HOST: z.string().default(envConstants.SMTP_HOST),
    SMTP_PORT: z.coerce.number().default(envConstants.SMTP_PORT),
    SMTP_USER: z.string().default(envConstants.SMTP_USER),
    SMTP_PASS: z.string().default(envConstants.SMTP_PASS),
    SENDING_USER: z.string().default(envConstants.SENDING_USER),
    SEND_MAIL: z.preprocess((val) => {
        if (typeof val === "string") return val.toLowerCase() === "true";
        return val;
    }, z.boolean()).default(envConstants.SEND_MAIL),
    GOOGLE_CLIENT_ID: z.string().default(envConstants.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: z.string().default(envConstants.GOOGLE_CLIENT_SECRET),
    GOOGLE_REDIRECT_URI: z.string().url().default(envConstants.GOOGLE_REDIRECT_URI),
    FRONTEND_URL: z.string().default(envConstants.FRONTEND_URL),

    REDIS_URL: z.string().default(envConstants.REDIS_URL),

    RAZORPAY_KEY_ID: z.string().default(envConstants.RAZORPAY_KEY_ID),
    RAZORPAY_KEY_SECRET: z.string().default(envConstants.RAZORPAY_KEY_SECRET),
    RAZORPAY_WEBHOOK_SECRET: z.string().default(envConstants.RAZORPAY_WEBHOOK_SECRET),

    TEMP_STORAGE_PATH: z.string().default(envConstants.TEMP_STORAGE_PATH),
    ORIGINAL_STORAGE_PATH: z.string().default(envConstants.ORIGINAL_STORAGE_PATH),
    PROCESSED_STORAGE_PATH: z.string().default(envConstants.PROCESSED_STORAGE_PATH),
    PRINT_STORAGE_PATH: z.string().default(envConstants.PRINT_STORAGE_PATH),

    MAX_UPLOAD_SIZE_MB: z.coerce.number().default(envConstants.MAX_UPLOAD_SIZE_MB),
    MAX_DOCUMENT_PAGES: z.coerce.number().default(envConstants.MAX_DOCUMENT_PAGES),
    DOCUMENT_RETENTION_MINUTES: z.coerce.number().default(envConstants.DOCUMENT_RETENTION_MINUTES),
    COMPLETED_JOB_RETENTION_MINUTES: z.coerce.number().default(envConstants.COMPLETED_JOB_RETENTION_MINUTES),
    MAX_CONCURRENT_CONVERSIONS: z.coerce.number().default(envConstants.MAX_CONCURRENT_CONVERSIONS),
    MAX_CONCURRENT_PRINT_JOBS: z.coerce.number().default(envConstants.MAX_CONCURRENT_PRINT_JOBS),
    DOCUMENT_PROCESSING_TIMEOUT_MS: z.coerce.number().default(envConstants.DOCUMENT_PROCESSING_TIMEOUT_MS),
    PRINTER_AGENT_HEARTBEAT_INTERVAL_MS: z.coerce.number().default(envConstants.PRINTER_AGENT_HEARTBEAT_INTERVAL_MS),
    PRINTER_AGENT_OFFLINE_THRESHOLD_MS: z.coerce.number().default(envConstants.PRINTER_AGENT_OFFLINE_THRESHOLD_MS),

    SUMATRA_PDF_PATH: z.string().default(envConstants.SUMATRA_PDF_PATH),
    LIBREOFFICE_PATH: z.string().default(envConstants.LIBREOFFICE_PATH),
});

// parsing and validating environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error("Invalid environment variables:", parsedEnv.error.format());
    process.exit(1);
}

// getting the validated environment variables
const env = parsedEnv.data;

export default env;
