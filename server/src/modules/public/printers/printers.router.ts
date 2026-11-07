// Importing modules
import express from "express";
import PrintersController from "./printers.controller.js";
import {
    registerPrinterValidators,
    printerParamValidators,
    registerAgentValidators,
    agentHeartbeatValidators,
} from "./printers.validator.js";
import {
    printerRegisterLimiter,
    printerStatusLimiter,
    agentRegisterLimiter,
    agentAuthLimiter,
} from "../../../shared/middlewares/rateLimit.middleware.js";

const router = express.Router();
const controller = new PrintersController();

/*
    @route POST /api/printers/register
    @desc Register a physical printer
    @access Public / Agent
*/
router.post(
    "/register",
    printerRegisterLimiter,
    registerPrinterValidators,
    controller.register
);

/*
    @route GET /api/printers/:printerId/status
    @desc Get printer status and heartbeat information
    @access Public
*/
router.get(
    "/:printerId/status",
    printerStatusLimiter,
    printerParamValidators,
    controller.getStatus
);

/*
    @route POST /api/printers/agent/register
    @desc Register a new printer agent device
    @access Public / Shop Owner
*/
router.post(
    "/agent/register",
    agentRegisterLimiter,
    registerAgentValidators,
    controller.registerAgent
);

/*
    @route POST /api/printers/agent/heartbeat
    @desc Agent heartbeat endpoint
    @access Agent
*/
router.post(
    "/agent/heartbeat",
    agentAuthLimiter,
    agentHeartbeatValidators,
    controller.heartbeat
);

export default router;
