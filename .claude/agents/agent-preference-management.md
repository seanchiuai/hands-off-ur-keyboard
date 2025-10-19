---
name: agent-preference-management
description: User preference management system with voice-based tag extraction and refined product search capabilities
model: inherit
color: purple
tech_stack:
  framework: Next.js
  database: Convex
  auth: Clerk
  provider: Gemini API, BrightData MCP
generated: 2025-10-18T00:00:00Z
documentation_sources: [
  "https://docs.convex.dev/database/schemas",
  "https://ai.google.dev/gemini-api/docs",
  "https://docs.brightdata.com/",
  "https://sdk.vercel.ai/docs"
]
---

# Agent: User Preference Management and Product Refinement Implementation with Gemini API

## Agent Overview

**Purpose** – This agent implements a comprehensive user preference management system that extracts, stores, and displays user preferences as structured tags based on voice interactions. It enables users to refine product searches through natural voice commands requesting cheaper alternatives or specific features, triggering intelligent refined searches through BrightData MCP.

**Tech Stack** – Next.js for frontend framework, Convex for real-time database with preference storage, Clerk for user authentication, Gemini API for intelligent preference extraction and query understanding, BrightData MCP for refined product searches.

**Source** – Official documentation from Convex database schemas, Gemini API structured output generation, BrightData search integration, and Vercel AI SDK for streaming responses.

## Critical Implementation Knowledge

### Gemini API Latest Updates 🚨

* **Structured Output Support** – Gemini 1.5 and 2.0 models now support structured JSON output through response schemas, enabling reliable preference tag extraction from unstructured voice input.
* **Function Calling** – Native function calling capabilities allow the model to determine when to trigger product refinement searches versus simple conversation.
* **Multimodal Understanding** – Gemini can process both voice transcripts and product images to better understand user preferences and context.
* **Long Context Window** – Support for up to 2M tokens enables tracking entire conversation history for accurate preference accumulation.

### Common Pitfalls & Solutions 🚨

* **Pitfall**: Preferences extracted inconsistently from conversational text
  * **Solution**: Use Gemini's response schema with strict JSON mode to enforce structured tag extraction with category, value, and priority fields.

* **Pitfall**: Duplicate or conflicting preferences accumulate over time
  * **Solution**: Implement preference merging logic that detects semantic duplicates and resolves conflicts based on recency and user confirmation.

* **Pitfall**: Voice commands for refinement ("find cheaper", "show bigger options") not recognized reliably
  * **Solution**: Use Gemini function calling with explicit refinement action schemas including price_adjustment, feature_addition, and feature_removal types.

* **Pitfall**: Database queries for preferences become slow with many users
  * **Solution**: Create Convex indexes on userId and createdAt fields, implement pagination for preference history.

* **Pitfall**: Tag display clutters UI when users accumulate many preferences
  * **Solution**: Group preferences by category, show only top 5-7 most recent/relevant tags with expandable "show more" option.

### Best Practices 🚨

* **DO** validate and sanitize all preference tags before storing to prevent injection attacks
* **DO** implement preference expiration or archiving after 30-90 days of inactivity
* **DO** provide visual feedback when preferences are extracted and saved from voice
* **DO** allow users to manually edit or remove preference tags through UI controls
* **DO** use semantic similarity checking to merge related preferences (e.g., "wooden" and "wood finish")
* **DON'T** store raw voice transcripts without user consent - extract tags only
* **DON'T** trigger refinement searches without confirming user intent first
* **DON'T** assume preference categories - let Gemini infer appropriate groupings
* **DON'T** block UI while extracting preferences - process asynchronously
* **DON'T** expose preference data across users - enforce strict user-scoped queries

## Implementation Steps

### Architecture Overview

The preference management system consists of three core flows: (1) preference extraction from voice transcripts using Gemini structured outputs, (2) preference storage and retrieval in Convex with user isolation, and (3) refinement search triggering based on voice commands analyzed by Gemini function calling. The system maintains a user preference graph that evolves over time while enabling real-time tag display and product search refinement.

