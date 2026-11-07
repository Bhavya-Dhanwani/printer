// Importing modules
import QuoteModel, { IQuote } from "../models/quote.model.js";

class QuoteDao {
    model: typeof QuoteModel;

    constructor() {
        this.model = QuoteModel;
    }

    async createQuote(data: Partial<IQuote>) {
        return await this.model.create(data);
    }

    async findById(id: string) {
        return await this.model.findById(id);
    }

    async deleteExpiredQuotes(now: Date = new Date()) {
        return await this.model.deleteMany({ expiresAt: { $lt: now } });
    }
}

export default QuoteDao;
