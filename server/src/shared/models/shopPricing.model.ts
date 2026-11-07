// Importing module
import mongoose, { Schema, Document as MongooseDocument } from "mongoose";

export interface IShopPricing extends MongooseDocument {
    shopId: mongoose.Types.ObjectId;
    blackWhitePerPagePaise: number;
    colorPerPagePaise: number;
    duplexDiscountPaise: number;
    minimumChargePaise: number;
    paperSizeMultipliers: Record<string, number>;
    createdAt: Date;
    updatedAt: Date;
}

const shopPricingSchema = new Schema<IShopPricing>(
    {
        shopId: {
            type: Schema.Types.ObjectId,
            required: [true, "Shop ID is required"],
            unique: true,
            index: true,
        },
        blackWhitePerPagePaise: {
            type: Number,
            required: true,
            default: 200, // ₹2.00
        },
        colorPerPagePaise: {
            type: Number,
            required: true,
            default: 1000, // ₹10.00
        },
        duplexDiscountPaise: {
            type: Number,
            required: true,
            default: 0,
        },
        minimumChargePaise: {
            type: Number,
            required: true,
            default: 200,
        },
        paperSizeMultipliers: {
            type: Map,
            of: Number,
            default: {
                A4: 1,
                A3: 2,
                A5: 1,
                LETTER: 1,
            },
        },
    },
    {
        timestamps: true,
    }
);

const ShopPricingModel = mongoose.model<IShopPricing>("ShopPricing", shopPricingSchema);

export default ShopPricingModel;