### Backend Implementation

* **convex/schema.ts** – Defines user preferences table with fields for userId, category, tagValue, priority, createdAt, and source (voice/manual). Includes indexes for efficient user-scoped queries.

* **convex/preferences.ts** – Mutation functions for saving extracted preferences, querying user preference history, merging duplicate tags, and deleting preferences. Implements authentication checks and user isolation.

* **convex/refinementActions.ts** – Action functions that receive refinement requests (cheaper, bigger, specific features), analyze current search context, and trigger BrightData MCP searches with updated parameters.

* **app/api/extract-preferences/route.ts** – Next.js API route that receives voice transcripts, calls Gemini API with structured output schema to extract preference tags, and stores results in Convex.

* **app/api/analyze-refinement/route.ts** – API route that analyzes user voice commands to detect refinement intents using Gemini function calling, returning action type and parameters for search refinement.

### Frontend Integration

* **components/PreferenceTagList.tsx** – React component that displays user preferences as interactive tags grouped by category, with remove and edit capabilities. Subscribes to Convex query for real-time updates.

* **hooks/usePreferenceExtraction.ts** – Custom hook that processes voice transcripts, calls the extraction API, handles loading states, and triggers preference saves to Convex.

* **hooks/useRefinementSearch.ts** – Hook that detects refinement commands in voice input, analyzes intent through API, and triggers BrightData searches with refined parameters.

* **components/VoicePreferenceIndicator.tsx** – Visual component that shows real-time feedback when preferences are being extracted from voice, displaying extracted tags before confirmation.

* **utils/preferenceGrouping.ts** – Client-side utility functions for grouping preferences by category, detecting duplicates, and formatting tags for display.

## Code Patterns

### `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // User preference tags extracted from voice interactions
  userPreferences: defineTable({
    userId: v.string(), // Clerk user ID
    category: v.string(), // e.g., "material", "size", "price", "color"
    tagValue: v.string(), // e.g., "wooden", "at least 3ft", "under $20"
    priority: v.number(), // 1-10 scale, higher = more important
    source: v.union(v.literal("voice"), v.literal("manual")), // How tag was created
    productContext: v.optional(v.string()), // Product type this preference applies to
    createdAt: v.number(), // Timestamp for sorting and expiration
    lastUsedAt: v.number(), // Track when preference was last applied
  })
    .index("by_user", ["userId"]) // Fast user-scoped queries
    .index("by_user_and_category", ["userId", "category"]) // Category filtering
    .index("by_user_and_created", ["userId", "createdAt"]), // Recent preferences

  // Search refinement history for tracking user refinement patterns
  refinementHistory: defineTable({
    userId: v.string(),
    originalSearchId: v.string(), // Reference to initial search
    refinementType: v.union(
      v.literal("price_lower"),
      v.literal("price_higher"),
      v.literal("add_feature"),
      v.literal("remove_feature"),
      v.literal("change_size")
    ),
    refinementValue: v.string(), // Specific refinement detail
    resultCount: v.number(), // How many results the refinement returned
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});
```

This schema ensures efficient user-scoped queries while supporting flexible preference categorization and search refinement tracking.

### `convex/preferences.ts`

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save new preference tags extracted from voice
export const savePreferences = mutation({
  args: {
    preferences: v.array(
      v.object({
        category: v.string(),
        tagValue: v.string(),
        priority: v.number(),
        productContext: v.optional(v.string()),
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

    // Check for duplicates and merge if needed
    const existingPrefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const savedIds = [];

    for (const pref of preferences) {
      // Look for semantic duplicates in same category
      const duplicate = existingPrefs.find(
        (existing) =>
          existing.category === pref.category &&
          areSimilarTags(existing.tagValue, pref.tagValue)
      );

      if (duplicate) {
        // Update existing preference with new priority and timestamp
        await ctx.db.patch(duplicate._id, {
          priority: Math.max(duplicate.priority, pref.priority),
          lastUsedAt: now,
        });
        savedIds.push(duplicate._id);
      } else {
        // Insert new preference
        const id = await ctx.db.insert("userPreferences", {
          userId,
          category: pref.category,
          tagValue: pref.tagValue,
          priority: pref.priority,
          productContext: pref.productContext,
          source: "voice",
          createdAt: now,
          lastUsedAt: now,
        });
        savedIds.push(id);
      }
    }

    return { success: true, preferenceIds: savedIds };
  },
});

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

  return false;
}

// Get active preferences for a user
export const getUserPreferences = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { category, limit = 50 }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject;

    let query = ctx.db
      .query("userPreferences")
      .withIndex(
        category ? "by_user_and_category" : "by_user",
        (q) => category
          ? q.eq("userId", userId).eq("category", category)
          : q.eq("userId", userId)
      )
      .order("desc");

    const preferences = await query.take(limit);

    // Group by category for structured display
    const grouped = preferences.reduce((acc, pref) => {
      if (!acc[pref.category]) acc[pref.category] = [];
      acc[pref.category].push(pref);
      return acc;
    }, {} as Record<string, typeof preferences>);

    return { preferences, grouped };
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
```

