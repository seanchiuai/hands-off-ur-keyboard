---
name: agent-product-search-integration
description: Automated product search functionality using Gemini API connected to BrightData MCP for voice-driven shopping
model: inherit
color: teal
tech_stack:
  framework: Next.js
  database: Convex
  auth: Clerk
  provider: Gemini API with BrightData MCP
generated: 2025-10-18T00:00:00Z
documentation_sources: [
  "https://ai.google.dev/gemini-api/docs",
  "https://brightdata.com/products/web-scraper",
  "https://docs.convex.dev/quickstart/nextjs",
  "https://clerk.com/docs/references/nextjs/overview"
]
---

# Agent: Product Search Integration Implementation with Gemini API and BrightData MCP

---

## Agent Overview

This agent implements automated product search functionality that processes voice commands through Gemini API, retrieves product data via BrightData MCP, and displays results in a numbered format for seamless voice-driven shopping experiences. The system integrates with Next.js frontend, Convex backend for data persistence, and Clerk for authentication, creating a complete end-to-end product discovery pipeline optimized for hands-free interaction.

**Tech Stack:** Next.js, Convex, Clerk, Gemini API, BrightData MCP

**Sources:** Gemini API Documentation, BrightData Web Scraper API, Convex Quickstart, Clerk Next.js Reference

---

## Critical Implementation Knowledge

### Gemini API Latest Updates 🚨

* Gemini 2.0 Flash supports multimodal inputs including audio for direct voice command processing
* Function calling capabilities enable structured product search parameters extraction
* Streaming responses reduce latency for real-time search feedback
* Context caching reduces API costs for repeated product category searches
* Safety settings must be configured to prevent product recommendation manipulation

### Common Pitfalls & Solutions 🚨

* **Pitfall:** BrightData API rate limits cause search failures during peak usage
  * **Solution:** Implement request queuing with exponential backoff and cache frequent searches in Convex

* **Pitfall:** Gemini API extracts incorrect product attributes from ambiguous voice commands
  * **Solution:** Use structured function calling with explicit parameter schemas and confirmation prompts

* **Pitfall:** Product results exceed voice-friendly limits (too many items to read aloud)
  * **Solution:** Limit to top 5 results by default, allow voice navigation with "show more" commands

* **Pitfall:** Authentication tokens expire during long shopping sessions
  * **Solution:** Implement token refresh logic in frontend with Clerk session management

* **Pitfall:** BrightData returns inconsistent product data schemas across retailers
  * **Solution:** Normalize product data with validation layer before storing in Convex

### Best Practices 🚨

* **DO** validate and sanitize all voice-extracted search parameters before API calls
* **DO** implement progressive result loading to maintain responsiveness
* **DO** cache common product searches in Convex to reduce external API costs
* **DO** use numbered formatting for voice readability (1-5 scale)
* **DO** log all search queries for analytics and debugging
* **DON'T** expose BrightData API keys in frontend code
* **DON'T** store raw product data without normalization
* **DON'T** skip authentication checks on search endpoints
* **DON'T** return unfiltered results without pagination
* **DON'T** assume BrightData responses are always complete

---

## Implementation Steps

The architecture follows a three-tier pattern: Frontend captures voice input and displays numbered results, Gemini API processes natural language to extract search parameters, and BrightData MCP retrieves product data which is normalized and cached in Convex for fast retrieval.

### Backend Implementation

* **convex/productSearch.ts** - Main search logic with Gemini API integration, parameter extraction, and BrightData query orchestration
* **convex/productCache.ts** - Redis-like caching layer for frequently searched products to reduce API costs
* **convex/productNormalizer.ts** - Data transformation layer to standardize BrightData responses across retailers
* **convex/searchHistory.ts** - User search history tracking for personalization and analytics
* **convex/http.ts** - HTTP endpoints for BrightData webhook callbacks and external integrations

### Frontend Integration

