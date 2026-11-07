// Importing modules
import PrintJobModel, { IPrintJob } from "../models/printJob.model.js";

class PrintJobDao {
    model: typeof PrintJobModel;

    constructor() {
        this.model = PrintJobModel;
    }

    async createPrintJob(data: Partial<IPrintJob>) {
        return await this.model.create(data);
    }

    async findById(id: string) {
        return await this.model.findById(id).populate("documentId").populate("printerId");
    }

    async findByIdempotencyKey(key: string) {
        return await this.model.findOne({ idempotencyKey: key });
    }

    async updateById(id: string, updateData: Partial<IPrintJob>) {
        return await this.model.findByIdAndUpdate(id, updateData, { returnDocument: "after" });
    }

    async findActiveJobsByDocumentId(documentId: string) {
        return await this.model.find({
            documentId,
            printStatus: { $in: ["CREATED", "PAYMENT_PENDING", "PAID", "QUEUED", "DISPATCHING", "ACCEPTED_BY_AGENT", "PRINTING", "SUBMITTED_TO_PRINTER"] },
        });
    }

    async findCompletedJobsForCleanup(cutoffDate: Date) {
        return await this.model.find({
            printStatus: { $in: ["COMPLETED", "FAILED", "CANCELLED"] },
            updatedAt: { $lte: cutoffDate },
        });
    }
}

export default PrintJobDao;
