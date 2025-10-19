# Roadmap: Product Search Integration (Voice-Only MVP)

## Context

**Tech Stack:** Next.js, Convex, Clerk, Gemini API, BrightData MCP

**Feature Description:** Voice-triggered product search using Gemini API connected to BrightData MCP. Users speak their product requirements, and results appear in real-time on the dashboard with numbered cards for voice reference.

**MVP Scope:**
- ✅ Voice-triggered search (NO keyboard/text input)
- ✅ Real-time product results displayed on main dashboard
- ✅ Numbered products (1-20) for voice commands
- ✅ Search result caching for performance
- ❌ No separate search page
- ❌ No manual search forms

**Goals:**
- Extract search parameters from voice transcripts via Gemini API
- Query e-commerce sites via BrightData MCP for real product data
- Display numbered products in real-time on main dashboard
- Cache results to minimize API costs

## Implementation Steps

### 1. Manual Setup (User Required)

- [ ] Gemini API key configured in Convex dashboard
- [ ] BrightData account (optional - uses mock data if missing)
- [ ] BrightData API credentials in Convex dashboard (optional)

### 2. Dependencies

**Already Installed:**
```bash
@google/generative-ai
zod
convex
```

**Environment Variables (Convex Dashboard):**
```bash
GEMINI_API_KEY=your_gemini_api_key
BRIGHTDATA_API_KEY=your_brightdata_key (optional)
```

### 3. Database Schema

```typescript
// convex/schema.ts
productSearches: defineTable({
  userId: v.string(),
  sessionId: v.string(), // Voice session that triggered search
  query: v.string(), // Original voice query
  parameters: v.object({
    category: v.optional(v.string()),
    priceMax: v.optional(v.number()),
    priceMin: v.optional(v.number()),
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

searchProducts: defineTable({
  searchId: v.id("productSearches"),
  userId: v.string(),
  number: v.number(), // 1-20 for voice reference
  title: v.string(),
  price: v.number(),
  currency: v.string(),
  imageUrl: v.optional(v.string()),
  productUrl: v.string(),
  source: v.string(), // "amazon", "ebay", etc.
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

searchCache: defineTable({
  queryHash: v.string(),
  results: v.array(v.any()),
  expiresAt: v.number(),
  hitCount: v.number(),
})
.index("by_hash", ["queryHash"])
.index("by_expiry", ["expiresAt"]),
```

### 4. Backend Functions

**Mutations:**

`convex/productSearch.ts` - **createSearch**
- Triggered by voice transcript analysis
- Creates search record linked to voice session

**Queries:**

`convex/searchProducts.ts` - **getCurrentSearchResults**
- Returns products for active search
- Ordered by number (1-20)
- Used by main dashboard to display products

**Actions:**

`convex/gemini.ts` - **extractSearchParameters**
- Analyzes voice transcript
- Extracts structured search parameters
- Called automatically when voice agent detects search intent

`convex/brightdata.ts` - **searchProducts**
- Queries BrightData MCP with extracted parameters
- Saves products to database in real-time
- Falls back to mock data if BrightData unavailable

### 5. Frontend Integration

**Main Dashboard (`app/page.tsx`):**
- Microphone button triggers voice session
- Products appear in real-time as search completes
- No manual search input - voice only

**Component Integration:**
- `ProductGrid` displays search results
- Real-time updates via Convex `useQuery`
- Products numbered 1-20 for voice commands

**User Flow:**
1. User clicks mic button on dashboard
2. User says: "Find wireless headphones under $100"
3. Voice agent transcribes and detects search intent
4. Gemini extracts parameters
5. BrightData searches for products
6. Products appear on dashboard numbered 1-20
7. User can say "save product 3" to save items

### 6. MVP Scope

**Included:**
- ✅ Voice-triggered search from main dashboard
- ✅ Real-time product display
- ✅ Numbered products for voice reference
- ✅ Search result caching

**Excluded (Not MVP):**
- ❌ Separate /search page (removed)
- ❌ Manual search forms (voice-only)
- ❌ Advanced search filters UI
- ❌ Search history page

### 7. Error Handling

- Gemini API errors → Use basic keyword extraction
- BrightData errors → Fall back to mock data
- No results → Voice feedback "No products found"
- Rate limits → Queue searches, notify user via voice

### 8. Success Criteria

- [ ] Voice query triggers product search
- [ ] Products appear on main dashboard
- [ ] Products numbered 1-20
- [ ] Cache improves repeat search speed
- [ ] Graceful fallback to mock data

## Documentation Sources

1. Gemini API - https://ai.google.dev/gemini-api/docs/function-calling
2. Convex Actions - https://docs.convex.dev/functions/actions
3. BrightData API - https://docs.brightdata.com/scraping-automation/web-scraper-api/overview
