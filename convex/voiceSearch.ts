import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Voice-triggered product search integration
 *
 * This module connects voice transcripts to product search:
 * 1. Analyzes voice transcript for search intent
 * 2. Extracts search parameters via Gemini
 * 3. Triggers product search via BrightData
 * 4. Returns search results for display
 */

// Trigger product search from voice transcript
export const triggerSearchFromVoice = action({
  args: {
    userId: v.string(),
    sessionId: v.id("voiceSessions"),
    transcript: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    try {
      // Step 1: Create search record
      const searchId: Id<"productSearches"> = await ctx.runMutation(
        api.productSearch.createSearch,
        {
          userId: args.userId,
          sessionId: args.sessionId,
          query: args.transcript,
        }
      );

      // Step 2: Extract search parameters using Gemini
      const extractedParams: any = await ctx.runAction(
        api.productSearch.extractSearchParams,
        {
          searchId,
          voiceTranscript: args.transcript,
          userId: args.userId,
        }
      );

      // Step 3: Search products using BrightData
      const result: { success: boolean; productCount: number } = await ctx.runAction(
        api.brightdata.searchProducts,
        {
          searchId,
          userId: args.userId,
          parameters: extractedParams,
        }
      );

      // Step 4: Log search history
      if (result.success) {
        await ctx.runMutation(api.productSearch.logSearchHistory, {
          userId: args.userId,
          query: args.transcript,
          resultCount: result.productCount,
        });
      }

      return {
        success: result.success,
        searchId,
        productCount: result.productCount,
      };
    } catch (error) {
      console.error("Error in voice search:", error);
      throw error;
    }
  },
});

// Get the most recent active search for a user's session
export const getActiveSearch = query({
  args: {
    userId: v.string(),
    sessionId: v.optional(v.id("voiceSessions")),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // If sessionId provided, get most recent search for that session
    if (args.sessionId) {
      const sessionId = args.sessionId; // Type narrowing
      const search = await ctx.db
        .query("productSearches")
        .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
        .order("desc")
        .first();

      return search;
    }

    // Otherwise get most recent search for user
    const search = await ctx.db
      .query("productSearches")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();

    return search;
  },
});

// Get products for the current active search
export const getActiveSearchProducts = query({
  args: {
    userId: v.string(),
    sessionId: v.optional(v.id("voiceSessions")),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Get active search
    const search = await ctx.db
      .query("productSearches")
      .withIndex(args.sessionId ? "by_session" : "by_user", (q) =>
        args.sessionId
          ? q.eq("sessionId", args.sessionId)
          : q.eq("userId", args.userId)
      )
      .order("desc")
      .first();

    if (!search) {
      return [];
    }

    // Get products for this search
    const products = await ctx.db
      .query("searchProducts")
      .withIndex("by_search", (q) => q.eq("searchId", search._id))
      .collect();

    // Sort by number (1-20)
    return products.sort((a, b) => a.number - b.number);
  },
});

// Check if transcript contains search intent
export const detectSearchIntent = action({
  args: {
    transcript: v.string(),
  },
  handler: async (ctx, args) => {
    const transcript = args.transcript.toLowerCase();

    // Keywords that indicate search intent
    const searchKeywords = [
      "find",
      "search",
      "look for",
      "looking for",
      "show me",
      "get me",
      "i want",
      "i need",
      "buy",
      "purchase",
      "shopping for",
    ];

    // Check if transcript contains any search keywords
    const hasSearchIntent = searchKeywords.some((keyword) =>
      transcript.includes(keyword)
    );

    return hasSearchIntent;
  },
});

// Cancel/clear active search
export const clearActiveSearch = mutation({
  args: {
    userId: v.string(),
    searchId: v.id("productSearches"),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Verify search belongs to user
    const search = await ctx.db.get(args.searchId);
    if (!search || search.userId !== args.userId) {
      throw new Error("Search not found or unauthorized");
    }

    // Clear all products for this search
    const products = await ctx.db
      .query("searchProducts")
      .withIndex("by_search", (q) => q.eq("searchId", args.searchId))
      .collect();

    for (const product of products) {
      await ctx.db.delete(product._id);
    }

    // Delete the search
    await ctx.db.delete(args.searchId);
  },
});
