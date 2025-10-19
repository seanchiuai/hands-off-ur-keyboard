# Roadmap: Product Search Integration

## Context

**Tech Stack:** Next.js, Convex, Clerk, Gemini API, BrightData MCP

**Feature Description:** Automated product search functionality using Gemini API connected to BrightData MCP that retrieves product options based on voice commands and displays them in numbered format.

**Goals:**
- Extract search parameters from natural language voice commands
- Query e-commerce sites via BrightData MCP for real product data
- Return numbered, structured product results for voice reference
- Cache results to minimize API costs and improve response time

## Implementation Steps

Each step is mandatory for shipping Product Search Integration.

### 1. Manual Setup (User Required)

- [ ] Create BrightData account at https://brightdata.com
- [ ] Subscribe to Web Scraper API (e-commerce plan)
- [ ] Generate BrightData API credentials (Account → API Access)
- [ ] Configure allowed domains for scraping (Amazon, eBay, etc.)
- [ ] Set up Gemini API access (if not already done for voice agent)
- [ ] Enable function calling in Gemini API settings
- [ ] Configure rate limits and quotas in BrightData dashboard
- [ ] Set up MCP server for BrightData integration (requires separate Node.js process)

### 2. Dependencies & Environment

**NPM Packages:**
```bash
npm install @modelcontextprotocol/sdk @google/generative-ai zod
npm install axios cheerio # for BrightData API client
npm install -D @types/cheerio
```

**Environment Variables:**

Frontend (.env.local):
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

Backend (Convex):
```bash
GEMINI_API_KEY=your_gemini_api_key
BRIGHTDATA_API_KEY=your_brightdata_key
BRIGHTDATA_CUSTOMER_ID=your_customer_id
```

MCP Server (.env):
```bash
BRIGHTDATA_API_KEY=your_brightdata_key
BRIGHTDATA_CUSTOMER_ID=your_customer_id
MCP_SERVER_PORT=3001
```