* **app/search/page.tsx** - Main search interface with voice input and numbered results display
* **components/VoiceSearchInput.tsx** - Voice capture component with real-time transcription
* **components/ProductResultsList.tsx** - Numbered product cards optimized for voice navigation
* **hooks/useProductSearch.ts** - Custom hook wrapping Convex queries with loading states
* **hooks/useVoiceCommands.ts** - Voice command parser for navigation and filtering

---

## Code Patterns

### `convex/productSearch.ts`

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Schema for search parameters extracted by Gemini
const searchParamsSchema = v.object({
  query: v.string(),
  category: v.optional(v.string()),
  priceMin: v.optional(v.number()),
  priceMax: v.optional(v.number()),
  brand: v.optional(v.string()),
  rating: v.optional(v.number()),
});

// Extract structured search parameters from voice input using Gemini
export const extractSearchParams = mutation({
  args: {
    voiceTranscript: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    // Function declaration for structured output
    const functionDeclaration = {
      name: "extract_product_search_params",
      description: "Extract product search parameters from natural language",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Main search query" },
          category: { type: "string", description: "Product category" },
          priceMin: { type: "number", description: "Minimum price" },
          priceMax: { type: "number", description: "Maximum price" },
          brand: { type: "string", description: "Brand preference" },
          rating: { type: "number", description: "Minimum rating (1-5)" },
        },
        required: ["query"],
      },
    };

    const prompt = `Extract product search parameters from: "${args.voiceTranscript}"`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ functionDeclarations: [functionDeclaration] }],
    });

    const functionCall = result.response.functionCalls()?.[0];
    if (!functionCall) {
      throw new Error("Failed to extract search parameters");
    }

    // Store search in history
    await ctx.db.insert("searchHistory", {
      userId: args.userId,
      transcript: args.voiceTranscript,
      extractedParams: functionCall.args,
      timestamp: Date.now(),
    });

    return functionCall.args;
  },
});

// Search products using BrightData MCP
export const searchProducts = mutation({
  args: {
    userId: v.string(),
    searchParams: searchParamsSchema,
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Check cache first
    const cacheKey = JSON.stringify(args.searchParams);
    const cached = await ctx.db
      .query("productCache")
      .withIndex("by_cache_key", (q) => q.eq("cacheKey", cacheKey))
      .first();

    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour
      return cached.results;
    }

    // Call BrightData MCP
    const brightDataUrl = process.env.BRIGHTDATA_MCP_ENDPOINT!;
    const response = await fetch(brightDataUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
      },
      body: JSON.stringify({
        query: args.searchParams.query,
        filters: {
          category: args.searchParams.category,
          price_range: {
            min: args.searchParams.priceMin,
            max: args.searchParams.priceMax,
          },
          brand: args.searchParams.brand,
          rating_min: args.searchParams.rating,
        },
        limit: 5, // Top 5 for voice navigation
      }),
    });

    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.statusText}`);
    }

    const rawResults = await response.json();

    // Normalize results
    const normalizedResults = rawResults.products.map((product: any, index: number) => ({
      number: index + 1, // For voice navigation
      title: product.name || product.title,
      price: parseFloat(product.price?.replace(/[^0-9.]/g, "") || "0"),
      rating: product.rating || 0,
      reviews: product.review_count || 0,
      url: product.url,
      image: product.image_url,
      brand: product.brand,
      retailer: product.retailer,
    }));

    // Cache results
    await ctx.db.insert("productCache", {
      cacheKey,
      results: normalizedResults,
      timestamp: Date.now(),
    });

    // Store search result
    await ctx.db.insert("searchResults", {
      userId: args.userId,
      searchParams: args.searchParams,
      results: normalizedResults,
      resultCount: normalizedResults.length,
      timestamp: Date.now(),
    });

    return normalizedResults;
  },
});

// Get user's search history
export const getSearchHistory = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
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
```