This implementation ensures thread-safe preference management with duplicate detection and user isolation.

### `app/api/extract-preferences/route.ts`

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define structured output schema for preference extraction
const preferenceSchema = {
  type: "object",
  properties: {
    preferences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Category of preference (material, size, price, color, style, feature)",
          },
          tagValue: {
            type: "string",
            description: "Specific preference value extracted from conversation",
          },
          priority: {
            type: "number",
            description: "Priority from 1-10 based on user emphasis",
            minimum: 1,
            maximum: 10,
          },
          productContext: {
            type: "string",
            description: "Optional product type this preference applies to",
          },
        },
        required: ["category", "tagValue", "priority"],
      },
    },
  },
  required: ["preferences"],
};

export async function POST(req: NextRequest) {
  try {
    // Verify user authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { transcript, conversationHistory } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Invalid transcript" },
        { status: 400 }
      );
    }

    // Use Gemini model with structured output
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: preferenceSchema,
      },
    });

    const prompt = `You are a shopping preference extraction assistant. Analyze the following voice transcript from a shopping conversation and extract any user preferences mentioned.

Look for:
- Material preferences (wooden, metal, plastic, etc.)
- Size requirements (dimensions, capacity, etc.)
- Price constraints (under $X, around $Y, etc.)
- Color preferences
- Style preferences (modern, vintage, minimalist, etc.)
- Feature requirements (must have X, needs Y, etc.)

Consider the conversation context to determine priority (1-10) based on:
- Explicit emphasis ("I really need", "must have") = 8-10
- Strong preference ("I prefer", "I like") = 6-8
- Mild preference ("maybe", "ideally") = 4-6
- Mentioned in passing = 1-3

Previous conversation context:
${conversationHistory || "No previous context"}

Current user statement:
"${transcript}"

Extract all preferences as structured tags.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const extracted = JSON.parse(response);

    // Validate extracted preferences
    if (!extracted.preferences || !Array.isArray(extracted.preferences)) {
      return NextResponse.json(
        { error: "Invalid extraction result" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preferences: extracted.preferences,
    });
  } catch (error) {
    console.error("Preference extraction error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Extraction failed",
      },
      { status: 500 }
    );
  }
}
```

This API route leverages Gemini's structured output to reliably extract preference tags from natural conversation.

