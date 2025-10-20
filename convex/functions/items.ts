import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

const optionalString = v.optional(v.string());

export const listItems = query({
  args: {
    ownerClerkId: optionalString,
  },
  handler: async (ctx, args) => {
    const { ownerClerkId } = args;

    const items = await ctx.db
      .query("items")
      .withIndex("byOwner", (q) =>
        ownerClerkId ? q.eq("ownerClerkId", ownerClerkId) : q
      )
      .order("desc")
      .take(100);

    return items;
  },
});

export const getItem = query({
  args: {
    itemId: v.id("items"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      return null;
    }

    const [offers, snapshots] = await Promise.all([
      ctx.db
        .query("offers")
        .withIndex("byItemTime", (q) => q.eq("itemId", args.itemId))
        .order("desc")
        .collect(),
      ctx.db
        .query("snapshots")
        .withIndex("byItemTime", (q) => q.eq("itemId", args.itemId))
        .order("asc")
        .collect(),
    ]);

    return {
      item,
      offers,
      snapshots,
    };
  },
});

export const getItemSummary = query({
  args: {
    itemId: v.id("items"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.itemId);
  },
});

export const addItem = mutation({
  args: {
    ownerClerkId: optionalString,
    title: v.string(),
    url: v.string(),
    asin: optionalString,
    sku: optionalString,
    image: optionalString,
    category: optionalString,
    brand: optionalString,
    model: optionalString,
    description: optionalString,
    tags: v.optional(v.array(v.string())),
    notes: optionalString,
    metadata: v.optional(
      v.object({
        color: optionalString,
        storage: optionalString,
        variant: optionalString,
        source: optionalString,
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity && !args.ownerClerkId) {
      throw new Error("Unauthenticated");
    }

    const ownerClerkId = args.ownerClerkId ?? identity?.subject ?? null;

    const itemId = await ctx.db.insert("items", {
      ownerClerkId: ownerClerkId ?? undefined,
      title: args.title,
      url: args.url,
      asin: args.asin ?? undefined,
      sku: args.sku ?? undefined,
      image: args.image ?? undefined,
      category: args.category ?? undefined,
      brand: args.brand ?? undefined,
      model: args.model ?? undefined,
      description: args.description ?? undefined,
      tags: args.tags ?? undefined,
      notes: args.notes ?? undefined,
      metadata: args.metadata ?? undefined,
      createdAt: Date.now(),
      lastCheckedAt: Date.now(),
    });

    return itemId;
  },
});

export const updateItem = mutation({
  args: {
    itemId: v.id("items"),
    updates: v.object({
      title: optionalString,
      image: optionalString,
      category: optionalString,
      brand: optionalString,
      model: optionalString,
      description: optionalString,
      tags: v.optional(v.array(v.string())),
      notes: optionalString,
      metadata: v.optional(
        v.object({
          color: optionalString,
          storage: optionalString,
          variant: optionalString,
          source: optionalString,
        })
      ),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.itemId);
    if (!existing) {
      throw new Error("Item not found");
    }

    await ctx.db.patch(args.itemId, {
      ...args.updates,
    });

    return { success: true };
  },
});

export const deleteItem = mutation({
  args: {
    itemId: v.id("items"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.itemId);

    const offers = await ctx.db
      .query("offers")
      .withIndex("byItemTime", (q) => q.eq("itemId", args.itemId))
      .collect();
    await Promise.all(offers.map((offer) => ctx.db.delete(offer._id)));

    const snapshots = await ctx.db
      .query("snapshots")
      .withIndex("byItemTime", (q) => q.eq("itemId", args.itemId))
      .collect();
    await Promise.all(snapshots.map((snapshot) => ctx.db.delete(snapshot._id)));

    const wishlists = await ctx.db
      .query("wishlists")
      .filter((q) => q.eq(q.field("itemId"), args.itemId))
      .collect();
    await Promise.all(wishlists.map((w) => ctx.db.delete(w._id)));

    return { success: true };
  },
});
