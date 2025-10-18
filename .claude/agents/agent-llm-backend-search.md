---
name: agent-llm-backend-search
description: LLM backend using Gemini API with BrightData MCP for product search and preference management
model: inherit
color: purple
tech_stack:
  framework: Next.js
  database: Convex
  auth: Clerk
  provider: Gemini + BrightData MCP
generated: 2025-10-18T00:00:00Z
documentation_sources: [
  "https://ai.google.dev/gemini-api/docs",
  "https://ai.google.dev/gemini-api/docs/function-calling",
  "https://docs.convex.dev",
  "https://brightdata.com/products/web-scraper"
]
---

# Agent: LLM Backend Search Implementation with Gemini and BrightData MCP

## Agent Overview

This agent serves as the intelligent backend that processes user requests, executes product searches via BrightData MCP, manages user preferences, and coordinates responses. It receives natural language queries from the voice agent through Convex, uses Gemini's function calling to invoke BrightData MCP for product research, maintains a preference list based on user criteria, and sends structured product data to the dynamic interface agent for display.

**Tech Stack**: Gemini API, BrightData MCP, Convex (database & real-time sync), Next.js (API routes), TypeScript

**Source**: Gemini API documentation, Convex documentation, BrightData Web Scraper

## Critical Implementation Knowledge

### Gemini API Latest Updates 🚨

* Gemini 2.0 Flash supports advanced function calling with multiple tool declarations
* Function calling allows defining external tools with OpenAPI-style parameter schemas
* Dynamic retrieval mode enables automatic decision on when to use search tools
* Supports streaming responses for real-time user feedback
* Tool choice can be automatic or forced for specific function invocations
* Multimodal capabilities allow processing both text and image inputs

### Common Pitfalls & Solutions 🚨

* **Pitfall**: Function declarations not properly typed with required parameters
  * **Solution**: Always define parameters using OpenAPI schema format with explicit "required" array

* **Pitfall**: BrightData MCP responses not parsed before sending to UI
  * **Solution**: Create structured parser to extract product name, price, image, and details from raw MCP response

* **Pitfall**: Preference list duplicates similar criteria
  * **Solution**: Implement preference deduplication logic using semantic similarity before storing

* **Pitfall**: Gemini hallucinates product details instead of using function calls
  * **Solution**: Use tool_choice="auto" and provide clear function descriptions that match user intent patterns

* **Pitfall**: Convex mutations not properly ordered causing race conditions
  * **Solution**: Use Convex's transactional mutations and await all database writes sequentially

### Best Practices 🚨

* Define clear, specific function declarations for each product search operation
* Implement retry logic for BrightData MCP calls with exponential backoff
* Store conversation history in Convex to maintain context across sessions
* Use Convex real-time queries to sync preferences across all agent instances
* Validate all MCP responses before processing to handle malformed data
* Implement rate limiting for Gemini API calls to stay within quota
* Cache common search results in Convex to reduce MCP calls
* Use structured output format for consistent product data schema

## Implementation Steps

The architecture consists of Convex functions that process voice messages, call Gemini with BrightData MCP tools, and sync results to the UI agent.

### Backend Implementation

* `convex/llm/gemini.ts` - Gemini API client with function calling setup
* `convex/llm/tools.ts` - BrightData MCP tool declarations and handlers
* `convex/messages.ts` - Processes user messages and orchestrates LLM + search
* `convex/preferences.ts` - Manages user preference list CRUD operations
* `convex/products.ts` - Stores and retrieves product search results

### Frontend Integration

* `app/api/mcp/brightdata/route.ts` - Proxy endpoint for BrightData MCP calls
* `lib/gemini-client.ts` - Gemini API client configuration
* `lib/mcp-parser.ts` - Parses BrightData MCP responses into product schema
* `types/product.ts` - TypeScript types for product data structure

## Code Patterns

### `convex/llm/tools.ts`

