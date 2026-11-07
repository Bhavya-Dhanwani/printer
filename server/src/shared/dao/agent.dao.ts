// Importing modules
import AgentModel, { IAgent } from "../models/agent.model.js";

class AgentDao {
    model: typeof AgentModel;

    constructor() {
        this.model = AgentModel;
    }

    async createAgent(data: Partial<IAgent>) {
        return await this.model.create(data);
    }

    async findById(id: string) {
        return await this.model.findById(id);
    }

    async findByIdWithToken(id: string) {
        return await this.model.findById(id).select("+deviceTokenHash");
    }

    async findByShopAndDevice(shopId: string, deviceName: string) {
        return await this.model.findOne({ shopId, deviceName }).select("+deviceTokenHash");
    }

    async updateById(id: string, updateData: Partial<IAgent>) {
        return await this.model.findByIdAndUpdate(id, updateData, { returnDocument: "after" });
    }
}

export default AgentDao;
