// Importing modules
import ShopPricingDao from "../dao/shopPricing.dao.js";
import QuoteDao from "../dao/quote.dao.js";
import { IPrintSettings } from "../models/printJob.model.js";

export interface IQuoteCalculationResult {
    quoteId: string;
    documentId: string;
    pageCount: number;
    copies: number;
    totalPrintedPages: number;
    estimatedPhysicalSheets: number;
    colorMode: "BW" | "COLOR";
    duplex: boolean;
    paperSize: "A4" | "A3" | "A5" | "LETTER";
    orientation: "AUTO" | "PORTRAIT" | "LANDSCAPE";
    scaling: "FIT" | "ACTUAL_SIZE" | "SHRINK";
    amountPerPagePaise: number;
    amountPaise: number;
    amountRupees: number;
    currency: "INR";
    expiresAt: Date;
}

class PricingService {
    shopPricingDao: ShopPricingDao;
    quoteDao: QuoteDao;

    constructor() {
        this.shopPricingDao = new ShopPricingDao();
        this.quoteDao = new QuoteDao();
    }

    async calculateQuote(
        shopId: string,
        documentId: string,
        settings: IPrintSettings,
        quoteValidityMinutes: number = 15
    ): Promise<IQuoteCalculationResult> {
        const pricingConfig = await this.shopPricingDao.findByShopId(shopId);

        const bwRate = pricingConfig?.blackWhitePerPagePaise ?? 200; // 200 paise = ₹2.00
        const colorRate = pricingConfig?.colorPerPagePaise ?? 1000; // 1000 paise = ₹10.00
        const minCharge = pricingConfig?.minimumChargePaise ?? 200;

        const paperMultiplierMap: Record<string, number> = {
            A4: 1,
            A3: 2,
            A5: 1,
            LETTER: 1,
        };

        const paperSize = settings.paperSize || "A4";
        const paperMultiplier = paperMultiplierMap[paperSize] ?? 1;

        const pageCount = settings.selectedPages.length;
        const copies = Math.max(1, settings.copies || 1);
        const totalPrintedPages = pageCount * copies;

        const sheetsPerCopy = settings.duplex ? Math.ceil(pageCount / 2) : pageCount;
        const estimatedPhysicalSheets = sheetsPerCopy * copies;

        const ratePerPage = (settings.colorMode === "COLOR" ? colorRate : bwRate) * paperMultiplier;

        let totalAmountPaise = totalPrintedPages * ratePerPage;
        if (totalAmountPaise < minCharge) {
            totalAmountPaise = minCharge;
        }

        // Integer paise guarantee
        totalAmountPaise = Math.round(totalAmountPaise);

        const expiresAt = new Date(Date.now() + quoteValidityMinutes * 60 * 1000);

        // Store quote record in database
        const quote = await this.quoteDao.createQuote({
            shopId: shopId as any,
            documentId: documentId as any,
            selectedPages: settings.selectedPages,
            pageCount,
            copies,
            totalPrintedPages,
            estimatedPhysicalSheets,
            colorMode: settings.colorMode,
            duplex: settings.duplex,
            paperSize: settings.paperSize,
            orientation: settings.orientation,
            scaling: settings.scaling,
            amountPaise: totalAmountPaise,
            amountRupees: totalAmountPaise / 100,
            currency: "INR",
            expiresAt,
        });

        return {
            quoteId: quote._id.toString(),
            documentId,
            pageCount,
            copies,
            totalPrintedPages,
            estimatedPhysicalSheets,
            colorMode: settings.colorMode,
            duplex: settings.duplex,
            paperSize: settings.paperSize,
            orientation: settings.orientation,
            scaling: settings.scaling,
            amountPerPagePaise: ratePerPage,
            amountPaise: totalAmountPaise,
            amountRupees: totalAmountPaise / 100,
            currency: "INR",
            expiresAt,
        };
    }
}

const pricingService = new PricingService();
export default pricingService;
