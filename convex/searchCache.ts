import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

// Simple hash function that doesn't require crypto module
function hashSearchParams(params: any): string {
  const normalized = JSON.stringify(params, Object.keys(params).sort());

  // Simple string hash function
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16);
}

// Check if search results are cached
export const getCachedSearch = query({
  args: {
    queryHash: v.string(),
  },
  handler: async (ctx, args) => {
    const cached = await ctx.db
      .query("searchCache")
      .withIndex("by_hash", (q) => q.eq("queryHash", args.queryHash))
      .first();

    // Return null if not found or expired
    if (!cached || Date.now() > cached.expiresAt) {
      return null;
    }

    return cached.results;
  },
});

// Save search results to cache
export const cacheSearchResults = mutation({
  args: {
    queryHash: v.string(),
    results: v.array(v.any()),
    ttlMinutes: v.optional(v.number()), // Time-to-live in minutes (default: 60)
  },
  handler: async (ctx, args) => {
    const ttl = args.ttlMinutes || 60; // Default 1 hour
    const expiresAt = Date.now() + ttl * 60 * 1000;

    // Check if cache entry already exists
    const existing = await ctx.db
      .query("searchCache")
      .withIndex("by_hash", (q) => q.eq("queryHash", args.queryHash))
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        results: args.results,
        expiresAt,
        hitCount: existing.hitCount + 1,
      });
    } else {
      // Create new cache entry
      await ctx.db.insert("searchCache", {
        queryHash: args.queryHash,
        results: args.results,
        expiresAt,
        hitCount: 0,
      });
    }
  },
});

// Clean up expired cache entries
export const cleanExpiredCache = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();

    // Find all expired entries
    const expired = await ctx.db
      .query("searchCache")
      .withIndex("by_expiry")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    // Delete expired entries
    for (const entry of expired) {
      await ctx.db.delete(entry._id);
    }

    return expired.length;
  },
});

// Get cache statistics
export const getCacheStats = query({
  handler: async (ctx) => {
    const allEntries = await ctx.db.query("searchCache").collect();

    const totalEntries = allEntries.length;
    const totalHits = allEntries.reduce((sum, entry) => sum + entry.hitCount, 0);
    const activeEntries = allEntries.filter(
      (entry) => Date.now() < entry.expiresAt
    ).length;

    return {
      totalEntries,
      activeEntries,
      expiredEntries: totalEntries - activeEntries,
      totalHits,
      averageHitsPerEntry: totalEntries > 0 ? totalHits / totalEntries : 0,
    };
  },
});

// Clear all cache entries (admin function)
export const clearAllCache = mutation({
  handler: async (ctx) => {
    const allEntries = await ctx.db.query("searchCache").collect();

    for (const entry of allEntries) {
      await ctx.db.delete(entry._id);
    }

    return allEntries.length;
  },
});

// Helper function to generate hash from parameters (exported for use in actions)
export function generateQueryHash(params: {
  query: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  brand?: string;
  rating?: number;
  features?: string[];
  keywords?: string[];
}): string {
  // Normalize parameters for consistent hashing
  const normalized = {
    query: params.query?.toLowerCase().trim() || "",
    category: params.category?.toLowerCase().trim(),
    priceMin: params.priceMin,
    priceMax: params.priceMax,
    brand: params.brand?.toLowerCase().trim(),
    rating: params.rating,
    features: params.features?.map(f => f.toLowerCase().trim()).sort(),
    keywords: params.keywords?.map(k => k.toLowerCase().trim()).sort(),
  };

  // Remove undefined values
  const cleaned = Object.fromEntries(
    Object.entries(normalized).filter(([_, v]) => v !== undefined && v !== "")
  );

  return hashSearchParams(cleaned);
}
