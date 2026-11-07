// Importing modules
import PrintJobEventModel, { IPrintJobEvent } from "../models/printJobEvent.model.js";

class PrintJobEventDao {
    model: typeof PrintJobEventModel;

    constructor() {
        this.model = PrintJobEventModel;
    }

    async logEvent(data: {
        printJobId: string;
        event: string;
        previousStatus?: string;
        newStatus: string;
        message?: string;
        agentId?: string;
        metadata?: Record<string, unknown>;
    }) {
        return await this.model.create(data);
    }

    async findByJobId(printJobId: string) {
        return await this.model.find({ printJobId }).sort({ createdAt: 1 });
    }
}

export default PrintJobEventDao;
