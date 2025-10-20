import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { computeStats } from "../../lib/pricing";

export const recordSnapshot = mutation({
  args: {
    itemId: v.id("items"),
    source: v.string(),
    priceCents: v.number(),
    totalCents: v.number(),
    capturedAt: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("snapshots", {
      itemId: args.itemId,
      source: args.source,
      priceCents: args.priceCents,
      totalCents: args.totalCents,
      capturedAt: args.capturedAt,
      annotations: args.note
        ? {
            note: args.note,
            source: args.source,
          }
        : undefined,
    });

    return { success: true };
  },
});

export const getSnapshots = query({
  args: {
    itemId: v.id("items"),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const snapshotsQuery = ctx.db
      .query("snapshots")
      .withIndex("byItemTime", (q) => q.eq("itemId", args.itemId))
      .order("asc");

    const snapshots = args.since
      ? (await snapshotsQuery.collect()).filter(
          (snapshot) => snapshot.capturedAt >= args.since!
        )
      : await snapshotsQuery.collect();

    return snapshots;
  },
});

export const getStats = query({
  args: {
    itemId: v.id("items"),
  },
  handler: async (ctx, args) => {
    const snapshots = await ctx.db
      .query("snapshots")
      .withIndex("byItemTime", (q) => q.eq("itemId", args.itemId))
      .order("asc")
      .collect();

    const totals = snapshots.map((snapshot) => snapshot.totalCents);
    const stats = computeStats(totals);
    return stats;
  },
});
