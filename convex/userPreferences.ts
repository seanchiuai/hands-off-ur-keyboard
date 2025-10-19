import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Helper function to detect semantically similar tags
function areSimilarTags(tag1: string, tag2: string): boolean {
  const normalized1 = tag1.toLowerCase().trim();
  const normalized2 = tag2.toLowerCase().trim();

  // Exact match
  if (normalized1 === normalized2) return true;

  // One contains the other (e.g., "wooden" vs "wood finish")
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }

  // Check for common variations
  const variations: Record<string, string[]> = {
    wooden: ["wood", "timber"],
    metal: ["metallic", "steel", "aluminum"],
    plastic: ["polymer"],
  };

  for (const [key, values] of Object.entries(variations)) {
    if (
      (normalized1 === key && values.includes(normalized2)) ||
      (normalized2 === key && values.includes(normalized1))
    ) {
      return true;
    }
  }

  return false;
}

// Save new preference tags extracted from voice
export const savePreferences = mutation({
  args: {
    preferences: v.array(
      v.object({
        category: v.string(),
        tag: v.string(),
        value: v.optional(v.union(v.string(), v.number())),
        priority: v.number(),
        productContext: v.optional(v.string()),
        extractedFrom: v.string(),
      })
    ),
  },
  handler: async (ctx, { preferences }) => {
    // Verify user authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: Must be logged in to save preferences");
    }

    const userId = identity.subject;
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    // Check for duplicates and merge if needed
    const existingPrefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Check if user has too many preferences
    const MAX_PREFERENCES = 500;
    if (existingPrefs.length >= MAX_PREFERENCES) {
      throw new Error(
        `Maximum preference limit (${MAX_PREFERENCES}) reached. Please remove some old preferences.`
      );
    }

    const savedIds: Array<Id<"userPreferences">> = [];

    for (const pref of preferences) {
      // Validate and sanitize tag
      const sanitizedTag = pref.tag.trim().slice(0, 50); // Max 50 characters
      if (!sanitizedTag) {
        continue; // Skip empty tags
      }

      // Validate category
      const validCategories = [
        "material",
        "price",
        "size",
        "feature",
        "color",
        "style",
        "other",
      ];
      const category = validCategories.includes(pref.category)
        ? pref.category
        : "other";

      // Look for semantic duplicates in same category
      const duplicate = existingPrefs.find(
        (existing) =>
          existing.category === category &&
          areSimilarTags(existing.tag, sanitizedTag)
      );

      if (duplicate) {
        // Update existing preference with new priority and timestamp
        await ctx.db.patch(duplicate._id, {
          priority: Math.max(duplicate.priority, pref.priority),
          lastUsedAt: now,
          expiresAt: now + THIRTY_DAYS_MS,
        });
        savedIds.push(duplicate._id);
      } else {
        // Insert new preference
        const id = await ctx.db.insert("userPreferences", {
          userId,
          category: category as
            | "material"
            | "price"
            | "size"
            | "feature"
            | "color"
            | "style"
            | "other",
          tag: sanitizedTag,
          value: pref.value,
          priority: pref.priority,
          productContext: pref.productContext,
          extractedFrom: pref.extractedFrom,
          source: "voice",
          createdAt: now,
          expiresAt: now + THIRTY_DAYS_MS,
          useCount: 0,
          lastUsedAt: now,
        });
        savedIds.push(id);
      }
    }

    return { success: true, preferenceIds: savedIds };
  },
});

// Get active preferences for a user
export const getUserPreferences = query({
  args: {
    category: v.optional(v.union(
      v.literal("material"),
      v.literal("price"),
      v.literal("size"),
      v.literal("feature"),
      v.literal("color"),
      v.literal("style"),
      v.literal("other")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { category, limit = 50 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { preferences: [], grouped: {} };

    const userId = identity.subject;
    const now = Date.now();

    let queryBuilder = ctx.db
      .query("userPreferences")
      .withIndex(
        category ? "by_user_and_category" : "by_user",
        (q) => {
          if (category) {
            return q.eq("userId", userId).eq("category", category);
          }
          return q.eq("userId", userId);
        }
      );

    const allPrefs = await queryBuilder.collect();

    // Filter out expired preferences
    const activePrefs = allPrefs.filter(
      (pref) => !pref.expiresAt || pref.expiresAt > now
    );

    // Sort by priority and recent usage
    const sortedPrefs = activePrefs.sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // More recently used first
      return b.lastUsedAt - a.lastUsedAt;
    });

    const limitedPrefs = sortedPrefs.slice(0, limit);

    // Group by category for structured display
    const grouped: Record<string, typeof limitedPrefs> = {};
    for (const pref of limitedPrefs) {
      if (!grouped[pref.category]) {
        grouped[pref.category] = [];
      }
      grouped[pref.category].push(pref);
    }

    return { preferences: limitedPrefs, grouped };
  },
});

// Get preferences grouped by category
export const getPreferencesByCategory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {};

    const userId = identity.subject;
    const now = Date.now();

    const allPrefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter out expired preferences
    const activePrefs = allPrefs.filter(
      (pref) => !pref.expiresAt || pref.expiresAt > now
    );

    // Group by category
    const grouped: Record<string, typeof activePrefs> = {};
    for (const pref of activePrefs) {
      if (!grouped[pref.category]) {
        grouped[pref.category] = [];
      }
      grouped[pref.category].push(pref);
    }

    // Sort each category by priority
    for (const category in grouped) {
      grouped[category].sort((a, b) => b.priority - a.priority);
    }

    return grouped;
  },
});

// Delete a preference tag
export const deletePreference = mutation({
  args: { preferenceId: v.id("userPreferences") },
  handler: async (ctx, { preferenceId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const pref = await ctx.db.get(preferenceId);
    if (!pref || pref.userId !== identity.subject) {
      throw new Error("Preference not found or unauthorized");
    }

    await ctx.db.delete(preferenceId);
    return { success: true };
  },
});

// Increment use count when preference is used in a search
export const incrementUseCount = mutation({
  args: {
    preferenceId: v.id("userPreferences"),
    searchId: v.string(),
  },
  handler: async (ctx, { preferenceId, searchId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const pref = await ctx.db.get(preferenceId);
    if (!pref || pref.userId !== identity.subject) {
      throw new Error("Preference not found or unauthorized");
    }

    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    // Update preference
    await ctx.db.patch(preferenceId, {
      useCount: pref.useCount + 1,
      lastUsedAt: now,
      expiresAt: now + THIRTY_DAYS_MS, // Extend expiration
    });

    // Create preference history entry
    await ctx.db.insert("preferenceHistory", {
      userId: identity.subject,
      preferenceId,
      usedInSearchId: searchId,
      usedAt: now,
    });

    return { success: true };
  },
});

// Clean up expired preferences
export const cleanupExpiredPreferences = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const now = Date.now();
    const userId = identity.subject;

    const allPrefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let deletedCount = 0;
    for (const pref of allPrefs) {
      if (pref.expiresAt && pref.expiresAt < now) {
        await ctx.db.delete(pref._id);
        deletedCount++;
      }
    }

    return { success: true, deletedCount };
  },
});
