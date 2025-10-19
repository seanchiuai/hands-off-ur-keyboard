---
name: agent-dynamic-product-interface
description: Interactive product display that dynamically shows numbered product cards with images, prices, and details as the voice agent finds results
model: inherit
color: purple
tech_stack:
  framework: Next.js
  database: Convex
  auth: Clerk
  provider: React components with real-time updates
generated: 2025-10-18T00:00:00Z
documentation_sources: [
  "https://nextjs.org/docs",
  "https://docs.convex.dev/client/react",
  "https://clerk.com/docs/references/react/use-user",
  "https://react.dev/reference/react/useEffect"
]
---

# Agent: Dynamic Product Interface Implementation with React and Next.js

---

## Agent Overview

**Purpose** – This agent implements an interactive product display system that dynamically renders numbered product cards showing images, prices, and details as results stream in from the voice shopping assistant. The interface provides real-time visual feedback synchronized with voice interactions, creating a seamless multimodal shopping experience.

**Tech Stack** – Next.js 14+ (App Router), React 18+, Convex (real-time database), Clerk (authentication), TypeScript, Tailwind CSS, Framer Motion (animations).

**Source** – Next.js official documentation for App Router patterns, Convex React hooks documentation for real-time subscriptions, Clerk authentication guides, React documentation for component lifecycle and state management.

---

## Critical Implementation Knowledge

### React Real-Time Updates 🚨

* **Latest Pattern**: Use Convex `useQuery` hook for automatic real-time subscriptions to product results
* **State Management**: Products update automatically when voice agent adds new results to database
* **Optimistic UI**: Show loading states immediately while data streams in
* **Performance**: Leverage React 18+ automatic batching for smooth updates during rapid product additions

### Common Pitfalls & Solutions 🚨

* **Pitfall**: Products flicker or re-render unnecessarily during streaming updates
  * **Solution**: Use React `key` prop with stable product IDs and implement proper memoization with `useMemo` for product list transformations

* **Pitfall**: Product images load slowly causing layout shift
  * **Solution**: Use Next.js `<Image>` component with proper width/height, implement skeleton loading states, and preload images

* **Pitfall**: Product numbering gets out of sync with display order
  * **Solution**: Number products based on their position in the array after sorting by creation timestamp, not by database ID

* **Pitfall**: Stale product data shown when switching between search sessions
  * **Solution**: Implement session-based queries that filter products by current voice session ID

* **Pitfall**: Race conditions when multiple products added simultaneously
  * **Solution**: Rely on Convex's atomic operations and consistent ordering by creation timestamp

### Best Practices 🚨

* **DO** use Convex reactive queries to automatically sync UI with database changes
* **DO** implement proper loading and empty states for better UX
* **DO** add smooth animations for product cards appearing using Framer Motion
* **DO** use semantic HTML and ARIA labels for accessibility
* **DO** implement proper error boundaries for failed image loads
* **DO** optimize for mobile-first responsive design
* **DON'T** manually poll for updates - use Convex subscriptions
* **DON'T** store product data in local component state - use database as source of truth
* **DON'T** assume products arrive in order - always sort by timestamp
* **DON'T** skip loading states - they provide critical user feedback
* **DON'T** hardcode product card dimensions - use responsive design

---

## Implementation Steps

### Architecture Overview

The Dynamic Product Interface uses a reactive architecture where Convex real-time queries automatically update the UI as the voice agent discovers and adds products. Products are stored in Convex with session IDs to isolate different search conversations. The frontend subscribes to the current session's products and renders them as numbered cards with smooth animations.

### Backend Implementation

**Key Server Files:**

* `convex/schema.ts` - Database schema defining products table with fields for name, price, image URL, description, session ID, and timestamps
* `convex/products.ts` - Mutations for adding products from voice agent, queries for fetching products by session ID with proper sorting
* `convex/sessions.ts` - Manages voice shopping session lifecycle and session-product relationships
* `convex/http.ts` - HTTP endpoints for voice agent to POST product discoveries with proper CORS headers

### Frontend Integration

**Key React Components:**

* `app/shop/page.tsx` - Main shopping page that initializes voice session and renders product grid
* `components/ProductCard.tsx` - Individual product card component with image, price, title, number badge, and details
* `components/ProductGrid.tsx` - Grid container that subscribes to products via `useQuery` and handles real-time updates
* `components/ProductSkeleton.tsx` - Loading skeleton for smooth loading experience
* `hooks/useProducts.ts` - Custom hook wrapping Convex `useQuery` with session filtering logic
* `hooks/useVoiceSession.ts` - Manages active voice shopping session state

---

## Code Patterns

