# Roadmap: Dynamic Product Interface

## Context

**Tech Stack:** Next.js, React, Convex, Clerk, TypeScript, Tailwind CSS, Framer Motion

**Feature Description:** Interactive product display that dynamically shows numbered product cards with images, prices, and details as the voice agent finds results.

**Goals:**
- Display products in real-time as search results arrive
- Show prominent numbers for voice reference (1, 2, 3...)
- Provide smooth animations for product appearance
- Maintain responsive layout across devices
- Support visual states (loading, empty, error)

## Implementation Steps

Each step is mandatory for shipping Dynamic Product Interface.

### 1. Manual Setup (User Required)

- [ ] No external accounts required (uses existing Convex and Clerk setup)
- [ ] Verify Tailwind CSS is configured in Next.js project
- [ ] Install Framer Motion for animations (see Dependencies section)
- [ ] Ensure image optimization is enabled in next.config.js
- [ ] Configure allowed image domains for product images (Amazon, eBay CDNs)

### 2. Dependencies & Environment

**NPM Packages:**
```bash
npm install framer-motion
npm install clsx tailwind-merge # for conditional CSS classes
npm install react-intersection-observer # for lazy loading images
```

**Next.js Configuration:**

Add to `next.config.js`:
```javascript
module.exports = {
  images: {
    domains: [
      'm.media-amazon.com',
      'i.ebayimg.com',
      'images-na.ssl-images-amazon.com',
      // Add other product image CDNs
    ],
    formats: ['image/avif', 'image/webp'],
  },
};
```

**Environment Variables:**

Frontend (.env.local):
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_PRODUCTS_PER_PAGE=20
```

### 3. Database Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products: defineTable({
    searchId: v.id("productSearches"),
    userId: v.id("users"),
    number: v.number(), // Display number (1-20)
    title: v.string(),
    price: v.number(),
    currency: v.string(),
    imageUrl: v.optional(v.string()),
    productUrl: v.string(),
    source: v.string(),
    details: v.object({
      rating: v.optional(v.number()),
      reviewCount: v.optional(v.number()),
      availability: v.optional(v.string()),
      features: v.optional(v.array(v.string())),
      shipping: v.optional(v.string()),
    }),
    addedAt: v.number(),
    viewedAt: v.optional(v.number()), // Timestamp when user viewed
    displayOrder: v.number(), // For custom sorting
  })
    .index("by_search", ["searchId"])
    .index("by_search_order", ["searchId", "displayOrder"])
    .index("by_user", ["userId"]),

  productViews: defineTable({
    productId: v.id("products"),
    userId: v.id("users"),
    viewedAt: v.number(),
    duration: v.optional(v.number()), // Seconds spent viewing
  })
    .index("by_product", ["productId"])
    .index("by_user", ["userId"]),
});
```

### 4. Backend Functions

**Mutations:**

`convex/products.ts` - **markViewed**
- **Purpose:** Record when user views a product card
- **Args:** `{ productId: Id<"products"> }`
- **Returns:** `void`
- **Notes:** Updates `viewedAt` timestamp for analytics

`convex/products.ts` - **recordView**
- **Purpose:** Log product view event for recommendations
- **Args:** `{ productId: Id<"products">, duration?: number }`
- **Returns:** `Id<"productViews">`
- **Notes:** Tracks engagement for future personalization

**Queries:**

`convex/products.ts` - **getProductsBySearch**
- **Purpose:** Get all products for active search, ordered by display number
- **Args:** `{ searchId: Id<"productSearches"> }`
- **Returns:** `Array<Product>`
- **Notes:** Ordered by `displayOrder` ASC for consistent numbering

`convex/products.ts` - **getProductById**
- **Purpose:** Get single product details
- **Args:** `{ productId: Id<"products"> }`
- **Returns:** `Product | null`
- **Notes:** Used when expanding product details

`convex/products.ts` - **getProductsRealtime**
- **Purpose:** Reactive query that updates as new products arrive
- **Args:** `{ searchId: Id<"productSearches"> }`
- **Returns:** `{ products: Array<Product>, isComplete: boolean, total: number }`
- **Notes:** Returns `isComplete: false` while search is ongoing

### 5. Frontend

**Pages:**

`app/shop/page.tsx` - Main shopping dashboard
- Displays microphone button (from voice agent feature)
- Renders `<ProductGrid>` component
- Shows `<PreferenceList>` sidebar
- Handles layout with 3-column grid (mic + products + preferences)

**Components:**

`components/ProductGrid.tsx` - Real-time product grid
- Uses `useQuery(api.products.getProductsRealtime)` for live updates
- Renders products in responsive grid (1-4 columns based on screen size)
- Animates new products with Framer Motion `<AnimatePresence>`
- Shows loading skeleton while `isComplete === false`
- Props: `{ searchId: Id<"productSearches"> }`

