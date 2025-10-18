# Roadmap: Dynamic Product Interface

## Context

**Tech Stack**: Next.js 15 (App Router), React 19, Convex (Real-time Database), Framer Motion (Animations), Tailwind CSS

**Feature Description**: A dynamic, real-time product display interface that updates as the voice agent searches and finds products. Products appear with numbered cards showing image, price, and details. The interface responds to voice commands for saving/removing products.

**Goals**:
- Real-time product updates as search results arrive
- Smooth animations for product cards appearing/disappearing
- Numbered display for voice command reference
- Responsive grid layout adapting to product count
- Optimistic UI updates for save/remove actions
- Accessibility support for screen readers

## Implementation Steps

Each step is mandatory for shipping the Dynamic Product Interface feature.

### 1. Manual Setup (User Required)

- [ ] Install Tailwind CSS (should already be configured in Next.js)
- [ ] Set up Framer Motion for animations
- [ ] Configure Next.js Image Optimization domains for product images
- [ ] Set up Convex real-time subscriptions (should be configured)
- [ ] Review Clerk authentication integration

### 2. Dependencies & Environment

**NPM Packages**:
```bash
npm install framer-motion
npm install @radix-ui/react-dialog
npm install @radix-ui/react-toast
npm install lucide-react  # For icons
npm install clsx
npm install tailwind-merge
```

