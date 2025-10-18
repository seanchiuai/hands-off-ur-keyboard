# Roadmap: User Preference Management

## Context

**Tech Stack**: Next.js 15 (App Router), Convex (Backend), Gemini Live API (NLP), Zod (Validation), React 19

**Feature Description**: Capture, store, and display user shopping preferences as tags (e.g., "wooden", "at least 3ft", "under $20"). Preferences are extracted from voice conversations and used to personalize future product searches.

**Goals**:
- Automatic preference extraction from voice conversations
- Tag-based preference display in UI
- Voice commands to add/remove preferences
- Preference-based search filtering
- Preference history and analytics
- Privacy controls for preference data

## Implementation Steps

Each step is mandatory for shipping the User Preference Management feature.

### 1. Manual Setup (User Required)

- [ ] Configure Gemini API for NLP preference extraction
- [ ] Set up Convex functions for preference management
- [ ] Review privacy compliance (GDPR/CCPA) for storing preferences
- [ ] Configure preference data retention policies
- [ ] Set up analytics for preference usage

### 2. Dependencies & Environment

**NPM Packages**:
```bash
npm install zod
npm install @google/genai
npm install date-fns  # For date formatting
npm install @radix-ui/react-popover
npm install @radix-ui/react-dropdown-menu
```

**Environment Variables** (`.env.local`):
```bash
# Gemini API (already configured)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-exp

# Convex (already configured)
NEXT_PUBLIC_CONVEX_URL=your_convex_url

# Preference Settings
PREFERENCE_RETENTION_DAYS=365
MAX_PREFERENCES_PER_USER=50
PREFERENCE_CONFIDENCE_THRESHOLD=0.7
```

### 3. Database Schema

