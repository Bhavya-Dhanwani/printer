// Importing modules
import DocumentModel, { IDocument } from "../models/document.model.js";

class DocumentDao {
    model: typeof DocumentModel;

    constructor() {
        this.model = DocumentModel;
    }

    async createDocument(data: Partial<IDocument>) {
        return await this.model.create(data);
    }

    async findById(id: string) {
        return await this.model.findById(id);
    }

    async updateById(id: string, updateData: Partial<IDocument>) {
        return await this.model.findByIdAndUpdate(id, updateData, { returnDocument: "after" });
    }

    async findExpiredDocuments(now: Date = new Date()) {
        return await this.model.find({
            expiresAt: { $lte: now },
            status: { $nin: ["DELETED"] },
        });
    }

    async deleteById(id: string) {
        return await this.model.findByIdAndDelete(id);
    }
}

export default DocumentDao;
