// Importing modules
import rateLimit, { Options } from "express-rate-limit";
import { Request, Response } from "express";

function createCustomLimiter(windowMinutes: number, maxRequests: number, message: string = "Too many requests") {
    return rateLimit({
        windowMs: windowMinutes * 60 * 1000,
        limit: maxRequests,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req: Request) => {
            const user = (req as any).user;
            if (user && user._id) {
                return `user_${user._id}`;
            }
            // Fallback to IP address
            return req.ip || req.socket.remoteAddress || "anonymous";
        },
        handler: (req: Request, res: Response, _next, options: Options) => {
            const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
            res.setHeader("Retry-After", retryAfterSeconds);
            res.status(429).json({
                success: false,
                message,
                error: {
                    code: "RATE_LIMIT_EXCEEDED",
                    retryAfterSeconds,
                },
            });
        },
    });
}

export const uploadRateLimiter = createCustomLimiter(15, 10, "Upload rate limit exceeded");
export const documentStatusLimiter = createCustomLimiter(1, 60, "Document status rate limit exceeded");
export const documentPreviewLimiter = createCustomLimiter(1, 30, "Document preview rate limit exceeded");
export const documentContentLimiter = createCustomLimiter(1, 30, "Document content rate limit exceeded");
export const quoteRateLimiter = createCustomLimiter(1, 20, "Quote rate limit exceeded");
export const createPrintJobLimiter = createCustomLimiter(15, 10, "Create print job rate limit exceeded");
export const createPaymentLimiter = createCustomLimiter(15, 5, "Payment creation rate limit exceeded");
export const printJobStatusLimiter = createCustomLimiter(1, 60, "Print job status rate limit exceeded");
export const printJobEventsLimiter = createCustomLimiter(1, 30, "Print job events rate limit exceeded");
export const printerRegisterLimiter = createCustomLimiter(15, 10, "Printer registration rate limit exceeded");
export const printerStatusLimiter = createCustomLimiter(1, 60, "Printer status rate limit exceeded");
export const cancelJobLimiter = createCustomLimiter(15, 5, "Cancel print job rate limit exceeded");
export const agentRegisterLimiter = createCustomLimiter(15, 5, "Agent registration rate limit exceeded");
export const agentAuthLimiter = createCustomLimiter(15, 10, "Agent authentication rate limit exceeded");