**Tailwind Configuration** (`tailwind.config.ts`):
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      animation: {
        "slide-in": "slideIn 0.3s ease-out",
        "fade-in": "fadeIn 0.2s ease-in",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

**Environment Variables** (`.env.local`):
```bash
# Next.js Image Optimization
NEXT_PUBLIC_IMAGE_DOMAINS=images.example.com,cdn.merchant.com

# Convex (already configured)
NEXT_PUBLIC_CONVEX_URL=your_convex_url
```

### 3. Database Schema

**Convex Schema** (`convex/schema.ts`):

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // UI state management for active product display
  activeProductDisplay: defineTable({
    userId: v.id("users"),
    sessionId: v.optional(v.id("voiceSessions")),
    searchId: v.id("productSearches"),
    // Display configuration
    layout: v.union(v.literal("grid"), v.literal("list")),
    sortBy: v.union(
      v.literal("position"),
      v.literal("price_asc"),
      v.literal("price_desc"),
      v.literal("relevance")
    ),
    // Pagination
    currentPage: v.number(),
    itemsPerPage: v.number(),
    // UI state
    expandedProductId: v.optional(v.id("products")),
    lastUpdated: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_session", ["sessionId"]),

  // Product interaction events (for analytics)
  productInteractions: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
    action: v.union(
      v.literal("view"),
      v.literal("expand"),
      v.literal("save"),
      v.literal("remove"),
      v.literal("click")
    ),
    timestamp: v.number(),
    sessionId: v.optional(v.id("voiceSessions")),
    // Context
    displayNumber: v.optional(v.number()),
    source: v.union(v.literal("voice"), v.literal("ui")),
  })
    .index("by_user", ["userId"])
    .index("by_product", ["productId"])
    .index("by_timestamp", ["timestamp"]),
});
```

### 4. Backend Functions

#### Mutations

**Update Display State** (`convex/activeProductDisplay.ts`):
```typescript
export const updateDisplayState = mutation({
  args: {
    userId: v.id("users"),
    searchId: v.id("productSearches"),
    layout: v.optional(v.union(v.literal("grid"), v.literal("list"))),
    sortBy: v.optional(v.union(
      v.literal("position"),
      v.literal("price_asc"),
      v.literal("price_desc")
    )),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("activeProductDisplay")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        searchId: args.searchId,
        layout: args.layout ?? existing.layout,
        sortBy: args.sortBy ?? existing.sortBy,
        lastUpdated: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("activeProductDisplay", {
      userId: args.userId,
      searchId: args.searchId,
      layout: args.layout ?? "grid",
      sortBy: args.sortBy ?? "position",
      currentPage: 1,
      itemsPerPage: 12,
      lastUpdated: Date.now(),
    });
  },
});
```
- **Purpose**: Track user's current display preferences
- **Returns**: `Id<"activeProductDisplay">`
- **Notes**: Persists layout and sort preferences

**Log Product Interaction** (`convex/productInteractions.ts`):
```typescript
export const logProductInteraction = mutation({
  args: {
    userId: v.id("users"),
    productId: v.id("products"),
    action: v.union(
      v.literal("view"),
      v.literal("expand"),
      v.literal("save"),
      v.literal("remove"),
      v.literal("click")
    ),
    displayNumber: v.optional(v.number()),
    source: v.union(v.literal("voice"), v.literal("ui")),
    sessionId: v.optional(v.id("voiceSessions")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("productInteractions", {
      ...args,
      timestamp: Date.now(),
    });
  },
});
```
- **Purpose**: Track user interactions for analytics
- **Returns**: `Id<"productInteractions">`
- **Notes**: Helps understand which products users engage with

**Expand Product** (`convex/activeProductDisplay.ts`):
```typescript
export const expandProduct = mutation({
  args: {
    userId: v.id("users"),
    productId: v.optional(v.id("products")),
  },
  handler: async (ctx, args) => {
    const display = await ctx.db
      .query("activeProductDisplay")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!display) {
      throw new Error("No active display found");
    }

    await ctx.db.patch(display._id, {
      expandedProductId: args.productId,
      lastUpdated: Date.now(),
    });

    // Log interaction
    if (args.productId) {
      await ctx.db.insert("productInteractions", {
        userId: args.userId,
        productId: args.productId,
        action: "expand",
        timestamp: Date.now(),
        source: "ui",
      });
    }
  },
});
```
- **Purpose**: Track which product is expanded in UI
- **Returns**: `void`
- **Notes**: Supports modal view of product details

#### Queries

**Get Active Display** (`convex/activeProductDisplay.ts`):
```typescript
export const getActiveDisplay = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("activeProductDisplay")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});
```
- **Purpose**: Retrieve current display configuration
- **Returns**: `ActiveProductDisplay | null`
- **Notes**: Real-time subscription for UI updates

**Get Products for Display** (`convex/products.ts`):
```typescript
export const getProductsForDisplay = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const display = await ctx.db
      .query("activeProductDisplay")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (!display) {
      return { products: [], total: 0 };
    }

    // Get products for current search
    let productsQuery = ctx.db
      .query("products")
      .withIndex("by_search", (q) => q.eq("searchId", display.searchId));

    // Apply sorting
    const allProducts = await productsQuery.collect();

    let sortedProducts = [...allProducts];
    if (display.sortBy === "price_asc") {
      sortedProducts.sort((a, b) => a.price - b.price);
    } else if (display.sortBy === "price_desc") {
      sortedProducts.sort((a, b) => b.price - a.price);
    } else {
      sortedProducts.sort((a, b) => a.position - b.position);
    }

    // Pagination
    const start = (display.currentPage - 1) * display.itemsPerPage;
    const end = start + display.itemsPerPage;
    const paginatedProducts = sortedProducts.slice(start, end);

    return {
      products: paginatedProducts,
      total: sortedProducts.length,
      currentPage: display.currentPage,
      totalPages: Math.ceil(sortedProducts.length / display.itemsPerPage),
    };
  },
});
```
- **Purpose**: Get sorted and paginated products for display
- **Returns**: `{ products: Product[], total: number, currentPage: number, totalPages: number }`
- **Notes**: Real-time updates when new products added

**Get Product Interactions** (`convex/productInteractions.ts`):
```typescript
export const getProductInteractions = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    return await ctx.db
      .query("productInteractions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});
```
- **Purpose**: Retrieve interaction history for analytics
- **Returns**: `ProductInteraction[]`
- **Notes**: Used for personalization insights

### 5. Frontend

#### Components

**ProductGrid.tsx** (`app/components/ProductGrid.tsx`):
```typescript
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import ProductCard from "./ProductCard";
import { useAuth } from "@clerk/nextjs";

export default function ProductGrid() {
  const { userId } = useAuth();
  const displayData = useQuery(api.products.getProductsForDisplay, {
    userId: userId!,
  });
  const expandProduct = useMutation(api.activeProductDisplay.expandProduct);

  if (!displayData) {
    return <ProductGridSkeleton />;
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {displayData.products.map((product, index) => (
            <motion.div
              key={product._id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05,
              }}
            >
              <ProductCard
                product={product}
                displayNumber={product.position}
                onExpand={() => expandProduct({
                  userId: userId!,
                  productId: product._id
                })}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {displayData.products.length === 0 && (
        <EmptyState message="No products found. Try a different search." />
      )}
    </div>
  );
}
```
- **Purpose**: Main grid displaying product cards with animations
- **State**: Real-time Convex subscriptions for products
- **Animations**: Staggered fade-in, layout shifts
- **Responsive**: 1-4 columns based on screen size

**ProductCard.tsx** (`app/components/ProductCard.tsx`):
```typescript
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Heart, ExternalLink } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import type { Doc } from "@/convex/_generated/dataModel";

interface ProductCardProps {
  product: Doc<"products">;
  displayNumber: number;
  onExpand: () => void;
}

export default function ProductCard({
  product,
  displayNumber,
  onExpand
}: ProductCardProps) {
  const { userId } = useAuth();
  const [isSaved, setIsSaved] = useState(false);
  const saveProduct = useMutation(api.savedProducts.addToSavedProducts);
  const logInteraction = useMutation(api.productInteractions.logProductInteraction);

  const handleSave = async () => {
    if (!userId) return;

    setIsSaved(true);
    await saveProduct({
      userId,
      productId: product._id,
    });

    await logInteraction({
      userId,
      productId: product._id,
      action: "save",
      displayNumber,
      source: "ui",
    });
  };

  const handleClick = async () => {
    if (!userId) return;

    await logInteraction({
      userId,
      productId: product._id,
      action: "click",
      displayNumber,
      source: "ui",
    });

    window.open(product.productUrl, "_blank");
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="relative bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 cursor-pointer"
      onClick={onExpand}
    >
      {/* Product Number Badge */}
      <div className="absolute top-2 left-2 z-10 bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
        {displayNumber}
      </div>

      {/* Save Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          handleSave();
        }}
        className={`absolute top-2 right-2 z-10 p-2 rounded-full ${
          isSaved ? "bg-red-500" : "bg-gray-200"
        }`}
      >
        <Heart
          className={`w-5 h-5 ${isSaved ? "fill-white text-white" : "text-gray-600"}`}
        />
      </motion.button>

      {/* Product Image */}
      <div className="relative h-48 w-full bg-gray-100">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
          {product.title}
        </h3>

        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold text-blue-600">
            {product.currency} {product.price.toFixed(2)}
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-3">
          {product.merchant}
        </p>

        {product.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
            {product.description}
          </p>
        )}

        {/* Features Tags */}
        {product.features && product.features.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {product.features.slice(0, 3).map((feature, idx) => (
              <span
                key={idx}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
              >
                {feature}
              </span>
            ))}
          </div>
        )}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className="w-full bg-blue-600 text-white py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
        >
          View Product
          <ExternalLink className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}
```
- **Purpose**: Individual product card with save/view actions
- **Animations**: Hover effects, save button feedback
- **Optimistic UI**: Immediate visual feedback on save
- **Accessibility**: Proper ARIA labels, keyboard navigation

**ProductModal.tsx** (`app/components/ProductModal.tsx`):
- Client Component showing expanded product details
- Uses `@radix-ui/react-dialog` for accessible modal
- Displays full description, all features, rating
- Large image gallery if multiple images available
- Direct purchase link button

**EmptyState.tsx** (`app/components/EmptyState.tsx`):
- Displayed when no products found
- Friendly illustration or icon
- Suggestions for refining search
- CTA to start new search

**ProductGridSkeleton.tsx** (`app/components/ProductGridSkeleton.tsx`):
- Loading state placeholder
- Animated skeleton cards matching ProductCard layout
- Pulse animation for visual feedback

#### State Strategy

- **Product Data**: Real-time Convex subscriptions via `useQuery()`
- **Save Actions**: Optimistic updates with `useMutation()` and local state
- **Expanded Product**: Controlled by Convex mutation for consistency
- **Loading States**: Automatic with Convex's built-in loading states
- **Animations**: Framer Motion for enter/exit transitions

#### File Structure

```
app/
├── components/
│   ├── ProductGrid.tsx
│   ├── ProductCard.tsx
│   ├── ProductModal.tsx
│   ├── EmptyState.tsx
│   ├── ProductGridSkeleton.tsx
│   ├── SavedProductsList.tsx
│   └── ui/
│       ├── dialog.tsx (Radix wrapper)
│       └── toast.tsx (Radix wrapper)
├── hooks/
│   ├── useProductDisplay.ts
│   └── useProductInteractions.ts
├── lib/
│   └── utils.ts (clsx, cn helpers)
└── dashboard/
    └── page.tsx
```

### 6. Error Prevention

#### API Error Handling
- Convex query failures: Show error toast, retry after delay
- Image loading errors: Fallback to placeholder image
- Mutation failures: Revert optimistic updates, show error message
- Network issues: Queue mutations, retry when online

#### Schema Validation
```typescript
import { z } from "zod";

const ProductCardPropsSchema = z.object({
  product: z.object({
    _id: z.string(),
    title: z.string(),
    price: z.number(),
    currency: z.string(),
    imageUrl: z.string().url().optional(),
    merchant: z.string(),
  }),
  displayNumber: z.number().int().positive(),
});
```

#### Rate Limiting
- Save actions: Debounce by 500ms to prevent double-clicks
- Expand actions: Debounce by 200ms
- Interaction logging: Batch every 2 seconds

#### Authentication & Authorization
- Verify user authenticated before any mutation
- Only allow users to interact with their own products
- Protect all Convex queries with user ID filter

#### Type Safety
- Strict TypeScript for all components
- Convex auto-generated types for database operations
- Props interfaces for all components

#### Boundaries & Quotas
- Display max 50 products per search (pagination)
- Image optimization via Next.js: max 2MB per image
- Limit saved products to 100 per user
- Animation performance: Use `will-change` sparingly

### 7. Testing

#### Unit Tests
- `updateDisplayState`: Tests layout/sort preference updates
- `logProductInteraction`: Validates interaction logging
- `getProductsForDisplay`: Tests sorting and pagination logic
- `ProductCard`: Tests save button toggle state
- `ProductGrid`: Tests rendering with different product counts

#### Integration Tests
- Full display flow: Search → Display → Sort → Save
- Pagination: Navigate pages, verify correct products shown
- Real-time updates: New products appear without refresh
- Optimistic UI: Save button updates before mutation completes

#### End-to-End Tests (Playwright)
1. User starts voice search
2. Products appear one by one with stagger animation
3. User clicks product card to expand
4. Modal shows full details
5. User clicks save button
6. Product appears in saved list with number
7. User changes sort order
8. Products re-order smoothly

#### Performance Tests
- Render time: 50 products in <1 second
- Animation smoothness: 60 FPS for all transitions
- Image loading: Lazy load off-screen images
- Memory usage: No leaks after repeated searches
- Scroll performance: Smooth scrolling with 100+ products

#### Accessibility Tests
- Keyboard navigation: Tab through all products and actions
- Screen reader: Proper announcements for all elements
- Color contrast: WCAG AA compliance
- Focus indicators: Visible focus states
- ARIA labels: Descriptive labels for all interactive elements

#### Visual Regression Tests
- Screenshot comparison for ProductCard states
- Modal layout consistency
- Grid layout at various breakpoints
- Empty state appearance
- Loading skeleton accuracy

## Documentation Sources

1. Framer Motion Documentation - https://www.framer.com/motion/
2. Next.js Image Optimization - https://nextjs.org/docs/app/api-reference/components/image
3. Convex React Hooks - https://docs.convex.dev/client/react
4. Radix UI Primitives - https://www.radix-ui.com/primitives
5. Tailwind CSS - https://tailwindcss.com/docs
6. Lucide Icons - https://lucide.dev
7. React Aria Patterns - https://react-spectrum.adobe.com/react-aria/
8. Clerk Authentication - https://clerk.com/docs
9. Next.js App Router - https://nextjs.org/docs/app
10. TypeScript Best Practices - https://www.typescriptlang.org/docs/handbook/