### `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Schema for product results discovered by voice agent
export default defineSchema({
  // Voice shopping sessions
  voiceSessions: defineTable({
    userId: v.string(), // Clerk user ID
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("cancelled")),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Products discovered during voice shopping
  products: defineTable({
    sessionId: v.id("voiceSessions"), // Links to voice session
    name: v.string(),
    price: v.number(), // Store in cents to avoid floating point issues
    currency: v.string(), // e.g., "USD"
    imageUrl: v.string(), // Product image URL
    description: v.string(),
    vendor: v.optional(v.string()),
    externalUrl: v.optional(v.string()), // Link to product page
    position: v.number(), // Order in which voice agent found the product
    createdAt: v.number(), // Timestamp for consistent ordering
  })
    .index("by_session", ["sessionId", "position"]) // Efficient session-based queries
    .index("by_created", ["createdAt"]), // Fallback ordering
});
```

This schema establishes the core data structure with proper indexing for efficient real-time queries. The `position` field ensures products display in discovery order, while `sessionId` isolates products between different shopping conversations.

---

### `convex/products.ts`

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Add product discovered by voice agent
export const addProduct = mutation({
  args: {
    sessionId: v.id("voiceSessions"),
    name: v.string(),
    price: v.number(),
    currency: v.string(),
    imageUrl: v.string(),
    description: v.string(),
    vendor: v.optional(v.string()),
    externalUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify session exists and is active
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    if (session.status !== "active") {
      throw new Error("Cannot add products to inactive session");
    }

    // Verify user authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== session.userId) {
      throw new Error("Unauthorized");
    }

    // Get next position number for this session
    const existingProducts = await ctx.db
      .query("products")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const position = existingProducts.length + 1;

    // Insert product with auto-generated timestamp
    const productId = await ctx.db.insert("products", {
      sessionId: args.sessionId,
      name: args.name,
      price: args.price,
      currency: args.currency,
      imageUrl: args.imageUrl,
      description: args.description,
      vendor: args.vendor,
      externalUrl: args.externalUrl,
      position,
      createdAt: Date.now(),
    });

    return productId;
  },
});

// Query products for a specific session (real-time)
export const listSessionProducts = query({
  args: {
    sessionId: v.id("voiceSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    // Verify session access
    const session = await ctx.db.get(sessionId);
    if (!session) {
      return [];
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== session.userId) {
      throw new Error("Unauthorized");
    }

    // Fetch products ordered by position
    const products = await ctx.db
      .query("products")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("asc")
      .collect();

    // Return with formatted price for display
    return products.map((product) => ({
      ...product,
      formattedPrice: formatPrice(product.price, product.currency),
    }));
  },
});

// Helper function to format price
function formatPrice(cents: number, currency: string): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(dollars);
}
```

This implementation ensures products are added with proper authentication, session validation, and automatic position numbering. The query provides real-time updates with formatted prices for immediate display.

---

### `convex/sessions.ts`

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create new voice shopping session
export const createSession = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const sessionId = await ctx.db.insert("voiceSessions", {
      userId: identity.subject,
      status: "active",
      startedAt: Date.now(),
    });

    return sessionId;
  },
});

// Get active session for current user
export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Find most recent active session
    const sessions = await ctx.db
      .query("voiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("status"), "active"))
      .order("desc")
      .take(1);

    return sessions[0] || null;
  },
});

// Complete shopping session
export const completeSession = mutation({
  args: {
    sessionId: v.id("voiceSessions"),
  },
  handler: async (ctx, { sessionId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const session = await ctx.db.get(sessionId);
    if (!session || session.userId !== identity.subject) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(sessionId, {
      status: "completed",
      completedAt: Date.now(),
    });
  },
});
```

Session management ensures proper lifecycle handling and user isolation for shopping conversations.

---

### `app/shop/page.tsx`

```typescript
"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import ProductGrid from "@/components/ProductGrid";
import VoiceInterface from "@/components/VoiceInterface";

export default function ShopPage() {
  const { isLoaded, isSignedIn } = useUser();
  const activeSession = useQuery(api.sessions.getActiveSession);
  const createSession = useMutation(api.sessions.createSession);

  // Auto-create session if none exists
  useEffect(() => {
    if (isLoaded && isSignedIn && activeSession === null) {
      createSession();
    }
  }, [isLoaded, isSignedIn, activeSession, createSession]);

  if (!isLoaded) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Please sign in to start shopping</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Voice Shopping</h1>
          <p className="mt-2 text-gray-600">Speak to find products</p>
        </header>

        {/* Voice interface component */}
        <VoiceInterface sessionId={activeSession?._id} />

        {/* Product grid with real-time updates */}
        {activeSession && <ProductGrid sessionId={activeSession._id} />}
      </div>
    </div>
  );
}
```

The main page orchestrates session management and component rendering with proper authentication checks.

---

### `components/ProductGrid.tsx`

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import ProductCard from "./ProductCard";
import ProductSkeleton from "./ProductSkeleton";
import { motion, AnimatePresence } from "framer-motion";

interface ProductGridProps {
  sessionId: Id<"voiceSessions">;
}

export default function ProductGrid({ sessionId }: ProductGridProps) {
  // Real-time subscription to products
  const products = useQuery(api.products.listSessionProducts, { sessionId });

  if (products === undefined) {
    // Loading state with skeletons
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="mt-8 text-center py-12 bg-white rounded-lg shadow">
        <p className="text-gray-500">No products found yet. Start speaking to discover products!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
      <AnimatePresence mode="popLayout">
        {products.map((product, index) => (
          <motion.div
            key={product._id}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              duration: 0.3,
              delay: index * 0.1, // Stagger animation
              ease: "easeOut",
            }}
            layout
          >
            <ProductCard
              number={product.position}
              name={product.name}
              price={product.formattedPrice}
              imageUrl={product.imageUrl}
              description={product.description}
              vendor={product.vendor}
              externalUrl={product.externalUrl}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

The product grid uses Convex's reactive query to automatically update when new products are added, with smooth animations for appearing cards.

---

### `components/ProductCard.tsx`

```typescript
"use client";

