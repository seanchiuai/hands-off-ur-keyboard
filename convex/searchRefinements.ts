import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Record a search refinement request
export const recordRefinement = mutation({
  args: {
    originalSearchId: v.string(),
    refinementType: v.union(
      v.literal("cheaper"),
      v.literal("price_lower"),
      v.literal("price_higher"),
      v.literal("feature"),
      v.literal("add_feature"),
      v.literal("remove_feature"),
      v.literal("price_range"),
      v.literal("change_size"),
      v.literal("custom")
    ),
    voiceCommand: v.string(),
    extractedPreferences: v.array(v.string()),
    refinementValue: v.optional(v.string()),
    targetPercentage: v.optional(v.number()),
    newSearchId: v.string(),
    resultCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Must be logged in to record refinement");
    }

    const userId = identity.subject;
    const now = Date.now();

    // Check refinement limits - max 5 refinements per original search
    const existingRefinements = await ctx.db
      .query("searchRefinements")
      .withIndex("by_original_search", (q) =>
        q.eq("originalSearchId", args.originalSearchId)
      )
      .collect();

    if (existingRefinements.length >= 5) {
      throw new Error(
        "Maximum refinements (5) reached for this search. Please start a new search."
      );
    }

    const refinementId = await ctx.db.insert("searchRefinements", {
      userId,
      originalSearchId: args.originalSearchId,
      refinementType: args.refinementType,
      voiceCommand: args.voiceCommand,
      extractedPreferences: args.extractedPreferences,
      refinementValue: args.refinementValue,
      targetPercentage: args.targetPercentage,
      newSearchId: args.newSearchId,
      resultCount: args.resultCount,
      createdAt: now,
    });

    return { success: true, refinementId };
  },
});

// Get refinement history for a search
export const getRefinementHistory = query({
  args: { searchId: v.string() },
  handler: async (ctx, { searchId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject;

    const refinements = await ctx.db
      .query("searchRefinements")
      .withIndex("by_original_search", (q) => q.eq("originalSearchId", searchId))
      .collect();

    // Filter to only this user's refinements
    return refinements.filter((r) => r.userId === userId);
  },
});

// Get all refinements for a user
export const getUserRefinements = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject;

    const refinements = await ctx.db
      .query("searchRefinements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return refinements;
  },
});

// Get refinement analytics
export const getRefinementAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        totalRefinements: 0,
        refinementsByType: {},
        averageResultCount: 0,
      };
    }

    const userId = identity.subject;

    const refinements = await ctx.db
      .query("searchRefinements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Calculate analytics
    const refinementsByType: Record<string, number> = {};
    let totalResultCount = 0;
    let countWithResults = 0;

    for (const refinement of refinements) {
      // Count by type
      refinementsByType[refinement.refinementType] =
        (refinementsByType[refinement.refinementType] || 0) + 1;

      // Track result counts
      if (refinement.resultCount !== undefined) {
        totalResultCount += refinement.resultCount;
        countWithResults++;
      }
    }

    const averageResultCount =
      countWithResults > 0 ? totalResultCount / countWithResults : 0;

    return {
      totalRefinements: refinements.length,
      refinementsByType,
      averageResultCount,
    };
  },
});
