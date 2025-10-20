import { v } from "convex/values";
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { searchGoogleShopping } from "../../lib/serpapi";
import { totalCents } from "../../lib/pricing";

const parseMoneyMicros = (value: unknown) => {
  if (typeof value === "number") {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    return Math.round(parseFloat(cleaned) * 100);
  }
  return 0;
};

type ScrapedOffer = {
  store: string;
  seller?: string;
  priceCents: number;
  shippingCents: number;
  taxRate: number;
  inStock: boolean;
  rating?: number;
  reviewCount?: number;
  url: string;
  condition?: string;
  shippingSpeed?: string;
  dealType?: string;
  normalizedTotalCents: number;
  lastUpdatedAt: number;
};

export const fetchPrices = action({
  args: {
    itemId: v.id("items"),
    query: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.runQuery(api.functions.items.getItemSummary, {
      itemId: args.itemId,
    });
    if (!item) {
      throw new Error("Item not found");
    }

    const searchQuery = args.query ?? item.title;
    const result = await searchGoogleShopping(searchQuery);
    const shoppingResults = result?.shopping_results ?? [];

    const offers: ScrapedOffer[] = shoppingResults.slice(0, 5).map((entry: any) => {
      const priceCents =
        parseMoneyMicros(entry.price_micros) ||
        parseMoneyMicros(entry.price) ||
        0;
      const shippingCents = parseMoneyMicros(entry.shipping) || 0;
      const taxRate =
        typeof process.env.DEFAULT_TAX_RATE === "string"
          ? Number(process.env.DEFAULT_TAX_RATE)
          : 0.0925;

      return {
        store: entry.source || entry.source_site || "unknown",
        seller: entry.seller,
        priceCents,
        shippingCents,
        taxRate,
        inStock: entry.delivery ? true : entry.available_at_checkout ?? true,
        rating: entry.rating ? Number(entry.rating) : undefined,
        reviewCount: entry.reviews ? Number(entry.reviews) : undefined,
        url: entry.link || item.url,
        condition:
          typeof entry.condition === "string" ? entry.condition : undefined,
        shippingSpeed:
          entry.delivery && entry.delivery.shipping
            ? entry.delivery.shipping
            : undefined,
        dealType:
          typeof entry.sale_price === "number" ? "sale" : undefined,
        normalizedTotalCents: totalCents(priceCents, shippingCents, taxRate),
        lastUpdatedAt: Date.now(),
      };
    });

    const capturedAt = Date.now();

    await ctx.runMutation(api.functions.offers.upsertOffers, {
      itemId: args.itemId,
      offers: offers.map((offer: ScrapedOffer) => ({
        store: offer.store,
        seller: offer.seller,
        priceCents: offer.priceCents,
        shippingCents: offer.shippingCents,
        taxRate: offer.taxRate,
        inStock: offer.inStock,
        rating: offer.rating,
        reviewCount: offer.reviewCount,
        url: offer.url,
        condition: offer.condition,
        shippingSpeed: offer.shippingSpeed,
        dealType: offer.dealType,
      })),
      capturedAt,
    });

    return { offers: offers.length };
  },
});