**Convex Schema** (`convex/schema.ts`):

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // User preferences as tags
  userPreferences: defineTable({
    userId: v.id("users"),
    // Preference data
    category: v.union(
      v.literal("material"),      // e.g., "wooden", "metal"
      v.literal("dimension"),      // e.g., "at least 3ft", "6 inches"
      v.literal("price"),          // e.g., "under $20", "budget-friendly"
      v.literal("feature"),        // e.g., "waterproof", "rechargeable"
      v.literal("brand"),          // e.g., "Nike", "Apple"
      v.literal("color"),          // e.g., "blue", "dark"
      v.literal("style"),          // e.g., "modern", "vintage"
      v.literal("other")           // Uncategorized preferences
    ),
    tag: v.string(),               // Display text: "wooden", "under $20"
    // Normalized values for filtering
    normalizedValue: v.optional(v.object({
      type: v.union(
        v.literal("text"),
        v.literal("numeric"),
        v.literal("range")
      ),
      value: v.union(v.string(), v.number()),
      unit: v.optional(v.string()),    // "USD", "ft", "inches"
      operator: v.optional(v.union(
        v.literal("eq"),    // equals
        v.literal("lt"),    // less than
        v.literal("lte"),   // less than or equal
        v.literal("gt"),    // greater than
        v.literal("gte")    // greater than or equal
      )),
    })),
    // Metadata
    confidence: v.number(),        // AI confidence score (0-1)
    source: v.union(
      v.literal("voice"),
      v.literal("manual"),
      v.literal("implicit")        // Inferred from behavior
    ),
    sessionId: v.optional(v.id("voiceSessions")),
    createdAt: v.number(),
    lastUsed: v.optional(v.number()),
    usageCount: v.number(),        // Times used in searches
    isActive: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_category", ["category"])
    .index("by_active", ["userId", "isActive"])
    .index("by_usage", ["userId", "usageCount"]),

  // Preference extraction history (for debugging)
  preferenceExtractions: defineTable({
    userId: v.id("users"),
    sessionId: v.optional(v.id("voiceSessions")),
    transcript: v.string(),
    extractedPreferences: v.array(v.object({
      category: v.string(),
      tag: v.string(),
      confidence: v.number(),
    })),
    geminiResponse: v.string(),    // Raw AI response
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"])
    .index("by_timestamp", ["timestamp"]),

  // Preference usage in searches
  preferenceUsage: defineTable({
    userId: v.id("users"),
    preferenceId: v.id("userPreferences"),
    searchId: v.id("productSearches"),
    wasApplied: v.boolean(),       // Whether filter was actually applied
    resultsCount: v.number(),      // Products matching this preference
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_preference", ["preferenceId"])
    .index("by_search", ["searchId"]),
});
```

### 4. Backend Functions

#### Mutations

**Add Preference** (`convex/userPreferences.ts`):
```typescript
export const addPreference = mutation({
  args: {
    userId: v.id("users"),
    category: v.union(
      v.literal("material"),
      v.literal("dimension"),
      v.literal("price"),
      v.literal("feature"),
      v.literal("brand"),
      v.literal("color"),
      v.literal("style"),
      v.literal("other")
    ),
    tag: v.string(),
    normalizedValue: v.optional(v.object({
      type: v.union(v.literal("text"), v.literal("numeric"), v.literal("range")),
      value: v.union(v.string(), v.number()),
      unit: v.optional(v.string()),
      operator: v.optional(v.union(
        v.literal("eq"),
        v.literal("lt"),
        v.literal("lte"),
        v.literal("gt"),
        v.literal("gte")
      )),
    })),
    confidence: v.optional(v.number()),
    source: v.union(v.literal("voice"), v.literal("manual"), v.literal("implicit")),
    sessionId: v.optional(v.id("voiceSessions")),
  },
  handler: async (ctx, args) => {
    // Check for duplicates
    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_active", (q) =>
        q.eq("userId", args.userId).eq("isActive", true)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("category"), args.category),
          q.eq(q.field("tag"), args.tag)
        )
      )
      .first();

    if (existing) {
      // Update usage count and last used
      await ctx.db.patch(existing._id, {
        usageCount: existing.usageCount + 1,
        lastUsed: Date.now(),
      });
      return existing._id;
    }

    // Check preference limit
    const activeCount = await ctx.db
      .query("userPreferences")
      .withIndex("by_active", (q) =>
        q.eq("userId", args.userId).eq("isActive", true)
      )
      .collect();

    if (activeCount.length >= 50) {
      throw new Error("Maximum preference limit reached (50)");
    }

    // Create new preference
    const preferenceId = await ctx.db.insert("userPreferences", {
      userId: args.userId,
      category: args.category,
      tag: args.tag,
      normalizedValue: args.normalizedValue,
      confidence: args.confidence ?? 1.0,
      source: args.source,
      sessionId: args.sessionId,
      createdAt: Date.now(),
      usageCount: 0,
      isActive: true,
    });

    return preferenceId;
  },
});
```
- **Purpose**: Add new preference tag for user
- **Returns**: `Id<"userPreferences">`
- **Notes**: Prevents duplicates, enforces 50 preference limit

**Remove Preference** (`convex/userPreferences.ts`):
```typescript
export const removePreference = mutation({
  args: {
    userId: v.id("users"),
    preferenceId: v.optional(v.id("userPreferences")),
    tag: v.optional(v.string()),  // Alternative: remove by tag text
  },
  handler: async (ctx, args) => {
    let preference;

    if (args.preferenceId) {
      preference = await ctx.db.get(args.preferenceId);
    } else if (args.tag) {
      preference = await ctx.db
        .query("userPreferences")
        .withIndex("by_active", (q) =>
          q.eq("userId", args.userId).eq("isActive", true)
        )
        .filter((q) => q.eq(q.field("tag"), args.tag))
        .first();
    }

    if (!preference) {
      throw new Error("Preference not found");
    }

    if (preference.userId !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Soft delete
    await ctx.db.patch(preference._id, {
      isActive: false,
    });

    return { removed: true };
  },
});
```
- **Purpose**: Remove preference by ID or tag text (voice command)
- **Returns**: `{ removed: boolean }`
- **Notes**: Soft delete preserves analytics history

**Update Preference Usage** (`convex/userPreferences.ts`):
```typescript
export const updatePreferenceUsage = mutation({
  args: {
    preferenceId: v.id("userPreferences"),
  },
  handler: async (ctx, args) => {
    const preference = await ctx.db.get(args.preferenceId);
    if (!preference) {
      throw new Error("Preference not found");
    }

    await ctx.db.patch(args.preferenceId, {
      usageCount: preference.usageCount + 1,
      lastUsed: Date.now(),
    });
  },
});
```
- **Purpose**: Track preference usage in searches
- **Returns**: `void`
- **Notes**: Called when preference applied to search

**Log Preference Extraction** (`convex/preferenceExtractions.ts`):
```typescript
export const logPreferenceExtraction = mutation({
  args: {
    userId: v.id("users"),
    sessionId: v.optional(v.id("voiceSessions")),
    transcript: v.string(),
    extractedPreferences: v.array(v.object({
      category: v.string(),
      tag: v.string(),
      confidence: v.number(),
    })),
    geminiResponse: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("preferenceExtractions", {
      ...args,
      timestamp: Date.now(),
    });
  },
});
```
- **Purpose**: Debug and audit preference extraction
- **Returns**: `Id<"preferenceExtractions">`
- **Notes**: Helps improve extraction accuracy

#### Queries

**Get Active Preferences** (`convex/userPreferences.ts`):
```typescript
export const getActivePreferences = query({
  args: {
    userId: v.id("users"),
    category: v.optional(v.union(
      v.literal("material"),
      v.literal("dimension"),
      v.literal("price"),
      v.literal("feature"),
      v.literal("brand"),
      v.literal("color"),
      v.literal("style"),
      v.literal("other")
    )),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("userPreferences")
      .withIndex("by_active", (q) =>
        q.eq("userId", args.userId).eq("isActive", true)
      );

    const allPreferences = await query.collect();

    // Filter by category if specified
    if (args.category) {
      return allPreferences.filter((p) => p.category === args.category);
    }

    // Sort by usage count (most used first)
    return allPreferences.sort((a, b) => b.usageCount - a.usageCount);
  },
});
```
- **Purpose**: Retrieve user's active preferences for display
- **Returns**: `UserPreference[]`
- **Notes**: Sorted by usage frequency

**Get Preferences for Search** (`convex/userPreferences.ts`):
```typescript
export const getPreferencesForSearch = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_active", (q) =>
        q.eq("userId", args.userId).eq("isActive", true)
      )
      .filter((q) => q.gte(q.field("confidence"), 0.7))
      .collect();

    // Group by category for structured filtering
    const grouped: Record<string, any[]> = {};

    preferences.forEach((pref) => {
      if (!grouped[pref.category]) {
        grouped[pref.category] = [];
      }
      grouped[pref.category].push(pref);
    });

    return grouped;
  },
});
```
- **Purpose**: Get preferences formatted for search filters
- **Returns**: `Record<string, UserPreference[]>`
- **Notes**: Only high-confidence preferences (≥0.7)

**Get Preference Analytics** (`convex/userPreferences.ts`):
```typescript
export const getPreferenceAnalytics = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const totalPreferences = preferences.length;
    const activePreferences = preferences.filter((p) => p.isActive).length;

    // Category breakdown
    const byCategory = preferences.reduce((acc, pref) => {
      acc[pref.category] = (acc[pref.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Source breakdown
    const bySource = preferences.reduce((acc, pref) => {
      acc[pref.source] = (acc[pref.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Most used preferences
    const mostUsed = [...preferences]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    return {
      totalPreferences,
      activePreferences,
      byCategory,
      bySource,
      mostUsed,
    };
  },
});
```
- **Purpose**: Analytics dashboard data
- **Returns**: Aggregated preference statistics
- **Notes**: Used for user insights

#### Actions

**Extract Preferences from Transcript** (`convex/gemini.ts`):
```typescript
export const extractPreferences = action({
  args: {
    userId: v.id("users"),
    transcript: v.string(),
    sessionId: v.optional(v.id("voiceSessions")),
  },
  handler: async (ctx, args) => {
    // Call Gemini API for NLP extraction
    const prompt = `
Extract shopping preferences from this transcript. Return a JSON array of preferences with category, tag, and confidence.

Categories: material, dimension, price, feature, brand, color, style, other

Transcript: "${args.transcript}"

Examples:
- "I want wooden chairs" → [{"category": "material", "tag": "wooden", "confidence": 0.95}]
- "Under $50" → [{"category": "price", "tag": "under $50", "confidence": 0.9, "normalized": {"type": "numeric", "value": 50, "operator": "lt", "unit": "USD"}}]
- "At least 3 feet tall" → [{"category": "dimension", "tag": "at least 3ft", "confidence": 0.85, "normalized": {"type": "numeric", "value": 3, "operator": "gte", "unit": "ft"}}]

Return only valid JSON array.
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    const extractedText = data.candidates[0].content.parts[0].text;

    // Parse JSON response
    let preferences: any[] = [];
    try {
      const jsonMatch = extractedText.match(/\[.*\]/s);
      if (jsonMatch) {
        preferences = JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Failed to parse Gemini response:", error);
    }

    // Log extraction
    await ctx.runMutation(internal.preferenceExtractions.logPreferenceExtraction, {
      userId: args.userId,
      sessionId: args.sessionId,
      transcript: args.transcript,
      extractedPreferences: preferences.map((p) => ({
        category: p.category,
        tag: p.tag,
        confidence: p.confidence,
      })),
      geminiResponse: extractedText,
    });

    // Add high-confidence preferences
    const addedPreferences = [];
    for (const pref of preferences) {
      if (pref.confidence >= 0.7) {
        const preferenceId = await ctx.runMutation(
          internal.userPreferences.addPreference,
          {
            userId: args.userId,
            category: pref.category,
            tag: pref.tag,
            normalizedValue: pref.normalized,
            confidence: pref.confidence,
            source: "voice",
            sessionId: args.sessionId,
          }
        );
        addedPreferences.push(preferenceId);
      }
    }

    return {
      extracted: preferences.length,
      added: addedPreferences.length,
      preferences: addedPreferences,
    };
  },
});
```
- **Purpose**: Use Gemini to extract preferences from voice transcript
- **Returns**: `{ extracted: number, added: number, preferences: Id[] }`
- **Tooling**: Gemini API for NLP
- **Limits**: Only adds preferences with confidence ≥0.7
- **Notes**: Called after each voice interaction

### 5. Frontend

#### Components

**PreferenceTagList.tsx** (`app/components/PreferenceTagList.tsx`):
```typescript
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

export default function PreferenceTagList() {
  const { userId } = useAuth();
  const preferences = useQuery(api.userPreferences.getActivePreferences, {
    userId: userId!,
  });
  const removePreference = useMutation(api.userPreferences.removePreference);

  if (!preferences || preferences.length === 0) {
    return null;
  }

  // Group by category
  const grouped = preferences.reduce((acc, pref) => {
    if (!acc[pref.category]) acc[pref.category] = [];
    acc[pref.category].push(pref);
    return acc;
  }, {} as Record<string, typeof preferences>);

  return (
    <div className="w-full bg-white rounded-lg shadow-sm p-4 border border-gray-200">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Your Preferences
      </h3>

      <div className="space-y-3">
        {Object.entries(grouped).map(([category, prefs]) => (
          <div key={category}>
            <p className="text-xs text-gray-500 uppercase mb-1">
              {category}
            </p>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence mode="popLayout">
                {prefs.map((pref) => (
                  <motion.div
                    key={pref._id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  >
                    <span>{pref.tag}</span>
                    <button
                      onClick={() =>
                        removePreference({
                          userId: userId!,
                          preferenceId: pref._id,
                        })
                      }
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```
- **Purpose**: Display preference tags grouped by category
- **State**: Real-time Convex subscription
- **Animations**: Smooth add/remove transitions
- **Actions**: Remove preference on click

**AddPreferenceButton.tsx** (`app/components/AddPreferenceButton.tsx`):
- Client Component with dropdown menu
- Category selector
- Text input for tag
- Calls `useMutation(api.userPreferences.addPreference)`
- Validation before adding

**PreferenceAnalyticsDashboard.tsx** (`app/components/PreferenceAnalyticsDashboard.tsx`):
- Shows usage statistics
- Charts for category distribution
- Most-used preferences
- Source breakdown (voice vs manual)

#### State Strategy

- **Preference List**: Real-time Convex via `useQuery()`
- **Add/Remove Actions**: `useMutation()` with optimistic updates
- **Extraction Results**: Streamed from voice session
- **Analytics**: Separate query for dashboard

#### File Structure

```
app/
├── components/
│   ├── PreferenceTagList.tsx
│   ├── AddPreferenceButton.tsx
│   ├── PreferenceAnalyticsDashboard.tsx
│   └── PreferenceTag.tsx
├── hooks/
│   ├── usePreferences.ts
│   └── usePreferenceExtraction.ts
└── dashboard/
    └── page.tsx (integrates PreferenceTagList)
```

### 6. Error Prevention

#### API Error Handling
- Gemini extraction failures: Retry once, fallback to manual entry
- Duplicate preferences: Silent merge with existing
- Invalid category: Default to "other"
- Preference limit exceeded: Show warning, suggest removal

#### Schema Validation
```typescript
import { z } from "zod";

const PreferenceSchema = z.object({
  category: z.enum([
    "material",
    "dimension",
    "price",
    "feature",
    "brand",
    "color",
    "style",
    "other",
  ]),
  tag: z.string().min(1).max(50),
  confidence: z.number().min(0).max(1),
});

const NormalizedValueSchema = z.object({
  type: z.enum(["text", "numeric", "range"]),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  operator: z.enum(["eq", "lt", "lte", "gt", "gte"]).optional(),
});
```

#### Rate Limiting
- Preference extraction: Once per voice transcript
- Manual adds: Max 10 per minute
- Preference removal: No limit (user control)

#### Authentication & Authorization
- All preference operations require authenticated user
- Users can only access/modify their own preferences
- Privacy: No cross-user preference sharing

#### Type Safety
- Strict TypeScript for all preference operations
- Convex auto-generated types
- Zod validation for Gemini responses

#### Boundaries & Quotas
- Max 50 active preferences per user
- Preference tags: 1-50 characters
- Extraction: Process max 1000-character transcripts
- Retention: Auto-archive preferences unused for 1 year

### 7. Testing

#### Unit Tests
- `addPreference`: Tests duplicate detection and limit enforcement
- `removePreference`: Validates soft delete behavior
- `extractPreferences`: Mock Gemini API, test parsing
- `getActivePreferences`: Tests sorting and filtering
- `getPreferencesForSearch`: Tests grouping logic

#### Integration Tests
- Full extraction flow: Transcript → Gemini → Add preferences
- Manual add: UI → Mutation → Display update
- Remove: Click X → Mutation → UI update
- Search integration: Preferences applied to filters
- Analytics: Preference usage tracked correctly

#### End-to-End Tests (Playwright)
1. User voice command: "I want wooden chairs under $100"
2. Gemini extracts preferences
3. Tags appear: "wooden", "under $100"
4. User clicks X on "under $100"
5. Tag removed from list
6. User manually adds "modern" via button
7. New tag appears
8. Preferences persist after refresh

#### Performance Tests
- Extraction latency: <2 seconds for typical transcript
- UI rendering: 50 tags in <500ms
- Real-time updates: New preferences appear within 1 second
- Database queries: Preference fetch <100ms

#### AI-Specific Tests
- Extraction accuracy: Test against labeled dataset
- Confidence calibration: High confidence = high accuracy
- Category classification: >90% correct category
- Normalization: Price/dimension values parsed correctly
- Edge cases: Ambiguous phrases, negations, compound preferences

## Documentation Sources

1. Gemini API NLP Guide - https://ai.google.dev/gemini-api/docs
2. Convex Mutations - https://docs.convex.dev/functions/mutation-functions
3. Zod Validation - https://zod.dev
4. Framer Motion - https://www.framer.com/motion/
5. Radix UI Dropdown - https://www.radix-ui.com/primitives/docs/components/dropdown-menu
6. React Hooks Best Practices - https://react.dev/reference/react
7. Next.js App Router - https://nextjs.org/docs/app
8. TypeScript Handbook - https://www.typescriptlang.org/docs/handbook/
9. GDPR Compliance Guide - https://gdpr.eu
10. Convex Real-time Queries - https://docs.convex.dev/database/reading-data
