import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  // Voice shopping sessions - Real-time Daily.co rooms
  voiceSessions: defineTable({
    userId: v.string(), // Clerk user ID
    roomUrl: v.optional(v.string()), // Daily room URL
    roomName: v.optional(v.string()), // Daily room name
    status: v.union(v.literal("active"), v.literal("ended"), v.literal("error")),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    metadata: v.optional(v.object({
      duration: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
      autoEnded: v.optional(v.boolean()),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Products discovered during voice shopping
  products: defineTable({
    sessionId: v.id("voiceSessions"), // Links to voice session
    name: v.string(),
    price: v.number(), // Store in cents to avoid floating point issues
    currency: v.string(), // e.g., "USD"
    imageUrl: v.string(), // Product image URL
    description: v.string(),
    vendor: v.optional(v.string()),
    externalUrl: v.optional(v.string()), // Link to product page
    position: v.number(), // Order in which voice agent found the product
    createdAt: v.number(), // Timestamp for consistent ordering
  })
    .index("by_session", ["sessionId", "position"]) // Efficient session-based queries
    .index("by_created", ["createdAt"]), // Fallback ordering

  // Saved products for voice commands
  savedProducts: defineTable({
    userId: v.string(), // Clerk user ID
    productId: v.string(), // Product identifier
    productNumber: v.number(), // Display number for voice commands (1-indexed)
    productName: v.string(), // Product name for confirmation
    productDetails: v.optional(v.object({
      imageUrl: v.string(),
      price: v.number(),
      category: v.string(),
    })),
    savedAt: v.number(), // Timestamp for ordering
    lastModified: v.number(),
    savedVia: v.union(v.literal("voice"), v.literal("click")),
    voiceCommand: v.optional(v.string()), // Original command if saved via voice
  })
    .index("by_user", ["userId"])
    .index("by_user_and_product", ["userId", "productId"])
    .index("by_user_and_number", ["userId", "productNumber"]),

  // Voice commands log for analytics
  voiceCommands: defineTable({
    userId: v.string(),
    sessionId: v.string(), // Voice session identifier
    command: v.string(), // Raw voice input
    intent: v.union(
      v.literal("save_product"),
      v.literal("remove_product"),
      v.literal("save_multiple"),
      v.literal("remove_multiple"),
      v.literal("unknown")
    ),
    parameters: v.object({
      numbers: v.array(v.number()),
      action: v.union(v.literal("save"), v.literal("remove")),
    }),
    executedAt: v.number(),
    successful: v.boolean(),
    errorMessage: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"])
    .index("by_intent", ["intent"]),

  // Voice transcripts - Real-time conversation logs
  voiceTranscripts: defineTable({
    sessionId: v.id("voiceSessions"),
    userId: v.string(),
    speaker: v.union(v.literal("user"), v.literal("agent")),
    text: v.string(),
    timestamp: v.number(),
    confidence: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  // Search cache for faster repeated searches
  searchCache: defineTable({
    queryHash: v.string(), // Hash of search parameters
    results: v.array(v.any()), // Cached product data
    expiresAt: v.number(),
    hitCount: v.number(),
  })
    .index("by_hash", ["queryHash"])
    .index("by_expiry", ["expiresAt"]),

  // Search products (results from searches)
  searchProducts: defineTable({
    searchId: v.id("productSearches"),
    userId: v.string(),
    title: v.string(),
    price: v.number(),
    currency: v.string(),
    imageUrl: v.optional(v.string()),
    productUrl: v.string(),
    source: v.string(), // "amazon", "ebay", etc.
    number: v.number(), // Sequential number for voice reference
    details: v.optional(v.object({
      rating: v.optional(v.number()),
      reviewCount: v.optional(v.number()),
      availability: v.optional(v.string()),
      features: v.optional(v.array(v.string())),
    })),
    createdAt: v.number(),
  })
    .index("by_search", ["searchId"])
    .index("by_user", ["userId"])
    .index("by_search_number", ["searchId", "number"]),

  // Search history for tracking user searches
  searchHistory: defineTable({
    userId: v.string(),
    query: v.string(),
    resultCount: v.number(),
    searchedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Product searches
  productSearches: defineTable({
    userId: v.string(),
    sessionId: v.string(),
    query: v.string(),
    parameters: v.object({
      category: v.optional(v.string()),
      priceMin: v.optional(v.number()),
      priceMax: v.optional(v.number()),
      features: v.optional(v.array(v.string())),
      keywords: v.array(v.string()),
    }),
    status: v.union(
      v.literal("pending"),
      v.literal("extracting"),
      v.literal("searching"),
      v.literal("completed"),
      v.literal("failed")
    ),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"])
    .index("by_status", ["status"]),

  // User preferences extracted from voice interactions
  userPreferences: defineTable({
    userId: v.string(), // Clerk user ID
    tag: v.string(), // "wooden", "under $20", "at least 3ft"
    category: v.union(
      v.literal("material"),
      v.literal("price"),
      v.literal("size"),
      v.literal("feature"),
      v.literal("color"),
      v.literal("style"),
      v.literal("other")
    ),
    value: v.optional(v.union(v.string(), v.number())), // Structured value if applicable
    extractedFrom: v.string(), // Original voice command
    priority: v.number(), // 1-10 scale based on user emphasis
    source: v.union(v.literal("voice"), v.literal("manual")), // How tag was created
    productContext: v.optional(v.string()), // Product type this preference applies to
    createdAt: v.number(),
    expiresAt: v.optional(v.number()), // Auto-expire old preferences (30 days)
    useCount: v.number(), // Times used in searches
    lastUsedAt: v.number(), // Track when preference was last applied
  })
    .index("by_user", ["userId"])
    .index("by_user_and_category", ["userId", "category"]),

  // Search refinement history for tracking user refinement patterns
  searchRefinements: defineTable({
    userId: v.string(),
    originalSearchId: v.string(), // Reference to initial search
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
    extractedPreferences: v.array(v.string()), // Tags extracted from command
    refinementValue: v.optional(v.string()), // Specific refinement detail
    targetPercentage: v.optional(v.number()), // For price refinements
    newSearchId: v.string(), // Reference to refined search
    resultCount: v.optional(v.number()), // How many results the refinement returned
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_original_search", ["originalSearchId"]),

  // Preference usage history
  preferenceHistory: defineTable({
    userId: v.string(),
    preferenceId: v.id("userPreferences"),
    usedInSearchId: v.string(),
    usedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_preference", ["preferenceId"]),
});