```typescript
import { v } from "convex/values";

// BrightData MCP tool declaration for Gemini
export const productSearchTool = {
  name: "search_products",
  description: "Searches for products based on user criteria including name, features, price range, and other specifications. Returns a list of relevant products with details.",
  parameters: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Natural language search query for the product (e.g., 'wooden desk at least 3ft under $200')"
      },
      priceMin: {
        type: "number",
        description: "Minimum price in USD (optional)"
      },
      priceMax: {
        type: "number",
        description: "Maximum price in USD (optional)"
      },
      features: {
        type: "array",
        items: { type: "string" },
        description: "List of required features or specifications"
      }
    },
    required: ["query"]
  }
};

export const savePreferenceTool = {
  name: "save_preference",
  description: "Saves a user preference as a tag for future product searches (e.g., 'wooden', 'at least 3ft', 'under $20')",
  parameters: {
    type: "object" as const,
    properties: {
      preference: {
        type: "string",
        description: "The preference tag to save"
      },
      category: {
        type: "string",
        description: "Category of preference: 'material', 'size', 'price', 'feature', or 'other'"
      }
    },
    required: ["preference", "category"]
  }
};

export const removePreferenceTool = {
  name: "remove_preference",
  description: "Removes a previously saved preference tag",
  parameters: {
    type: "object" as const,
    properties: {
      preferenceId: {
        type: "string",
        description: "The ID of the preference to remove"
      }
    },
    required: ["preferenceId"]
  }
};

// Tool handlers
export async function handleProductSearch(
  args: { query: string; priceMin?: number; priceMax?: number; features?: string[] }
): Promise<any> {
  // Call BrightData MCP via API route
  const response = await fetch(process.env.BRIGHTDATA_MCP_ENDPOINT!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BRIGHTDATA_API_KEY}`
    },
    body: JSON.stringify({
      tool: 'product_search',
      params: {
        query: args.query,
        filters: {
          price_min: args.priceMin,
          price_max: args.priceMax,
          features: args.features
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`BrightData MCP error: ${response.statusText}`);
  }

  return await response.json();
}
```

This module defines the function declarations for Gemini and implements handlers for BrightData MCP integration.

### `convex/messages.ts`

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { GoogleGenAI } from "@google/genai";
import { productSearchTool, savePreferenceTool, removePreferenceTool, handleProductSearch } from "./llm/tools";
import { api } from "./_generated/api";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!
});

export const processUserMessage = mutation({
  args: {
    sessionId: v.string(),
    message: v.string(),
    timestamp: v.number()
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    // Store user message
    await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      userId: userId.subject,
      role: "user",
      content: args.message,
      timestamp: args.timestamp
    });

    // Get conversation history
    const history = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(10);

    // Get user preferences
    const preferences = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId.subject))
      .collect();

    const preferenceTags = preferences.map(p => p.preference).join(", ");

    // Build conversation context
    const messages = [
      {
        role: "system",
        content: `You are a helpful shopping assistant. The user has these saved preferences: ${preferenceTags || 'none'}. Help them find products, manage preferences, and make purchasing decisions. Use the available tools to search for products and manage preferences.`
      },
      ...history.reverse().map(m => ({
        role: m.role,
        content: m.content
      })),
      {
        role: "user",
        content: args.message
      }
    ];

    // Call Gemini with function calling
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: messages.map(m => ({
        role: m.role === "system" ? "user" : m.role,
        parts: [{ text: m.content }]
      })),
      config: {
        tools: [{
          functionDeclarations: [
            productSearchTool,
            savePreferenceTool,
            removePreferenceTool
          ]
        }],
        toolChoice: "auto"
      }
    });

    // Process function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const functionCall of response.functionCalls) {
        if (functionCall.name === "search_products") {
          // Execute product search via BrightData MCP
          const searchResults = await handleProductSearch(functionCall.args);

          // Parse and store products
          const productIds = [];
          for (const product of searchResults.products || []) {
            const productId = await ctx.db.insert("products", {
              sessionId: args.sessionId,
              userId: userId.subject,
              name: product.title,
              price: product.price,
              imageUrl: product.image_url,
              details: product.description,
              url: product.product_url,
              createdAt: Date.now()
            });
            productIds.push(productId);
          }

          // Store assistant response
          await ctx.db.insert("messages", {
            sessionId: args.sessionId,
            userId: userId.subject,
            role: "assistant",
            content: `I found ${productIds.length} products matching your criteria. Take a look at the options displayed.`,
            timestamp: Date.now(),
            metadata: { productIds }
          });

        } else if (functionCall.name === "save_preference") {
          // Save preference
          await ctx.db.insert("preferences", {
            userId: userId.subject,
            preference: functionCall.args.preference,
            category: functionCall.args.category,
            createdAt: Date.now()
          });

          await ctx.db.insert("messages", {
            sessionId: args.sessionId,
            userId: userId.subject,
            role: "assistant",
            content: `I've saved "${functionCall.args.preference}" to your preferences.`,
            timestamp: Date.now()
          });

        } else if (functionCall.name === "remove_preference") {
          // Remove preference
          await ctx.db.delete(functionCall.args.preferenceId);

          await ctx.db.insert("messages", {
            sessionId: args.sessionId,
            userId: userId.subject,
            role: "assistant",
            content: `I've removed that preference.`,
            timestamp: Date.now()
          });
        }
      }
    } else if (response.text) {
      // Store text response
      await ctx.db.insert("messages", {
        sessionId: args.sessionId,
        userId: userId.subject,
        role: "assistant",
        content: response.text,
        timestamp: Date.now()
      });
    }

    return { success: true };
  }
});

