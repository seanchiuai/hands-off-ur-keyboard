import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { totalCents } from "../../lib/pricing";

export const listOffers = query({
  args: {
    itemId: v.id("items"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("offers")
      .withIndex("byItemTime", (q) => q.eq("itemId", args.itemId))
      .order("desc")
      .take(20);
  },
});

export const upsertOffers = mutation({
  args: {
    itemId: v.id("items"),
    offers: v.array(
      v.object({
        store: v.string(),
        seller: v.optional(v.string()),
        priceCents: v.number(),
        shippingCents: v.number(),
        taxRate: v.number(),
        inStock: v.boolean(),
        rating: v.optional(v.number()),
        reviewCount: v.optional(v.number()),
        url: v.string(),
        condition: v.optional(v.string()),
        shippingSpeed: v.optional(v.string()),
        dealType: v.optional(v.string()),
      })
    ),
    capturedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { itemId, offers, capturedAt } = args;

    const normalizedOffers = offers.map((offer) => ({
      ...offer,
      normalizedTotalCents: totalCents(
        offer.priceCents,
        offer.shippingCents,
        offer.taxRate
      ),
      lastUpdatedAt: capturedAt,
    }));

    for (const offer of normalizedOffers) {
      await ctx.db.insert("offers", {
        itemId,
        ...offer,
      });
      await ctx.db.insert("snapshots", {
        itemId,
        source: "serpapi",
        priceCents: offer.priceCents,
        totalCents: offer.normalizedTotalCents ?? offer.priceCents,
        capturedAt: offer.lastUpdatedAt,
      });
    }

    await ctx.db.patch(itemId, {
      lastCheckedAt: capturedAt,
    });

    return { inserted: normalizedOffers.length };
  },
});