`components/ProductCard.tsx` - Individual product card
- Displays large number badge (top-left, voice-reference)
- Shows optimized image using Next.js `<Image>`
- Renders price with currency formatting
- Displays star rating and review count
- Click to expand inline details (features, availability)
- Props: `{ product: Product, onView: (id: Id<"products">) => void }`

`components/ProductSkeleton.tsx` - Loading placeholder
- Animated shimmer effect using Tailwind CSS
- Matches ProductCard dimensions
- Displays while search is in progress

`components/ProductDetails.tsx` - Expanded product view
- Inline expansion below product card (no modal)
- Shows full feature list, shipping info, availability
- "Open in new tab" button for product URL
- Props: `{ product: Product, onClose: () => void }`

`components/EmptyState.tsx` - Empty results UI
- Shown when search returns 0 products
- Suggests alternative search terms
- Props: `{ message?: string }`

**Hooks:**

`hooks/useProductGrid.ts` - Product grid state management
- Wraps `useQuery(api.products.getProductsRealtime)`
- Manages expanded product state
- Handles intersection observer for view tracking
- Returns `{ products, isLoading, isComplete, expandedProduct, toggleExpand }`

`hooks/useProductView.ts` - Product view tracking
- Uses `IntersectionObserver` to detect when product enters viewport
- Calls `useMutation(api.products.markViewed)` automatically
- Tracks view duration
- Returns `{ ref, isInView }`

### 6. Error Prevention

**API Error Handling:**
- Handle Convex query errors with `<ErrorBoundary>`
- Show fallback UI when product images fail to load
- Retry failed image loads (3 attempts)
- Display error toast for mutation failures

**Schema Validation:**
- Validate product data structure before rendering
- Check required fields (title, price, number) exist
- Handle missing optional fields (imageUrl, rating) gracefully
- Sanitize product URLs before opening in new tab

**Authentication/Authorization:**
- Verify user is authenticated before showing products
- Validate userId matches authenticated user in queries
- Handle Clerk session expiry with redirect to login

**Type Safety:**
- Define strict TypeScript interfaces for all product data
- Use Convex-generated types for query results
- Type all component props with interfaces
- Enable `strict` mode in tsconfig.json

**Rate Limiting:**
- Throttle view tracking mutations (max 1 per product per session)
- Debounce expanded product state changes (300ms)
- Limit product grid to 20 items to prevent performance issues

**Boundaries/Quotas:**
- Image optimization: Use Next.js Image component with proper sizing
- Animation performance: Use Framer Motion's `layoutId` for smooth transitions
- Max products per search: 20 (enforced in backend)
- Lazy load images below the fold

### 7. Testing

**Unit Tests:**
- [ ] Test `getProductsBySearch` returns products in correct order
- [ ] Test `markViewed` mutation updates timestamp
- [ ] Test `ProductCard` renders all required fields
- [ ] Test `ProductSkeleton` matches card dimensions
- [ ] Test empty state displays when no products

**Integration Tests:**
- [ ] Test real-time updates: new product appears in grid automatically
- [ ] Test expanded product state toggles correctly
- [ ] Verify view tracking fires when product enters viewport
- [ ] Test responsive grid layout at different breakpoints

**E2E Tests (Playwright):**
- [ ] Products appear one-by-one during search
- [ ] Click product → details expand inline
- [ ] Verify numbers are prominent and sequential (1, 2, 3...)
- [ ] Test grid layout on mobile, tablet, desktop
- [ ] Verify images load with proper optimization

**Performance Tests:**
- [ ] Measure time to first product render (target: <500ms)
- [ ] Test animation performance (target: 60fps)
- [ ] Monitor Lighthouse score (target: >90)
- [ ] Verify image lazy loading reduces initial load time

**Accessibility Tests:**
- [ ] Test keyboard navigation (Tab through products)
- [ ] Verify ARIA labels on product numbers
- [ ] Test screen reader compatibility
- [ ] Ensure color contrast meets WCAG AA standards

## Documentation Sources

1. Framer Motion Documentation - https://www.framer.com/motion/
2. Next.js Image Optimization - https://nextjs.org/docs/app/building-your-application/optimizing/images
3. Convex Reactive Queries - https://docs.convex.dev/client/react/useQuery
4. Tailwind CSS Grid System - https://tailwindcss.com/docs/grid-template-columns
5. React Intersection Observer - https://github.com/thebuilder/react-intersection-observer
6. Web Accessibility Guidelines - https://www.w3.org/WAI/WCAG21/quickref/
