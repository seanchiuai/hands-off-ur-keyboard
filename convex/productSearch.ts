import { v } from "convex/values";
import { action, mutation, query, internalMutation } from "./_generated/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Id } from "./_generated/dataModel";

// Schema for search parameters extracted by Gemini
const searchParamsSchema = v.object({
  query: v.string(),
  category: v.optional(v.string()),
  priceMin: v.optional(v.number()),
  priceMax: v.optional(v.number()),
  brand: v.optional(v.string()),
  rating: v.optional(v.number()),
  features: v.optional(v.array(v.string())),
  keywords: v.array(v.string()),
});

// Create a new product search
export const createSearch = mutation({
  args: {
    userId: v.string(),
    sessionId: v.optional(v.id("voiceSessions")),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Create pending search
    const searchId = await ctx.db.insert("productSearches", {
      userId: args.userId,
      sessionId: args.sessionId || "",
      query: args.query,
      parameters: {
        keywords: [], // Will be filled by extractSearchParams
      },
      status: "pending",
      createdAt: Date.now(),
    });

    return searchId;
  },
});

// Extract structured search parameters from voice input using Gemini
export const extractSearchParams = action({
  args: {
    searchId: v.id("productSearches"),
    voiceTranscript: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    try {
      // Initialize Gemini API
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY not configured");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
      });

      // Function declaration for structured output
      const functionDeclaration = {
        name: "extract_product_search_params",
        description: "Extract product search parameters from natural language query",
        parameters: {
          type: "object" as const,
          properties: {
            query: {
              type: "string" as const,
              description: "Main search query/product name"
            },
            category: {
              type: "string" as const,
              description: "Product category (e.g., electronics, furniture, clothing)"
            },
            priceMin: {
              type: "number" as const,
              description: "Minimum price in USD"
            },
            priceMax: {
              type: "number" as const,
              description: "Maximum price in USD"
            },
            brand: {
              type: "string" as const,
              description: "Preferred brand name"
            },
            rating: {
              type: "number" as const,
              description: "Minimum rating (1-5 scale)"
            },
            features: {
              type: "array" as const,
              items: { type: "string" as const },
              description: "List of desired features or attributes"
            },
            keywords: {
              type: "array" as const,
              items: { type: "string" as const },
              description: "Key search terms extracted from the query"
            },
          },
          required: ["query", "keywords"],
        },
      };

      const prompt = `Extract product search parameters from this voice command: "${args.voiceTranscript}"

Extract all relevant information including:
- The main product being searched for
- Any price constraints mentioned
- Desired features or specifications
- Brand preferences
- Category of product
- Any quality indicators (ratings, reviews)

Return structured data that can be used to search for products.`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ functionDeclarations: [functionDeclaration as any] }],
      });

      const response = result.response;
      const functionCall = response.functionCalls()?.[0];

      if (!functionCall) {
        // Fallback: basic keyword extraction
        const keywords = args.voiceTranscript
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 3);

        const params = {
          query: args.voiceTranscript,
          keywords: keywords.slice(0, 5),
        };

        await ctx.runMutation(api.productSearch.updateSearchParams, {
          searchId: args.searchId,
          parameters: params,
        });

        return params;
      }

      const extractedParams = functionCall.args as any;

      // Store extracted parameters and update search
      await ctx.runMutation(api.productSearch.updateSearchParams, {
        searchId: args.searchId,
        parameters: extractedParams,
      });

      return extractedParams;
    } catch (error) {
      console.error("Error extracting search parameters:", error);

      // Update search status to failed
      await ctx.runMutation(api.productSearch.updateSearchStatus, {
        searchId: args.searchId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Failed to extract search parameters",
      });

      throw error;
    }
  },
});

// Update search parameters
export const updateSearchParams = mutation({
  args: {
    searchId: v.id("productSearches"),
    parameters: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.searchId, {
      parameters: args.parameters,
      status: "searching",
    });
  },
});

// Update search status
export const updateSearchStatus = mutation({
  args: {
    searchId: v.id("productSearches"),
    status: v.union(
      v.literal("pending"),
      v.literal("searching"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const update: any = {
      status: args.status,
    };

    if (args.status === "completed" || args.status === "failed") {
      update.completedAt = Date.now();
    }

    if (args.errorMessage) {
      update.errorMessage = args.errorMessage;
    }

    await ctx.db.patch(args.searchId, update);
  },
});

// Log search to history
export const logSearchHistory = mutation({
  args: {
    userId: v.string(),
    query: v.string(),
    resultCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("searchHistory", {
      userId: args.userId,
      query: args.query,
      resultCount: args.resultCount,
      searchedAt: Date.now(),
    });
  },
});

// Get a specific search
export const getSearch = query({
  args: { searchId: v.id("productSearches") },
  handler: async (ctx, args) => {
    const search = await ctx.db.get(args.searchId);
    if (!search) {
      return null;
    }

    // Verify user has access
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== search.userId) {
      throw new Error("Unauthorized");
    }

    return search;
  },
});

// Get user's recent searches
export const getUserSearches = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    const searches = await ctx.db
      .query("productSearches")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 20);

    return searches;
  },
});

// Get user's search history
export const getSearchHistory = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("searchHistory")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 10);
  },
});

// Import for internal API calls
import { api } from "./_generated/api";
