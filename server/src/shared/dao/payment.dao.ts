// Importing modules
import PaymentModel, { IPayment } from "../models/payment.model.js";

class PaymentDao {
    model: typeof PaymentModel;

    constructor() {
        this.model = PaymentModel;
    }

    async createPayment(data: Partial<IPayment>) {
        return await this.model.create(data);
    }

    async findById(id: string) {
        return await this.model.findById(id);
    }

    async findByRazorpayOrderId(orderId: string) {
        return await this.model.findOne({ razorpayOrderId: orderId });
    }

    async findByPrintJobId(printJobId: string) {
        return await this.model.findOne({ printJobId });
    }

    async updateById(id: string, updateData: Partial<IPayment>) {
        return await this.model.findByIdAndUpdate(id, updateData, { returnDocument: "after" });
    }
}

export default PaymentDao;