export const getConversationHistory = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) return [];

    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  }
});
```

This mutation processes user messages, calls Gemini with function declarations, executes BrightData MCP searches, and stores results in Convex.

### `convex/preferences.ts`

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) return [];

    return await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId.subject))
      .order("desc")
      .collect();
  }
});

export const add = mutation({
  args: {
    preference: v.string(),
    category: v.string()
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    // Check for duplicates
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", userId.subject))
      .filter((q) => q.eq(q.field("preference"), args.preference))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("preferences", {
      userId: userId.subject,
      preference: args.preference,
      category: args.category,
      createdAt: Date.now()
    });
  }
});

export const remove = mutation({
  args: { id: v.id("preferences") },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    const preference = await ctx.db.get(args.id);
    if (!preference || preference.userId !== userId.subject) {
      throw new Error("Preference not found");
    }

    await ctx.db.delete(args.id);
  }
});
```

This module manages the user preference list with CRUD operations, ensuring preferences are deduplicated and properly scoped to users.

### `convex/products.ts`

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listForSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) return [];

    return await ctx.db
      .query("products")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();
  }
});

export const save = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    // Mark product as saved
    await ctx.db.patch(args.productId, {
      saved: true,
      savedAt: Date.now()
    });

    return { success: true };
  }
});

export const remove = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product || product.userId !== userId.subject) {
      throw new Error("Product not found");
    }

    await ctx.db.delete(args.productId);
  }
});
```

This module handles product storage and retrieval, allowing users to save or remove products by number.

## Testing & Debugging

* Use Gemini API playground to test function calling declarations independently
* Monitor BrightData MCP dashboard for search request rates and response times
* Test function calling with various user intents to ensure correct tool selection
* Verify preference deduplication by adding similar preferences
* Use Convex dashboard to inspect real-time database mutations
* Test error handling for BrightData MCP failures with mock responses
* Validate product schema parsing with various MCP response formats
* Monitor Gemini API quota usage to prevent rate limit errors

## Environment Variables

### Frontend/Backend (Next.js + Convex)
```bash
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOYMENT=your-deployment-name
GEMINI_API_KEY=your_gemini_api_key
BRIGHTDATA_API_KEY=your_brightdata_api_key
BRIGHTDATA_MCP_ENDPOINT=https://api.brightdata.com/mcp/v1
CLERK_SECRET_KEY=your_clerk_secret_key
```

### Convex Environment Variables
```bash
GEMINI_API_KEY=your_gemini_api_key  # Set via Convex dashboard
```

## Success Metrics

* Gemini function calling correctly identifies search intent >90% of time
* BrightData MCP searches return results within 3 seconds
* Product data parsing handles 95%+ of MCP response formats
* Preference list correctly deduplicates similar entries
* Conversation context maintains continuity across 10+ turns
* Real-time sync to UI agent occurs within 500ms of product insertion
* Function call retry logic successfully handles transient MCP failures
* Gemini API calls stay within rate limits during normal usage