This module implements the core product search pipeline with Gemini API for parameter extraction and BrightData for product retrieval. Authentication is enforced on all operations, and caching reduces external API costs.

### `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  searchHistory: defineTable({
    userId: v.string(),
    transcript: v.string(),
    extractedParams: v.any(),
    timestamp: v.number(),
  }).index("by_user", ["userId"]),

  searchResults: defineTable({
    userId: v.string(),
    searchParams: v.object({
      query: v.string(),
      category: v.optional(v.string()),
      priceMin: v.optional(v.number()),
      priceMax: v.optional(v.number()),
      brand: v.optional(v.string()),
      rating: v.optional(v.number()),
    }),
    results: v.array(v.any()),
    resultCount: v.number(),
    timestamp: v.number(),
  }).index("by_user_timestamp", ["userId", "timestamp"]),

  productCache: defineTable({
    cacheKey: v.string(),
    results: v.array(v.any()),
    timestamp: v.number(),
  }).index("by_cache_key", ["cacheKey"]),
});
```

This schema defines the data model for search history, results, and caching, with indexes optimized for user-scoped queries and cache lookups.

### `app/search/page.tsx`

```typescript
"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import VoiceSearchInput from "@/components/VoiceSearchInput";
import ProductResultsList from "@/components/ProductResultsList";
import { useState } from "react";

export default function SearchPage() {
  const { user } = useUser();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const extractParams = useMutation(api.productSearch.extractSearchParams);
  const searchProducts = useMutation(api.productSearch.searchProducts);

  const handleVoiceSearch = async (transcript: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Step 1: Extract parameters from voice
      const params = await extractParams({
        voiceTranscript: transcript,
        userId: user.id,
      });

      // Step 2: Search products
      const results = await searchProducts({
        userId: user.id,
        searchParams: params,
      });

      setProducts(results);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Voice Product Search</h1>

      <VoiceSearchInput
        onTranscript={handleVoiceSearch}
        isLoading={isLoading}
      />

      {isLoading && (
        <div className="text-center mt-8">Searching products...</div>
      )}

      {!isLoading && products.length > 0 && (
        <ProductResultsList products={products} />
      )}
    </div>
  );
}
```

This frontend component orchestrates the two-step search process (parameter extraction then product retrieval) with loading states and authentication checks.

---

## Testing & Debugging

* **Gemini API Console** - Monitor function calling accuracy and parameter extraction quality
* **BrightData Dashboard** - Track API usage, rate limits, and response times
* **Convex Dashboard** - Monitor mutations, query performance, and cache hit rates
* **Clerk Dashboard** - Verify authentication flows and user sessions
* **Unit Tests** - Test parameter extraction with various voice transcripts using Jest
* **Integration Tests** - End-to-end search flow with mocked BrightData responses
* **Voice Testing** - Collect real voice samples to validate transcription accuracy
* **Load Testing** - Simulate concurrent searches to validate caching and rate limiting

---

## Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_*****  # Clerk authentication
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud  # Convex backend
```

### Backend (Convex Dashboard)
```bash
GEMINI_API_KEY=*****  # Google AI Studio API key
BRIGHTDATA_API_KEY=*****  # BrightData authentication
BRIGHTDATA_MCP_ENDPOINT=https://api.brightdata.com/mcp/v1/search  # BrightData API endpoint
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain.clerk.accounts.dev  # JWT validation
```

---

## Success Metrics

* Product search completes within 3 seconds from voice input to results display
* Parameter extraction accuracy exceeds 95% for common product queries
* Numbered format displays 5 results optimized for voice readback
* Cache hit rate exceeds 40% for repeated searches reducing API costs
* User authentication validates on every search request preventing unauthorized access
* Search history persists correctly for personalization and analytics
* BrightData rate limits never exceeded with proper queuing implementation
* Zero exposed API keys in frontend bundle verified by build analysis
