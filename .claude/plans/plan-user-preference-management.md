# Roadmap: User Preference Management (Voice-Only MVP)

## Context

**Tech Stack:** Next.js, Convex, Clerk, Gemini API

**Feature Description:** Automatically extract user preferences from voice conversations and display them as visual tags on the main dashboard. Enable voice-based search refinement like "find cheaper options" or "show me wooden ones."

**MVP Scope:**
- ✅ Auto-extract preferences from voice ("wooden desk under $200" → 2 tags)
- ✅ Display tags on main dashboard
- ✅ Voice-based search refinement
- ✅ Click tag to remove
- ❌ No manual tag creation UI (voice-only)
- ❌ No advanced preference settings

**Goals:**
- Extract preferences from natural language voice
- Display preferences as visual tags
- Detect refinement requests via voice
- Trigger refined searches automatically

## Implementation Steps

### 1. Manual Setup

Requires Gemini API key in Convex dashboard (already configured).

### 2. Dependencies

**Already Installed:**
```bash
@google/generative-ai
zod
date-fns
```

### 3. Database Schema

```typescript
// convex/schema.ts
userPreferences: defineTable({
  userId: v.string(),
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
  value: v.optional(v.union(v.string(), v.number())),
  extractedFrom: v.string(), // Original voice command
  priority: v.number(), // 1-10 based on user emphasis
  source: v.union(v.literal("voice"), v.literal("manual")),
  productContext: v.optional(v.string()),
  createdAt: v.number(),
  expiresAt: v.optional(v.number()), // 30 days
  useCount: v.number(),
  lastUsedAt: v.number(),
})
.index("by_user", ["userId"])
.index("by_user_and_category", ["userId", "category"]),

searchRefinements: defineTable({
  userId: v.string(),
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
  createdAt: v.number(),
})
.index("by_user", ["userId"])
.index("by_original_search", ["originalSearchId"]),
```

### 4. Backend Functions

**Mutations:**

`convex/userPreferences.ts` - **addPreference**
- Adds preference tag from voice
- Deduplicates similar tags
- Sets 30-day expiry

`convex/userPreferences.ts` - **removePreference**
- Removes preference by ID
- Can be triggered by voice or tag click

**Queries:**

`convex/userPreferences.ts` - **getUserPreferences**
- Returns active preferences
- Grouped by category
- Ordered by priority/useCount

**Actions:**

`convex/gemini.ts` - **extractPreferences**
- Analyzes voice transcript
- Extracts structured preferences
- Categorizes automatically

`convex/gemini.ts` - **detectRefinementIntent**
- Detects if user wants to refine search
- Extracts refinement parameters
- Triggers new search

`convex/productSearch.ts` - **refineSearch**
- Executes refined search
- Applies new parameters
- Updates product results

### 5. Frontend Integration

**Main Dashboard Layout:**
```
┌─────────────────────────────────────────┐
│  ┌─────────────────────────────────┐    │
│  │ Preferences:                    │    │
│  │ [wooden] [under $200] [3ft+]    │    │
│  │     (click X to remove)         │    │
│  └─────────────────────────────────┘    │
│                                         │
│         [Mic Button]                    │
│                                         │
│  [Product Grid 1-20]                    │
└─────────────────────────────────────────┘
```

**Components:**

`components/PreferenceList.tsx`
- Displays tags horizontally
- Color-coded by category
- Click X to remove
- Auto-updates in real-time

`components/PreferenceTag.tsx`
- Pill-shaped badge
- Shows tag text
- Remove button (X)

### 6. User Flow

**Initial Search:**
1. User says: "Find wooden desk under $200"
2. Products appear
3. Tags auto-created: [wooden] [under $200]
4. Tags displayed on dashboard

**Refinement:**
1. User says: "Find cheaper options"
2. Voice agent detects refinement intent
3. New search with lower price range
4. Tag updates: [under $150]
5. Products refresh

**Manual Removal:**
1. User clicks X on [wooden] tag
2. Tag removed
3. Preference no longer applied to future searches

### 7. MVP Scope

**Included:**
- ✅ Auto-extract from voice
- ✅ Display tags on dashboard
- ✅ Voice-based refinement
- ✅ Click to remove tags
- ✅ 30-day auto-expiry

**Excluded (Not MVP):**
- ❌ Manual tag creation UI
- ❌ Tag editing/renaming
- ❌ Preference priority settings
- ❌ Import/export preferences
- ❌ Preference sharing

### 8. Voice Command Examples

**Preference Extraction:**
```
"wooden desk under $200" → [wooden] [under $200]
"red shoes size 10" → [red] [size 10]
"laptop with SSD at least 16GB RAM" → [SSD] [16GB+ RAM]
```

**Refinement:**
```
"find cheaper options" → Lower price range
"show me wooden ones" → Add material filter
"under $50" → Update price limit
"larger size" → Increase size constraint
```

### 9. Success Criteria

- [ ] Preferences auto-extract from voice
- [ ] Tags display on dashboard
- [ ] Refinement commands work
- [ ] Tags clickable to remove
- [ ] Real-time updates

## Documentation Sources

1. Gemini Structured Output - https://ai.google.dev/gemini-api/docs/structured-output
2. Convex Indexes - https://docs.convex.dev/database/indexes