import Image from "next/image";
import { useState } from "react";

interface ProductCardProps {
  number: number;
  name: string;
  price: string;
  imageUrl: string;
  description: string;
  vendor?: string;
  externalUrl?: string;
}

export default function ProductCard({
  number,
  name,
  price,
  imageUrl,
  description,
  vendor,
  externalUrl,
}: ProductCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 relative">
      {/* Product number badge */}
      <div className="absolute top-4 left-4 bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg z-10 shadow-lg">
        {number}
      </div>

      {/* Product image */}
      <div className="relative h-64 bg-gray-100">
        {!imageError ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={() => setImageError(true)}
            priority={number <= 3} // Prioritize first 3 images
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <svg
              className="w-16 h-16 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Product details */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 flex-1">
            {name}
          </h3>
          <p className="text-xl font-bold text-purple-600 ml-2 whitespace-nowrap">
            {price}
          </p>
        </div>

        {vendor && (
          <p className="text-sm text-gray-500 mb-2">by {vendor}</p>
        )}

        <p className="text-gray-600 text-sm line-clamp-3 mb-4">
          {description}
        </p>

        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block w-full text-center bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 transition-colors duration-200 font-medium"
          >
            View Product
          </a>
        )}
      </div>
    </div>
  );
}
```

Product cards display all relevant information with proper image handling, accessibility, and responsive design.

---

### `components/ProductSkeleton.tsx`

```typescript
export default function ProductSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="h-64 bg-gray-200" />

      {/* Content skeleton */}
      <div className="p-4">
        <div className="flex justify-between mb-4">
          <div className="h-6 bg-gray-200 rounded w-2/3" />
          <div className="h-6 bg-gray-200 rounded w-16" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
          <div className="h-4 bg-gray-200 rounded w-4/6" />
        </div>
        <div className="h-10 bg-gray-200 rounded mt-4" />
      </div>
    </div>
  );
}
```

Skeleton loading states provide visual feedback while products load.

---

## Testing & Debugging

* **Convex Dashboard** - Monitor real-time database updates as products are added, verify query performance and indexing
* **React DevTools** - Inspect component re-renders, verify hooks are updating correctly, check for unnecessary re-renders
* **Browser DevTools Network Tab** - Verify WebSocket connection for Convex subscriptions, check image loading performance
* **Lighthouse** - Test performance, accessibility, and SEO scores for the product grid
* **Console Logging** - Add logs to track product additions: `console.log("Product added:", product.name, "at position:", product.position)`
* **Error Boundaries** - Implement error boundaries around ProductGrid to gracefully handle query failures
* **Manual Testing** - Test with slow network to verify loading states, test with multiple rapid additions to verify animation performance
* **Unit Tests** - Test ProductCard rendering with various prop combinations, test price formatting logic
* **Integration Tests** - Test session creation and product addition flow end-to-end
* **Visual Regression Tests** - Capture screenshots of product grid states to detect unintended UI changes

---

## Environment Variables

### Frontend (.env.local)
```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_***  # Public key for client-side auth

# Convex Real-time Database
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud  # WebSocket endpoint for queries
```

### Backend (Convex Dashboard)
```bash
# Clerk JWT Configuration (set in Convex dashboard, NOT .env.local)
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain.clerk.accounts.dev  # For token verification
```

---

## Success Metrics

* **Real-time Responsiveness** - Products appear in UI within 100ms of voice agent adding them to database
* **Smooth Animations** - Product cards animate in smoothly with staggered timing, no jank or layout shifts
* **Image Loading Performance** - Product images load progressively with proper skeletons, no CLS (Cumulative Layout Shift)
* **Session Isolation** - Products correctly filtered by session, no cross-contamination between shopping conversations
* **Proper Numbering** - Products numbered 1, 2, 3... in order of discovery, numbers remain stable as products appear
* **Error Handling** - Graceful fallbacks for failed image loads, network errors don't break the UI
* **Accessibility** - ARIA labels present, keyboard navigation works, screen readers can announce product additions
* **Mobile Responsiveness** - Grid adapts to mobile (1 column), tablet (2 columns), desktop (3 columns) layouts
* **Authentication Security** - Unauthorized users cannot view or add products, session ownership verified server-side
* **Query Performance** - Real-time queries execute in <50ms, database indexes properly utilized for session filtering
