// Importing modules
import ShopPricingModel, { IShopPricing } from "../models/shopPricing.model.js";

class ShopPricingDao {
    model: typeof ShopPricingModel;

    constructor() {
        this.model = ShopPricingModel;
    }

    async findByShopId(shopId: string) {
        return await this.model.findOne({ shopId });
    }

    async createOrUpdatePricing(shopId: string, pricingData: Partial<IShopPricing>) {
        return await this.model.findOneAndUpdate(
            { shopId },
            { $set: pricingData },
            { upsert: true, returnDocument: "after" }
        );
    }
}

export default ShopPricingDao;
