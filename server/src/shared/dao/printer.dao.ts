// Importing modules
import PrinterModel, { IPrinter } from "../models/printer.model.js";

class PrinterDao {
    model: typeof PrinterModel;

    constructor() {
        this.model = PrinterModel;
    }

    async createOrUpdatePrinter(shopId: string, name: string, data: Partial<IPrinter>) {
        return await this.model.findOneAndUpdate(
            { shopId, name },
            { $set: data },
            { upsert: true, returnDocument: "after" }
        );
    }

    async findById(id: string) {
        return await this.model.findById(id).populate("agentId");
    }

    async findByShopAndName(shopId: string, name: string) {
        return await this.model.findOne({ shopId, name });
    }

    async findByAgentId(agentId: string) {
        return await this.model.find({ agentId });
    }

    async updateById(id: string, updateData: Partial<IPrinter>) {
        return await this.model.findByIdAndUpdate(id, updateData, { returnDocument: "after" });
    }

    async markPrintersOfflineByAgentId(agentId: string) {
        return await this.model.updateMany(
            { agentId },
            { $set: { status: "OFFLINE" } }
        );
    }
}

export default PrinterDao;
