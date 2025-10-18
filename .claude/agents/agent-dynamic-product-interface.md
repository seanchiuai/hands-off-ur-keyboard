---
name: agent-dynamic-product-interface
description: Dynamic product interface that displays numbered products in real-time with images, prices, and details
model: inherit
color: green
tech_stack:
  framework: Next.js + React
  database: Convex
  auth: Clerk
  provider: Convex Real-time
generated: 2025-10-18T00:00:00Z
documentation_sources: [
  "https://docs.convex.dev/client/react",
  "https://nextjs.org/docs",
  "https://react.dev/reference/react",
  "https://www.framer.com/motion"
]
---

# Agent: Dynamic Product Interface Implementation with Convex Real-time

## Agent Overview

This agent renders the dynamic product display interface that updates in real-time as the LLM backend agent discovers products. It subscribes to Convex queries for product updates, displays numbered product cards with images, prices, and details, handles user voice commands to save/remove products by number, and provides smooth animations for product additions and removals. The interface is fully reactive and synchronized across all connected clients.

**Tech Stack**: Next.js, React, Convex React hooks, Framer Motion (animations), TailwindCSS, TypeScript

**Source**: Convex React documentation, Next.js documentation, Framer Motion

## Critical Implementation Knowledge

### Convex React Latest Updates 🚨

* `useQuery` hook provides real-time subscriptions to Convex queries
* `useMutation` hook enables optimistic updates for instant UI feedback
* Queries automatically re-render components when database changes occur
* ConvexProvider must wrap application to enable React hooks
* Loading states handled via undefined return from useQuery
* Subscriptions are automatically cleaned up on component unmount

### Common Pitfalls & Solutions 🚨

* **Pitfall**: Product list not updating in real-time when new products added
  * **Solution**: Use `useQuery` with proper query parameters, ensure ConvexProvider is configured correctly

* **Pitfall**: Images load slowly causing layout shift
  * **Solution**: Use Next.js Image component with priority loading and fixed dimensions

* **Pitfall**: Product numbering inconsistent when products removed
  * **Solution**: Assign stable IDs on insertion, use _id for keys, display sequential numbers in UI only

* **Pitfall**: Animation jank when products rapidly added
  * **Solution**: Use Framer Motion's layoutId for smooth transitions and AnimatePresence for exit animations

* **Pitfall**: Optimistic updates causing flickering on mutation
  * **Solution**: Implement proper optimistic update with rollback in useMutation options

### Best Practices 🚨

* Use Convex `useQuery` for all real-time product data subscriptions
* Implement virtualization for product lists exceeding 50 items
* Use stable keys (_id) for list rendering to prevent re-renders
* Prefetch product images to reduce loading states
* Implement skeleton loaders for initial product loading
* Use Framer Motion's layout animations for smooth product transitions
* Handle edge cases: no products, loading states, error states
* Optimize re-renders with React.memo for product cards

## Implementation Steps

The architecture consists of React components that subscribe to Convex real-time queries and render products with animations and interactions.

### Backend Implementation

* `convex/schema.ts` - Defines product and session data schema
* `convex/products.ts` - Product queries and mutations (from LLM agent)
* Convex automatically handles real-time subscriptions and updates

### Frontend Integration

* `components/ProductGrid.tsx` - Main product display grid with real-time updates
* `components/ProductCard.tsx` - Individual product card component
* `components/ProductSkeleton.tsx` - Loading skeleton for products
* `hooks/useProductActions.ts` - Hook for save/remove product actions
* `app/dashboard/page.tsx` - Main dashboard integrating all components

## Code Patterns

### `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products: defineTable({
    sessionId: v.string(),
    userId: v.string(),
    name: v.string(),
    price: v.number(),
    imageUrl: v.string(),
    details: v.string(),
    url: v.string(),
    saved: v.optional(v.boolean()),
    savedAt: v.optional(v.number()),
    createdAt: v.number()
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  preferences: defineTable({
    userId: v.string(),
    preference: v.string(),
    category: v.string(),
    createdAt: v.number()
  })
    .index("by_user", ["userId"]),

  messages: defineTable({
    sessionId: v.string(),
    userId: v.string(),
    role: v.string(),
    content: v.string(),
    timestamp: v.number(),
    metadata: v.optional(v.any())
  })
    .index("by_session", ["sessionId"])
});
```

This schema defines the database structure for products, preferences, and messages with proper indexing for efficient queries.

### `components/ProductCard.tsx`

```typescript
'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Check, X } from 'lucide-react';
import { Doc } from '@/convex/_generated/dataModel';

