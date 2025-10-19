# Roadmap: User Preference Management and Product Refinement

## Context

**Tech Stack:** Next.js, Convex, Clerk, Gemini API, BrightData MCP

**Feature Description:** System to save and display user preferences as tags (e.g., "wooden", "at least 3ft", "under $20") based on voice interactions, stored in Convex database. Includes functionality to request cheaper alternatives or products with specific features through voice commands, triggering new refined searches.

**Goals:**
- Extract preferences from natural language voice commands
- Display preferences as visual tags in UI
- Detect refinement requests ("find cheaper options", "show me wooden ones")
- Trigger new searches with updated parameters
- Track preference history for future personalization

## Implementation Steps

Each step is mandatory for shipping User Preference Management and Product Refinement.

### 1. Manual Setup (User Required)

- [ ] Ensure Gemini API is configured with structured output support
- [ ] Enable function calling in Gemini API project
- [ ] Verify BrightData MCP server is running (from product search setup)
- [ ] No additional accounts required

### 2. Dependencies & Environment

**NPM Packages:**
```bash
npm install zod # for preference schema validation
npm install date-fns # for preference expiration logic
```

**Environment Variables:**

Frontend (.env.local):
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

Backend (Convex):
```bash
GEMINI_API_KEY=your_gemini_api_key
BRIGHTDATA_API_KEY=your_brightdata_key
```

