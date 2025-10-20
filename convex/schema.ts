import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex schema for the price tracker research agent.
 *
 * Compared to the original voice-shopping schema, this stores richer product
 * metadata plus analytics artefacts (offers, snapshots, review cache, alert
 * history).  Optional fields are used so the background agent can gradually
 * hydrate missing data.
 */
export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    createdAt: v.number(),
  }).index("byClerkId", ["clerkId"]),

  items: defineTable({
    ownerClerkId: v.optional(v.string()),
    title: v.string(),
    url: v.string(),
    asin: v.optional(v.string()),
    sku: v.optional(v.string()),
    image: v.optional(v.string()),
    category: v.optional(v.string()),
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        color: v.optional(v.string()),
        storage: v.optional(v.string()),
        variant: v.optional(v.string()),
        source: v.optional(v.string()),
      })
    ),
    lastCheckedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("byOwner", ["ownerClerkId"]),

  offers: defineTable({
    itemId: v.id("items"),
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
    normalizedTotalCents: v.optional(v.number()),
    lastUpdatedAt: v.optional(v.number()),
    capturedAt: v.optional(v.number()),
  }).index("byItemTime", ["itemId", "lastUpdatedAt"]),

  snapshots: defineTable({
    itemId: v.id("items"),
    source: v.string(),
    priceCents: v.number(),
    totalCents: v.number(),
    capturedAt: v.number(),
    annotations: v.optional(
      v.object({
        note: v.optional(v.string()),
        source: v.optional(v.string()),
      })
    ),
  }).index("byItemTime", ["itemId", "capturedAt"]),

  wishlists: defineTable({
    clerkId: v.string(),
    itemId: v.id("items"),
    targetCents: v.optional(v.number()),
    dropPercent: v.optional(v.number()),
    priority: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    notes: v.optional(v.string()),
    notificationSent: v.optional(v.boolean()),
    lastAlertedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("byUser", ["clerkId"]),

  reviewCache: defineTable({
    itemId: v.id("items"),
    source: v.string(),
    query: v.string(),
    summary: v.string(),
    capturedAt: v.number(),
    pros: v.optional(v.array(v.string())),
    cons: v.optional(v.array(v.string())),
  }).index("byItemSource", ["itemId", "source"]),

  alertEvents: defineTable({
    clerkId: v.string(),
    itemId: v.id("items"),
    reason: v.string(),
    priceCents: v.number(),
    previousPrice: v.optional(v.number()),
    percentageChange: v.optional(v.number()),
    store: v.optional(v.string()),
    viewed: v.optional(v.boolean()),
    clicked: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("byUserTime", ["clerkId", "createdAt"]),
});