interface ProductCardProps {
  product: Doc<'products'>;
  number: number;
  onSave: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ProductCard({ product, number, onSave, onRemove }: ProductCardProps) {
  return (
    <motion.div
      layoutId={product._id}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      transition={{ duration: 0.3 }}
      className="relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow"
    >
      {/* Product Number Badge */}
      <div className="absolute top-2 left-2 z-10 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
        {number}
      </div>

      {/* Saved Indicator */}
      {product.saved && (
        <div className="absolute top-2 right-2 z-10 bg-green-500 text-white rounded-full p-1">
          <Check className="w-4 h-4" />
        </div>
      )}

      {/* Product Image */}
      <div className="relative w-full h-48 bg-gray-200">
        <Image
          src={product.imageUrl || '/placeholder-product.png'}
          alt={product.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={number <= 3}
        />
      </div>

      {/* Product Details */}
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
          {product.name}
        </h3>

        <p className="text-2xl font-bold text-blue-600 mb-2">
          ${product.price.toFixed(2)}
        </p>

        <p className="text-sm text-gray-600 line-clamp-3 mb-4">
          {product.details}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!product.saved ? (
            <button
              onClick={() => onSave(product._id)}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Save
            </button>
          ) : (
            <button
              onClick={() => onRemove(product._id)}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Remove
            </button>
          )}

          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg transition-colors text-center"
          >
            View
          </a>
        </div>
      </div>
    </motion.div>
  );
}
```

This component renders an individual product card with animations, image, price, details, and action buttons.

### `components/ProductGrid.tsx`

```typescript
'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { AnimatePresence, motion } from 'framer-motion';
import { ProductCard } from './ProductCard';
import { ProductSkeleton } from './ProductSkeleton';
import { useProductActions } from '@/hooks/useProductActions';

interface ProductGridProps {
  sessionId: string;
}

export function ProductGrid({ sessionId }: ProductGridProps) {
  const products = useQuery(api.products.listForSession, { sessionId });
  const { saveProduct, removeProduct } = useProductActions();

  // Loading state
  if (products === undefined) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <p className="text-xl mb-2">No products yet</p>
          <p className="text-sm">
            Use the microphone to tell me what you're looking for!
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      layout
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      <AnimatePresence mode="popLayout">
        {products.map((product, index) => (
          <ProductCard
            key={product._id}
            product={product}
            number={index + 1}
            onSave={saveProduct}
            onRemove={removeProduct}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
```

This component displays the product grid with real-time updates from Convex, handling loading and empty states.

### `components/ProductSkeleton.tsx`

```typescript
'use client';

export function ProductSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="w-full h-48 bg-gray-300" />

      {/* Content skeleton */}
      <div className="p-4">
        <div className="h-6 bg-gray-300 rounded mb-2" />
        <div className="h-8 bg-gray-300 rounded w-1/2 mb-2" />
        <div className="h-4 bg-gray-300 rounded mb-1" />
        <div className="h-4 bg-gray-300 rounded mb-1" />
        <div className="h-4 bg-gray-300 rounded w-3/4 mb-4" />

        {/* Button skeletons */}
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-gray-300 rounded-lg" />
          <div className="flex-1 h-10 bg-gray-300 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
```

This component provides a loading skeleton for products while data is being fetched.

### `hooks/useProductActions.ts`

```typescript
'use client';

import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useCallback } from 'react';
import { Id } from '@/convex/_generated/dataModel';

export function useProductActions() {
  const saveMutation = useMutation(api.products.save);
  const removeMutation = useMutation(api.products.remove);

  const saveProduct = useCallback((productId: Id<'products'>) => {
    saveMutation(
      { productId },
      {
        optimisticUpdate: (localStore, args) => {
          // Optimistically update the product to show saved state
          const existingProduct = localStore.getQuery(api.products.listForSession, {
            sessionId: 'current' // This should be the actual session ID
          });

          if (existingProduct) {
            const updated = existingProduct.map(p =>
              p._id === args.productId ? { ...p, saved: true } : p
            );
            localStore.setQuery(api.products.listForSession, {}, updated);
          }
        }
      }
    );
  }, [saveMutation]);

  const removeProduct = useCallback((productId: Id<'products'>) => {
    removeMutation({ productId });
  }, [removeMutation]);

  return {
    saveProduct,
    removeProduct
  };
}
```

This hook provides product action handlers with optimistic updates for instant UI feedback.

### `app/dashboard/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { VoiceButton } from '@/components/VoiceButton';
import { ProductGrid } from '@/components/ProductGrid';
import { PreferenceList } from '@/components/PreferenceList';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function DashboardContent() {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    // Generate session ID on mount
    setSessionId(`session_${Date.now()}`);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Keep Your Hands Off Your Keyboard
          </h1>
          <p className="text-gray-600">
            Voice-powered product shopping assistant
          </p>
        </header>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            {/* Voice Button */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6 flex justify-center">
              <VoiceButton />
            </div>

            {/* Preference List */}
            <PreferenceList />
          </aside>

          {/* Product Grid */}
          <main className="lg:col-span-3">
            {sessionId && <ProductGrid sessionId={sessionId} />}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <DashboardContent />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

This page integrates all components into the main dashboard layout with real-time updates.

### `components/PreferenceList.tsx`

```typescript
'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function PreferenceList() {
  const preferences = useQuery(api.preferences.list);
  const removePreference = useMutation(api.preferences.remove);

  if (preferences === undefined) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Preferences</h2>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-lg font-semibold mb-4">Preferences</h2>

      {preferences.length === 0 ? (
        <p className="text-sm text-gray-500">
          No preferences saved yet
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {preferences.map((pref) => (
              <motion.div
                key={pref._id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center gap-2"
              >
                <span>{pref.preference}</span>
                <button
                  onClick={() => removePreference({ id: pref._id })}
                  className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
```

This component displays the preference list as tags with real-time updates and removal functionality.

## Testing & Debugging

* Use Convex dashboard to monitor real-time query subscriptions
* Test product additions by manually inserting via Convex dashboard
* Verify animations by rapidly adding/removing products
* Test loading states by throttling network in DevTools
* Validate optimistic updates by checking UI before mutation completes
* Test error boundaries for query failures
* Verify image loading with various image URLs and broken links
* Use React DevTools to inspect component re-renders and optimize

## Environment Variables

### Frontend (Next.js)
```bash
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

## Success Metrics

* Products appear in UI within 500ms of Convex insertion
* Product grid supports 50+ products without performance degradation
* Animations run at 60fps without jank or stuttering
* Optimistic updates provide instant feedback for save/remove actions
* Image loading completes within 2 seconds for priority products
* Real-time updates sync across multiple browser tabs instantly
* No visible layout shift when products are added or removed
* Loading skeletons accurately represent final product card layout
* Preference tags update in real-time when added via voice