### 3. Database Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userPreferences: defineTable({
    userId: v.id("users"),
    tag: v.string(), // "wooden", "under $20", "at least 3ft"
    category: v.union(
      v.literal("material"),
      v.literal("price"),
      v.literal("size"),
      v.literal("feature"),
      v.literal("other")
    ),
    value: v.optional(v.union(v.string(), v.number())), // Structured value if applicable
    extractedFrom: v.string(), // Original voice command
    createdAt: v.number(),
    expiresAt: v.optional(v.number()), // Auto-expire old preferences
    useCount: v.number(), // Times used in searches
  })
    .index("by_user", ["userId"])
    .index("by_user_category", ["userId", "category"])
    .index("by_expiry", ["expiresAt"]),

  searchRefinements: defineTable({
    userId: v.id("users"),
    originalSearchId: v.id("productSearches"),
    refinementType: v.union(
      v.literal("cheaper"),
      v.literal("feature"),
      v.literal("price_range"),
      v.literal("custom")
    ),
    voiceCommand: v.string(),
    extractedPreferences: v.array(v.string()), // Tags extracted from command
    newSearchId: v.id("productSearches"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_original_search", ["originalSearchId"]),

  preferenceHistory: defineTable({
    userId: v.id("users"),
    preferenceId: v.id("userPreferences"),
    usedInSearchId: v.id("productSearches"),
    usedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_preference", ["preferenceId"]),
});
```

### 4. Backend Functions

**Mutations:**

`convex/userPreferences.ts` - **addPreference**
- **Purpose:** Add new preference tag from voice command
- **Args:** `{ userId: Id<"users">, tag: string, category: string, value?: string | number, extractedFrom: string }`
- **Returns:** `Id<"userPreferences">`
- **Notes:** Deduplicates similar tags (e.g., "wooden" and "wood"), sets expiry to 30 days

`convex/userPreferences.ts` - **removePreference**
- **Purpose:** Remove preference tag (via voice or UI click)
- **Args:** `{ userId: Id<"users">, preferenceId: Id<"userPreferences"> }`
- **Returns:** `{ success: boolean }`
- **Notes:** Soft delete or hard delete based on useCount

`convex/userPreferences.ts` - **incrementUseCount**
- **Purpose:** Track when preference is used in a search
- **Args:** `{ preferenceId: Id<"userPreferences">, searchId: Id<"productSearches"> }`
- **Returns:** `void`
- **Notes:** Increments useCount, creates preferenceHistory entry

`convex/searchRefinements.ts` - **recordRefinement**
- **Purpose:** Log search refinement request
- **Args:** `{ userId: Id<"users">, originalSearchId: Id<"productSearches">, refinementType: string, voiceCommand: string, extractedPreferences: string[], newSearchId: Id<"productSearches"> }`
- **Returns:** `Id<"searchRefinements">`
- **Notes:** Links original and refined searches for analytics

**Queries:**

`convex/userPreferences.ts` - **getUserPreferences**
- **Purpose:** Get all active preferences for user
- **Args:** `{ userId: Id<"users"> }`
- **Returns:** `Array<UserPreference>`
- **Notes:** Filters out expired preferences, orders by useCount DESC

`convex/userPreferences.ts` - **getPreferencesByCategory**
- **Purpose:** Get preferences grouped by category
- **Args:** `{ userId: Id<"users"> }`
- **Returns:** `Record<Category, Array<UserPreference>>`
- **Notes:** Useful for organized UI display

`convex/searchRefinements.ts` - **getRefinementHistory**
- **Purpose:** Get refinement history for a search
- **Args:** `{ searchId: Id<"productSearches"> }`
- **Returns:** `Array<SearchRefinement>`
- **Notes:** Shows how user refined their search

**Actions:**

`convex/gemini.ts` - **extractPreferences**
- **Purpose:** Use Gemini structured output to extract preferences from voice command
- **Args:** `{ command: string }`
- **Returns:** `{ preferences: Array<{ tag: string, category: string, value?: any }> }`
- **Notes:** Uses Gemini 1.5 Flash with JSON schema for consistent extraction

`convex/gemini.ts` - **detectRefinementIntent**
- **Purpose:** Determine if voice command is a refinement request
- **Args:** `{ command: string, currentSearchId: Id<"productSearches"> }`
- **Returns:** `{ isRefinement: boolean, refinementType: string, newParameters: SearchParameters }`
- **Notes:** Detects phrases like "cheaper", "find wooden ones", "under $50"

`convex/productSearch.ts` - **refineSearch**
- **Purpose:** Execute new search with refined parameters
- **Args:** `{ userId: Id<"users">, originalSearchId: Id<"productSearches">, newParameters: SearchParameters, voiceCommand: string }`
- **Returns:** `{ newSearchId: Id<"productSearches">, refinementId: Id<"searchRefinements"> }`
- **Notes:** Calls BrightData MCP with updated parameters, creates new search entry

### 5. Frontend

**Components:**

`components/PreferenceList.tsx` - Sidebar preference tag list
- Uses `useQuery(api.userPreferences.getUserPreferences)`
- Displays tags with remove button (X icon)
- Groups by category (Material, Price, Size, etc.)
- Shows count badge ("5 preferences")
- Props: `{ userId: Id<"users"> }`

`components/PreferenceTag.tsx` - Individual preference tag
- Pill-shaped badge with tag text
- Click X to remove
- Color-coded by category (blue for price, green for material, etc.)
- Props: `{ preference: UserPreference, onRemove: () => void }`

`components/RefinementSuggestions.tsx` - AI-suggested refinements
- Displays after initial search completes
- Shows buttons like "Show cheaper options", "Filter by material"
- Click triggers voice-like refinement without speaking
- Props: `{ searchId: Id<"productSearches"> }`

**Hooks:**

`hooks/usePreferences.ts` - Preference management
- Wraps `useQuery(api.userPreferences.getUserPreferences)`
- Wraps `useMutation(api.userPreferences.addPreference)` and `removePreference`
- Wraps `useAction(api.gemini.extractPreferences)`
- Returns `{ preferences, addPreference, removePreference, extractFromVoice }`

`hooks/useSearchRefinement.ts` - Search refinement logic
- Wraps `useAction(api.gemini.detectRefinementIntent)`
- Wraps `useAction(api.productSearch.refineSearch)`
- Manages refinement flow: detect → confirm → execute
- Returns `{ refineSearch, isRefining, pendingRefinement }`

### 6. Error Prevention

**API Error Handling:**
- Catch Gemini API errors in preference extraction and use fallback keyword matching
- Handle BrightData API errors during refined searches gracefully
- Return partial results if some preferences can't be applied
- Show user-friendly error messages ("Couldn't apply price filter")

**Schema Validation:**
- Use Zod to validate extracted preference structure
- Ensure category is valid enum value
- Validate price values are positive numbers
- Check tag length is reasonable (<50 characters)

**Authentication/Authorization:**
- Verify userId matches authenticated user in all preference mutations
- Validate user owns the search being refined
- Check user has access to preference history

**Type Safety:**
- Define strict TypeScript interfaces for preferences and refinements
- Type Gemini structured output schema
- Use Convex-generated types for all database operations

**Rate Limiting:**
- Limit preference extraction to 10 per minute per user
- Throttle search refinements to 3 per minute
- Prevent duplicate preference creation within 10 seconds

**Deduplication:**
- Normalize tags before saving (lowercase, trim whitespace)
- Detect semantic duplicates ("wooden" vs "wood") using Gemini
- Merge similar preferences instead of creating duplicates

**Boundaries/Quotas:**
- Max 50 active preferences per user
- Auto-expire preferences after 30 days of no use
- Max 5 refinements per original search
- Gemini API: 60 requests/min for extraction

### 7. Testing

**Unit Tests:**
- [ ] Test `addPreference` deduplicates similar tags
- [ ] Test `extractPreferences` with various voice commands
- [ ] Test `detectRefinementIntent` identifies "cheaper" requests
- [ ] Test preference expiration logic
- [ ] Test category classification accuracy

**Integration Tests:**
- [ ] End-to-end: voice command → preference extraction → tag appears in UI
- [ ] Test refinement flow: "find cheaper" → new search with updated price filter
- [ ] Verify preferences are applied to new searches automatically
- [ ] Test preference persistence across sessions

**E2E Tests (Playwright):**
- [ ] User says "wooden desk under $200" → two tags appear (material, price)
- [ ] User clicks X on tag → tag removed
- [ ] User says "find cheaper options" → new search with lower price limit
- [ ] Preferences survive page refresh

**Performance Tests:**
- [ ] Measure preference extraction latency (target: <2s)
- [ ] Test refinement search speed (target: <5s)
- [ ] Monitor Gemini API response time (target: <1s)

**Accuracy Tests:**
- [ ] Test preference extraction accuracy (target: >90%)
- [ ] Measure category classification accuracy (target: >85%)
- [ ] Test deduplication accuracy (target: >95%)
- [ ] Verify refinement intent detection accuracy (target: >90%)

## Documentation Sources

1. Gemini Structured Output - https://ai.google.dev/gemini-api/docs/structured-output
2. Gemini Function Calling - https://ai.google.dev/gemini-api/docs/function-calling
3. Convex Indexes for Performance - https://docs.convex.dev/database/indexes
4. BrightData Product Search Filters - https://docs.brightdata.com/scraping-automation/web-scraper-api/product-search
5. Natural Language Processing for E-commerce - https://arxiv.org/abs/2109.05903
6. Zod Schema Validation - https://zod.dev/
