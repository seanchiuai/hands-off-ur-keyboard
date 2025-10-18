# Roadmap: Product Search Integration with BrightData MCP

## Context

**Tech Stack**: Next.js (App Router), BrightData MCP, Gemini Live API, Convex (Backend), Zod (Validation)

**Feature Description**: Enable the voice agent to search for products across the web using natural language, with BrightData MCP providing web scraping and data aggregation while bypassing anti-bot protections.

**Goals**:
- Real-time product search via voice commands
- Integration with Gemini Live API function calling
- Structured product data extraction (image, price, details)
- Deduplication and ranking of search results
- Support for filtering by price, features, and user preferences

## Implementation Steps

Each step is mandatory for shipping the Product Search Integration feature.

### 1. Manual Setup (User Required)

- [ ] Create BrightData account at https://brightdata.com
- [ ] Subscribe to BrightData MCP (start with free tier: 5,000 requests/month)
- [ ] Generate BrightData API credentials from dashboard
- [ ] Configure BrightData zones (residential proxies for e-commerce sites)
- [ ] Set up Google Cloud project for Gemini API (if not already done)
- [ ] Enable billing for BrightData account (required after 3-month trial)
- [ ] Test BrightData MCP server connectivity

### 2. Dependencies & Environment

**NPM Packages**:
```bash
npm install @modelcontextprotocol/sdk
npm install @google/genai
npm install zod
npm install cheerio  # For HTML parsing fallback
npm install axios
```

**Python Dependencies** (if using BrightData Python SDK):
```bash
pip install brightdata-sdk
pip install requests
```

**Environment Variables** (`.env.local`):
```bash
# BrightData
BRIGHTDATA_API_KEY=your_brightdata_api_key
BRIGHTDATA_ZONE=your_zone_name
BRIGHTDATA_MCP_MODE=pro  # or 'default' for basic features

# Gemini API
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-exp

# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_url
CONVEX_DEPLOYMENT=your_deployment_name

# Rate Limiting
PRODUCT_SEARCH_RATE_LIMIT=10  # searches per minute
BRIGHTDATA_REQUEST_TIMEOUT=30000  # 30 seconds
```

### 3. Database Schema

