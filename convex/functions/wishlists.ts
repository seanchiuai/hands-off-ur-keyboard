import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const listWishlists = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("wishlists")
      .withIndex("byUser", (q) => q.eq("clerkId", args.clerkId))
      .order("desc")
      .collect();
  },
});

export const getWishlistForItem = query({
  args: {
    clerkId: v.string(),
    itemId: v.id("items"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("wishlists")
      .withIndex("byUser", (q) => q.eq("clerkId", args.clerkId))
      .filter((q) => q.eq(q.field("itemId"), args.itemId))
      .first();
  },
});

export const addToWishlist = mutation({
  args: {
    clerkId: v.string(),
    itemId: v.id("items"),
    targetCents: v.optional(v.number()),
    dropPercent: v.optional(v.number()),
    priority: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wishlists")
      .withIndex("byUser", (q) => q.eq("clerkId", args.clerkId))
      .filter((q) => q.eq(q.field("itemId"), args.itemId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("wishlists", {
      clerkId: args.clerkId,
      itemId: args.itemId,
      targetCents: args.targetCents ?? undefined,
      dropPercent: args.dropPercent ?? undefined,
      priority: args.priority ?? undefined,
      notes: args.notes ?? undefined,
      notificationSent: false,
      createdAt: Date.now(),
    });
  },
});

export const updateWishlist = mutation({
  args: {
    wishlistId: v.id("wishlists"),
    updates: v.object({
      targetCents: v.optional(v.number()),
      dropPercent: v.optional(v.number()),
      priority: v.optional(
        v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
      ),
      notes: v.optional(v.string()),
      notificationSent: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.wishlistId, {
      ...args.updates,
    });

    return { success: true };
  },
});

export const removeFromWishlist = mutation({
  args: {
    wishlistId: v.id("wishlists"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.wishlistId);
    return { success: true };
  },
});