### `app/api/analyze-refinement/route.ts`

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define function calling schema for refinement detection
const refinementFunctions = [
  {
    name: "refine_product_search",
    description: "Refine the current product search based on user request for changes",
    parameters: {
      type: "object",
      properties: {
        refinementType: {
          type: "string",
          enum: ["price_lower", "price_higher", "add_feature", "remove_feature", "change_size"],
          description: "Type of refinement requested",
        },
        refinementValue: {
          type: "string",
          description: "Specific value for the refinement (e.g., price amount, feature name, size specification)",
        },
        targetPercentage: {
          type: "number",
          description: "For price refinements, percentage change requested (e.g., 20 for 20% cheaper)",
        },
      },
      required: ["refinementType", "refinementValue"],
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { voiceCommand, currentSearchContext } = await req.json();

    if (!voiceCommand) {
      return NextResponse.json(
        { error: "Missing voice command" },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      tools: [{ functionDeclarations: refinementFunctions }],
    });

    const prompt = `You are analyzing a user's voice command to determine if they want to refine their product search.

Current search context:
${JSON.stringify(currentSearchContext, null, 2)}

User's voice command:
"${voiceCommand}"

Common refinement patterns:
- "Find cheaper options" / "Show me something less expensive" → price_lower
- "I want better quality" / "Show premium options" → price_higher
- "Make it bigger" / "I need larger" → change_size (increase)
- "Show smaller versions" → change_size (decrease)
- "Must have [feature]" / "Add [feature]" → add_feature
- "Without [feature]" / "Remove [feature]" → remove_feature

Determine if this is a refinement request and call the appropriate function.`;

    const result = await model.generateContent(prompt);
    const response = result.response;

    // Check if function was called
    const functionCall = response.functionCalls()?.[0];

    if (!functionCall) {
      return NextResponse.json({
        isRefinement: false,
        message: "No refinement detected",
      });
    }

    return NextResponse.json({
      isRefinement: true,
      refinement: {
        type: functionCall.args.refinementType,
        value: functionCall.args.refinementValue,
        targetPercentage: functionCall.args.targetPercentage,
      },
    });
  } catch (error) {
    console.error("Refinement analysis error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
      },
      { status: 500 }
    );
  }
}
```

This route uses Gemini function calling to reliably detect and classify search refinement intents.

## Testing & Debugging

* **Convex Dashboard** – Monitor real-time preference insertions and queries, verify indexes are being used efficiently, check for authentication errors in function logs.

* **Gemini API Playground** – Test preference extraction prompts with various voice transcripts to validate structured output quality before integrating.

* **Unit Tests** – Test preference merging logic with Jest, validate duplicate detection with various similar tag inputs, test category grouping edge cases.

* **Integration Tests** – Use Playwright to test end-to-end flow: voice input → extraction → Convex save → tag display, verify refinement search triggers with voice commands.

* **Logging Strategy** – Log extraction confidence scores from Gemini responses, track preference save failures with detailed error context, monitor refinement search trigger rates.

* **Performance Monitoring** – Track Gemini API latency for extraction calls, measure Convex query performance for getUserPreferences, monitor BrightData search response times for refinements.

## Environment Variables

```bash
# Frontend (.env.local)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_***
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Backend (Convex Dashboard)
CLERK_JWT_ISSUER_DOMAIN=https://your-domain.clerk.accounts.dev

# API Routes (.env.local)
GEMINI_API_KEY=AIza***
BRIGHTDATA_API_KEY=***
BRIGHTDATA_MCP_ENDPOINT=https://api.brightdata.com/mcp

# Optional
PREFERENCE_EXPIRATION_DAYS=90
MAX_PREFERENCES_PER_USER=500
```

## Success Metrics

* **Preference Extraction Accuracy** – 90%+ of user-stated preferences correctly extracted and categorized from voice transcripts
* **Real-time Tag Display** – Preference tags appear in UI within 2 seconds of voice input completion
* **Duplicate Reduction** – Less than 5% duplicate preferences stored after semantic similarity merging
* **Refinement Intent Detection** – 95%+ accuracy in detecting and classifying refinement commands ("find cheaper", "make it bigger")
* **Search Refinement Success** – 80%+ of refinement searches return relevant results matching user intent
* **User Engagement** – Users actively remove/edit less than 10% of auto-extracted preferences (indicating high accuracy)
* **Database Performance** – Preference queries return in under 100ms for users with up to 500 stored preferences
* **Authentication Security** – Zero unauthorized access to other users' preference data in production