**Convex Schema** (`convex/schema.ts`):

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Product search results cache
  productSearches: defineTable({
    userId: v.id("users"),
    sessionId: v.optional(v.id("voiceSessions")),
    query: v.string(),
    // Search filters
    filters: v.object({
      maxPrice: v.optional(v.number()),
      minPrice: v.optional(v.number()),
      features: v.optional(v.array(v.string())),
      category: v.optional(v.string()),
    }),
    // Results metadata
    totalResults: v.number(),
    searchedAt: v.number(),
    // Cache TTL (time to live)
    expiresAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_query", ["query"])
    .index("by_expires", ["expiresAt"]),

  // Individual product results
  products: defineTable({
    searchId: v.id("productSearches"),
    userId: v.id("users"),
    // Product data
    title: v.string(),
    price: v.number(),
    currency: v.string(),
    imageUrl: v.optional(v.string()),
    productUrl: v.string(),
    description: v.optional(v.string()),
    // Merchant info
    merchant: v.string(),
    merchantUrl: v.optional(v.string()),
    // Product attributes
    features: v.optional(v.array(v.string())),
    rating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    availability: v.union(
      v.literal("in_stock"),
      v.literal("out_of_stock"),
      v.literal("preorder"),
      v.literal("unknown")
    ),
    // Metadata
    scrapedAt: v.number(),
    position: v.number(),  // Ranking in search results
    relevanceScore: v.optional(v.number()),
  })
    .index("by_search", ["searchId"])
    .index("by_user", ["userId"])
    .index("by_price", ["price"])
    .index("by_position", ["position"]),

  // User-saved products
  savedProducts: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
    savedAt: v.number(),
    notes: v.optional(v.string()),
    // Reference number for voice commands ("product number 3")
    displayNumber: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_product", ["productId"])
    .index("by_display_number", ["userId", "displayNumber"]),

  // Search analytics
  searchAnalytics: defineTable({
    userId: v.id("users"),
    searchId: v.id("productSearches"),
    // Performance metrics
    responseTime: v.number(),  // milliseconds
    resultCount: v.number(),
    brightdataRequestCount: v.number(),
    cacheHit: v.boolean(),
    // Error tracking
    errors: v.optional(v.array(v.string())),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"]),
});
```

### 4. Backend Functions

#### Mutations

**Create Product Search** (`convex/productSearches.ts`):
```typescript
export const createProductSearch = mutation({
  args: {
    userId: v.id("users"),
    sessionId: v.optional(v.id("voiceSessions")),
    query: v.string(),
    filters: v.optional(v.object({
      maxPrice: v.optional(v.number()),
      minPrice: v.optional(v.number()),
      features: v.optional(v.array(v.string())),
      category: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const searchId = await ctx.db.insert("productSearches", {
      userId: args.userId,
      sessionId: args.sessionId,
      query: args.query,
      filters: args.filters ?? { features: [] },
      totalResults: 0,  // Updated after search completes
      searchedAt: Date.now(),
      expiresAt: Date.now() + 3600000,  // 1 hour cache
    });

    return searchId;
  },
});
```
- **Purpose**: Initialize product search record before calling BrightData
- **Returns**: `Id<"productSearches">`
- **Notes**: Creates cache entry with 1-hour TTL

**Save Product** (`convex/products.ts`):
```typescript
export const saveProduct = mutation({
  args: {
    searchId: v.id("productSearches"),
    userId: v.id("users"),
    title: v.string(),
    price: v.number(),
    currency: v.string(),
    imageUrl: v.optional(v.string()),
    productUrl: v.string(),
    description: v.optional(v.string()),
    merchant: v.string(),
    features: v.optional(v.array(v.string())),
    position: v.number(),
  },
  handler: async (ctx, args) => {
    const productId = await ctx.db.insert("products", {
      ...args,
      availability: "unknown",
      scrapedAt: Date.now(),
    });

    return productId;
  },
});
```
- **Purpose**: Store individual product from search results
- **Returns**: `Id<"products">`
- **Notes**: Batched saves for multiple products

**Add to Saved Products** (`convex/savedProducts.ts`):
```typescript
export const addToSavedProducts = mutation({
  args: {
    userId: v.id("users"),
    productId: v.id("products"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get next display number for this user
    const existingSaved = await ctx.db
      .query("savedProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();

    const nextDisplayNumber = (existingSaved?.displayNumber ?? 0) + 1;

    const savedId = await ctx.db.insert("savedProducts", {
      userId: args.userId,
      productId: args.productId,
      savedAt: Date.now(),
      notes: args.notes,
      displayNumber: nextDisplayNumber,
    });

    return { savedId, displayNumber: nextDisplayNumber };
  },
});
```
- **Purpose**: Save product when user says "save product number 3"
- **Returns**: `{ savedId: Id<"savedProducts">, displayNumber: number }`
- **Notes**: Auto-increments display number for voice reference

**Remove from Saved Products** (`convex/savedProducts.ts`):
```typescript
export const removeFromSavedProducts = mutation({
  args: {
    userId: v.id("users"),
    displayNumber: v.number(),
  },
  handler: async (ctx, args) => {
    const saved = await ctx.db
      .query("savedProducts")
      .withIndex("by_display_number", (q) =>
        q.eq("userId", args.userId).eq("displayNumber", args.displayNumber)
      )
      .first();

    if (!saved) {
      throw new Error(`Product number ${args.displayNumber} not found`);
    }

    await ctx.db.delete(saved._id);
    return { removed: true };
  },
});
```
- **Purpose**: Remove product when user says "remove product number 3"
- **Returns**: `{ removed: boolean }`
- **Notes**: Uses display number for voice interaction

#### Queries

**Get Cached Search** (`convex/productSearches.ts`):
```typescript
export const getCachedSearch = query({
  args: {
    userId: v.id("users"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db
      .query("productSearches")
      .withIndex("by_query", (q) => q.eq("query", args.query))
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.gt(q.field("expiresAt"), now)
        )
      )
      .first();
  },
});
```
- **Purpose**: Check for cached search results before calling BrightData
- **Returns**: `ProductSearch | null`
- **Notes**: Reduces API calls and costs

**Get Search Results** (`convex/products.ts`):
```typescript
export const getSearchResults = query({
  args: {
    searchId: v.id("productSearches"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;

    return await ctx.db
      .query("products")
      .withIndex("by_search", (q) => q.eq("searchId", args.searchId))
      .order("asc")  // Order by position
      .take(limit);
  },
});
```
- **Purpose**: Retrieve products for display in dynamic interface
- **Returns**: `Product[]`
- **Notes**: Paginated results for performance

**Get Saved Products** (`convex/savedProducts.ts`):
```typescript
export const getSavedProducts = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const savedItems = await ctx.db
      .query("savedProducts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    // Join with product data
    const productsWithNumbers = await Promise.all(
      savedItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return {
          ...product,
          displayNumber: item.displayNumber,
          savedAt: item.savedAt,
          notes: item.notes,
        };
      })
    );

    return productsWithNumbers;
  },
});
```
- **Purpose**: Display user's saved products in UI
- **Returns**: `(Product & { displayNumber: number })[]`
- **Notes**: Includes display numbers for reference

#### Actions

**Search Products with BrightData** (`convex/brightdata.ts`):
```typescript
export const searchProducts = action({
  args: {
    userId: v.id("users"),
    query: v.string(),
    sessionId: v.optional(v.id("voiceSessions")),
    filters: v.optional(v.object({
      maxPrice: v.optional(v.number()),
      minPrice: v.optional(v.number()),
      features: v.optional(v.array(v.string())),
      category: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // Check cache first
    const cached = await ctx.runQuery(
      internal.productSearches.getCachedSearch,
      { userId: args.userId, query: args.query }
    );

    if (cached) {
      const products = await ctx.runQuery(
        internal.products.getSearchResults,
        { searchId: cached._id }
      );
      return { searchId: cached._id, products, cached: true };
    }

    // Create new search record
    const searchId = await ctx.runMutation(
      internal.productSearches.createProductSearch,
      args
    );

    // Call BrightData MCP
    const brightdataResponse = await fetch(
      "https://api.brightdata.com/mcp/search",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: args.query,
          type: "product",
          filters: {
            price_max: args.filters?.maxPrice,
            price_min: args.filters?.minPrice,
          },
          limit: 20,
        }),
      }
    );

    const data = await brightdataResponse.json();

    // Save products to database
    const productIds = await Promise.all(
      data.results.map((item: any, index: number) =>
        ctx.runMutation(internal.products.saveProduct, {
          searchId,
          userId: args.userId,
          title: item.title,
          price: parseFloat(item.price),
          currency: item.currency ?? "USD",
          imageUrl: item.image_url,
          productUrl: item.url,
          description: item.description,
          merchant: item.merchant_name,
          features: item.features ?? [],
          position: index + 1,
        })
      )
    );

    // Update search with result count
    await ctx.runMutation(internal.productSearches.updateResultCount, {
      searchId,
      totalResults: productIds.length,
    });

    // Log analytics
    await ctx.runMutation(internal.searchAnalytics.logSearch, {
      userId: args.userId,
      searchId,
      responseTime: Date.now() - startTime,
      resultCount: productIds.length,
      brightdataRequestCount: 1,
      cacheHit: false,
    });

    const products = await ctx.runQuery(
      internal.products.getSearchResults,
      { searchId }
    );

    return { searchId, products, cached: false };
  },
});
```
- **Purpose**: Main product search function called by Gemini
- **Returns**: `{ searchId: Id, products: Product[], cached: boolean }`
- **Tooling**: BrightData MCP for web scraping
- **Limits**: 20 results max, 30-second timeout
- **Notes**: Implements caching to reduce API costs

**Refine Search** (`convex/brightdata.ts`):
```typescript
export const refineSearch = action({
  args: {
    userId: v.id("users"),
    originalSearchId: v.id("productSearches"),
    refinement: v.string(),  // e.g., "cheaper options" or "wooden only"
  },
  handler: async (ctx, args) => {
    // Get original search
    const originalSearch = await ctx.runQuery(
      internal.productSearches.getSearchById,
      { searchId: args.originalSearchId }
    );

    if (!originalSearch) {
      throw new Error("Original search not found");
    }

    // Use Gemini to interpret refinement
    const refinedFilters = await interpretRefinement(
      originalSearch.query,
      args.refinement,
      originalSearch.filters
    );

    // Perform new search with refined filters
    return await ctx.runAction(internal.brightdata.searchProducts, {
      userId: args.userId,
      query: originalSearch.query,
      filters: refinedFilters,
    });
  },
});
```
- **Purpose**: Handle user requests like "find cheaper options"
- **Returns**: `{ searchId: Id, products: Product[] }`
- **Notes**: Uses Gemini to interpret natural language refinements

### 5. Frontend

#### Components

**ProductSearchTrigger.tsx** (Internal - called by voice agent):
- Not directly rendered in UI
- Triggered by Gemini function call during voice conversation
- Calls `useAction(api.brightdata.searchProducts)`
- Updates global state with search results

**ProductGrid.tsx** (`app/components/ProductGrid.tsx`):
- Client Component displaying search results
- Uses `useQuery(api.products.getSearchResults)`
- Grid layout with numbered cards (for voice reference)
- Each card shows: image, title, price, merchant
- Click to expand for full description

**SavedProductsList.tsx** (`app/components/SavedProductsList.tsx`):
- Client Component showing user's saved products
- Uses `useQuery(api.savedProducts.getSavedProducts)`
- Displays product numbers for voice commands
- Delete button with confirmation

**ProductCard.tsx** (`app/components/ProductCard.tsx`):
- Reusable product display component
- Props: `product`, `displayNumber`, `onSave`, `onRemove`
- Shows product image, price, merchant badge
- Save/Remove actions

#### State Strategy

- **Search Results**: Managed by Convex `useQuery()` with real-time updates
- **Current Search**: Stored in local state via `useState()`
- **Loading States**: Track pending BrightData requests
- **Saved Products**: Real-time sync with Convex
- **Voice Context**: Shared state with VoiceSession via Context API

#### File Structure

```
app/
├── components/
│   ├── ProductGrid.tsx
│   ├── ProductCard.tsx
│   ├── SavedProductsList.tsx
│   └── ProductFilters.tsx (future)
├── hooks/
│   ├── useProductSearch.ts
│   └── useSavedProducts.ts
└── dashboard/
    └── page.tsx (integrates ProductGrid + SavedProductsList)
```

### 6. Error Prevention

#### API Error Handling
- BrightData timeout: 30-second timeout, return partial results if available
- BrightData rate limits: Queue requests, show "searching..." indicator
- Invalid product data: Skip malformed entries, log to analytics
- Network failures: Retry with exponential backoff (3 attempts max)

#### Schema Validation
```typescript
import { z } from "zod";

const ProductSchema = z.object({
  title: z.string().min(1).max(500),
  price: z.number().positive(),
  currency: z.string().length(3),  // ISO 4217
  productUrl: z.string().url(),
  merchant: z.string().min(1),
  imageUrl: z.string().url().optional(),
  features: z.array(z.string()).optional(),
});

const SearchFiltersSchema = z.object({
  maxPrice: z.number().positive().optional(),
  minPrice: z.number().nonnegative().optional(),
  features: z.array(z.string()).optional(),
  category: z.string().optional(),
});
```

#### Rate Limiting
- Product searches: 10 per minute per user
- BrightData requests: Track usage, warn at 80% of monthly quota
- Saved products: Max 100 saved per user
- Cache: Enforce 1-hour TTL, auto-cleanup expired entries

#### Authentication & Authorization
- All search actions require authenticated `userId`
- Validate user owns saved products before deletion
- BrightData API key stored server-side only

#### Type Safety
- Strict TypeScript for all product interfaces
- Convex auto-generated types for database operations
- Zod runtime validation for BrightData responses

#### Boundaries & Quotas
- BrightData free tier: 5,000 requests/month
- Search results limit: 20 products max per search
- Cache storage: Auto-delete searches older than 24 hours
- Product images: Use CDN URLs, no local storage

### 7. Testing

#### Unit Tests
- `createProductSearch`: Validates cache TTL calculation
- `saveProduct`: Tests price parsing and currency handling
- `addToSavedProducts`: Verifies display number auto-increment
- `getCachedSearch`: Tests cache expiry logic
- `searchProducts`: Mock BrightData API response

#### Integration Tests
- Full search flow: Query → BrightData → Save products → Display
- Cache hit: Second identical query returns cached results
- Refinement: "Find cheaper" updates filters correctly
- Save/Remove: Products added and removed from saved list
- Analytics: Search logged with correct metrics

#### End-to-End Tests (Playwright)
1. User voice command: "Find wooden chairs under $100"
2. Gemini triggers `searchProducts` function call
3. BrightData MCP searches e-commerce sites
4. Products appear in ProductGrid with numbers
5. User says "Save product number 3"
6. Product appears in SavedProductsList
7. User says "Remove product number 3"
8. Product removed from saved list

#### Performance Tests
- BrightData response time: Target <5 seconds for 20 products
- Cache retrieval: <100ms for cached searches
- Database writes: Batch 20 products in <1 second
- UI render: ProductGrid with 20 items in <500ms

#### AI-Specific Tests
- Gemini function call accuracy: Correct args passed to searchProducts
- Natural language filters: "Under $50" → `maxPrice: 50`
- Multi-criteria search: "Wooden chairs under $100" → correct filters
- Ambiguous queries: Gemini asks clarifying questions

## Documentation Sources

1. BrightData MCP Documentation - https://docs.brightdata.com/api-reference/MCP-Server
2. BrightData API Reference - https://brightdata.com/ai/mcp-server
3. Gemini Function Calling - https://ai.google.dev/gemini-api/docs/function-calling
4. Convex Actions Guide - https://docs.convex.dev/functions/actions
5. Next.js App Router - https://nextjs.org/docs/app
6. Zod Validation - https://zod.dev
7. Convex Database Queries - https://docs.convex.dev/database/reading-data
8. Model Context Protocol Spec - https://modelcontextprotocol.io
9. Cheerio HTML Parsing - https://cheerio.js.org
10. React Query for Convex - https://docs.convex.dev/client/react