### 3. Database Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  productSearches: defineTable({
    userId: v.id("users"),
    sessionId: v.id("voiceSessions"),
    query: v.string(),
    parameters: v.object({
      category: v.optional(v.string()),
      maxPrice: v.optional(v.number()),
      minPrice: v.optional(v.number()),
      features: v.optional(v.array(v.string())),
      keywords: v.array(v.string()),
    }),
    status: v.union(
      v.literal("pending"),
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

  products: defineTable({
    searchId: v.id("productSearches"),
    userId: v.id("users"),
    number: v.number(), // Sequential number for voice reference
    title: v.string(),
    price: v.number(),
    currency: v.string(),
    imageUrl: v.optional(v.string()),
    productUrl: v.string(),
    source: v.string(), // "amazon", "ebay", etc.
    details: v.object({
      rating: v.optional(v.number()),
      reviewCount: v.optional(v.number()),
      availability: v.optional(v.string()),
      features: v.optional(v.array(v.string())),
    }),
    addedAt: v.number(),
  })
    .index("by_search", ["searchId"])
    .index("by_user", ["userId"])
    .index("by_search_number", ["searchId", "number"]),

  searchCache: defineTable({
    queryHash: v.string(), // Hash of search parameters
    results: v.array(v.any()), // Cached product data
    expiresAt: v.number(),
    hitCount: v.number(),
  })
    .index("by_hash", ["queryHash"])
    .index("by_expiry", ["expiresAt"]),
});
```

### 4. Backend Functions

**Mutations:**

`convex/productSearches.ts` - **createSearch**
- **Purpose:** Create new product search from voice command
- **Args:** `{ userId: Id<"users">, sessionId: Id<"voiceSessions">, query: string }`
- **Returns:** `Id<"productSearches">`
- **Notes:** Triggers Gemini API action to extract parameters

`convex/products.ts` - **saveProduct**
- **Purpose:** Save individual product from BrightData results
- **Args:** `{ searchId: Id<"productSearches">, number: number, title: string, price: number, ... }`
- **Returns:** `Id<"products">`
- **Notes:** Assigns sequential numbers (1, 2, 3...) for voice reference

`convex/productSearches.ts` - **updateSearchStatus**
- **Purpose:** Update search status during BrightData API call
- **Args:** `{ searchId: Id<"productSearches">, status: "searching" | "completed" | "failed", errorMessage?: string }`
- **Returns:** `void`
- **Notes:** Internal mutation called from actions

**Queries:**

`convex/products.ts` - **getSearchResults**
- **Purpose:** Retrieve all products for a search, ordered by number
- **Args:** `{ searchId: Id<"productSearches"> }`
- **Returns:** `Array<Product>`
- **Notes:** Includes product details and sorted by number ascending

`convex/products.ts` - **getProductByNumber**
- **Purpose:** Get specific product by its assigned number
- **Args:** `{ searchId: Id<"productSearches">, number: number }`
- **Returns:** `Product | null`
- **Notes:** Used when user says "save product 3"

`convex/searchCache.ts` - **getCachedSearch**
- **Purpose:** Check if search results are cached
- **Args:** `{ queryHash: string }`
- **Returns:** `Array<Product> | null`
- **Notes:** Returns null if expired or not found

**Actions:**

`convex/gemini.ts` - **extractSearchParameters**
- **Purpose:** Use Gemini function calling to extract structured search params from voice query
- **Args:** `{ query: string }`
- **Returns:** `{ category?: string, maxPrice?: number, minPrice?: number, features?: string[], keywords: string[] }`
- **Notes:** Uses Gemini 1.5 Flash with function declaration for parameter extraction

`convex/brightdata.ts` - **searchProducts**
- **Purpose:** Query BrightData MCP for product data
- **Args:** `{ searchId: Id<"productSearches">, parameters: SearchParameters }`
- **Returns:** `{ success: boolean, productCount: number }`
- **Notes:** Makes HTTP request to MCP server, saves results to Convex, updates search status

`convex/mcp.ts` - **callBrightDataMCP**
- **Purpose:** Low-level MCP protocol communication with BrightData server
- **Args:** `{ tool: string, arguments: Record<string, any> }`
- **Returns:** `{ result: any }`
- **Notes:** Handles MCP request/response format, timeout of 30s

### 5. Frontend

**Components:**

`app/search/page.tsx` - Product search results page
- Uses `useQuery(api.products.getSearchResults)` to load products
- Displays numbered product grid (1, 2, 3...)
- Shows loading skeleton during search
- Handles empty states and errors

`components/ProductGrid.tsx` - Numbered product display
- Renders products in grid layout with prominent numbers
- Uses `useQuery` subscription for real-time updates as products arrive
- Animates new products appearing

`components/ProductCard.tsx` - Individual product card
- Shows product number (large, top-left)
- Displays image, title, price, rating
- Click expands details (features, availability)

`components/SearchStatusIndicator.tsx` - Live search status
- Subscribes to `useQuery(api.productSearches.getSearch)`
- Shows "Searching...", "Found X products", or error messages
- Displays progress for multi-source searches

**Hooks:**

`hooks/useProductSearch.ts` - Product search management
- Wraps `useMutation(api.productSearches.createSearch)`
- Wraps `useAction(api.gemini.extractSearchParameters)` and `api.brightdata.searchProducts`
- Returns `{ searchProducts, isSearching, currentSearch, results }`

`hooks/useProductByNumber.ts` - Get product by number
- Wraps `useQuery(api.products.getProductByNumber)`
- Used by voice commands ("save product 3")
- Returns `{ product, isLoading }`

### 6. Error Prevention

**API Error Handling:**
- Wrap BrightData API calls in try-catch with retry logic (3 attempts)
- Handle rate limits (503 Service Unavailable) with exponential backoff
- Catch Gemini API errors and fallback to basic keyword extraction
- Return partial results if some sources fail (e.g., Amazon works but eBay fails)

**Schema Validation:**
- Use Zod schemas to validate BrightData API responses
- Validate price is positive number and currency is valid ISO code
- Ensure product URLs are valid HTTPS URLs
- Validate image URLs before saving

**Authentication/Authorization:**
- Require Clerk authentication for all search endpoints
- Validate userId matches authenticated user
- Prevent users from accessing other users' search results

**Type Safety:**
- Define TypeScript interfaces for BrightData API responses
- Type Gemini function calling schemas
- Use Convex-generated types for all database operations

**Rate Limiting:**
- Limit searches to 5 per minute per user
- Cache identical searches for 1 hour
- Implement circuit breaker for BrightData API (open after 5 consecutive failures)

**Boundaries/Quotas:**
- BrightData: Monitor monthly scraping credits, warn at 80% usage
- Gemini API: 60 requests/min for parameter extraction
- Product limit: Return max 20 products per search to avoid UI clutter
- Search cache: Expire after 1 hour, max 1000 entries

### 7. Testing

**Unit Tests:**
- [ ] Test `extractSearchParameters` with various voice queries
- [ ] Test `createSearch` mutation creates proper database entry
- [ ] Test `saveProduct` assigns sequential numbers correctly
- [ ] Test cache hit/miss logic in `getCachedSearch`
- [ ] Test BrightData response parsing with mock data

**Integration Tests:**
- [ ] End-to-end: voice query → Gemini extraction → BrightData search → products saved
- [ ] Test cache behavior: same query twice should hit cache
- [ ] Verify products appear in real-time as BrightData returns them
- [ ] Test error handling when BrightData API is down

**E2E Tests (Playwright):**
- [ ] User says "find wooden desk under $200" → products appear numbered
- [ ] Products update in real-time during search
- [ ] Click product card → details expand
- [ ] Search fails gracefully with error message

**Performance Tests:**
- [ ] Measure search latency (target: <5s for 20 products)
- [ ] Test concurrent searches from multiple users
- [ ] Monitor cache hit rate (target: >30%)
- [ ] Verify database indexes improve query performance

## Documentation Sources

1. BrightData Web Scraper API - https://docs.brightdata.com/scraping-automation/web-scraper-api/overview
2. Model Context Protocol (MCP) Specification - https://spec.modelcontextprotocol.io/
3. Gemini Function Calling - https://ai.google.dev/gemini-api/docs/function-calling
4. Convex Actions for External APIs - https://docs.convex.dev/functions/actions
5. Zod Schema Validation - https://zod.dev/
6. E-commerce Product Schema Standards - https://schema.org/Product
