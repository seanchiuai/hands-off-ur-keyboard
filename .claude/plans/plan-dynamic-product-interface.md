# Roadmap: Dynamic Product Interface (Voice-Only MVP)

## Context

**Tech Stack:** Next.js, React, Convex, Framer Motion, Tailwind CSS

**Feature Description:** Real-time product grid on the main dashboard that displays numbered product cards as the voice agent finds results. Products appear with prominent numbers (1-20) for easy voice reference.

**MVP Scope:**
- ✅ Product grid on main dashboard
- ✅ Numbered cards (1-20) for voice commands
- ✅ Real-time updates as products arrive
- ✅ Smooth animations
- ❌ No separate product page (all on dashboard)
- ❌ No manual filtering UI (voice-only)

**Goals:**
- Display products in real-time as search completes
- Show prominent numbers for voice reference
- Provide smooth animations for product appearance
- Maintain responsive layout

## Implementation Steps

### 1. Manual Setup

No external setup required - uses existing Convex and Clerk.

### 2. Dependencies

**Already Installed:**
```bash
framer-motion
react-intersection-observer
clsx
tailwind-merge
```

### 3. Database Schema

Uses existing `searchProducts` table from product search plan.

### 4. Frontend Components

**Main Dashboard Layout (`app/page.tsx`):**
```
┌─────────────────────────────────────────┐
│  [Mic Button - Center]                  │
│  [Preference Tags - Top]                │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  Product Grid (3-4 columns)      │  │
│  │  [1] [2] [3] [4]                 │  │
│  │  [5] [6] [7] [8]                 │  │
│  │  ...                             │  │
│  └───────────────────────────────────┘  │
│                                         │
│  [Transcript Panel - Side/Bottom]       │
└─────────────────────────────────────────┘
```

**Components:**

`components/ProductGrid.tsx`
- Displays products from active search
- Real-time updates via `useQuery`
- Framer Motion animations
- Responsive grid (1-4 columns)

`components/ProductCard.tsx`
- Large number badge (top-left)
- Product image
- Title, price, rating
- Click to expand details inline
- Save button/icon

`components/ProductSkeleton.tsx`
- Loading placeholders
- Shimmer animation
- Matches ProductCard dimensions

### 5. User Experience

**Product Display:**
- Products appear one-by-one as found
- Smooth fade-in animation
- Numbers 1-20 prominently displayed
- Grid auto-adjusts to screen size

**Voice Interaction:**
- User: "Save product 3"
- Product 3 highlights and saves
- User: "Tell me more about number 5"
- Product 5 expands inline

**Empty State:**
- Show mic button with prompt
- "Click the mic and describe what you're looking for"

### 6. MVP Scope

**Included:**
- ✅ Product grid on main dashboard
- ✅ Numbered cards (1-20)
- ✅ Real-time updates
- ✅ Smooth animations
- ✅ Responsive design

**Excluded (Not MVP):**
- ❌ Separate product detail pages
- ❌ Manual filters/sort UI
- ❌ Pagination controls
- ❌ Product comparison view
- ❌ Grid/list view toggle

### 7. Implementation Details

**Real-time Updates:**
```typescript
// Main dashboard queries active search
const activeSession = useQuery(api.sessions.getActiveSession);
const products = useQuery(
  api.searchProducts.getCurrentSearchResults,
  activeSession ? { sessionId: activeSession._id } : "skip"
);
```

**Animation:**
```typescript
// Framer Motion stagger animation
<AnimatePresence>
  {products.map((product, index) => (
    <motion.div
      key={product._id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <ProductCard product={product} />
    </motion.div>
  ))}
</AnimatePresence>
```

### 8. Success Criteria

- [ ] Products appear in real-time
- [ ] Numbers prominently displayed
- [ ] Smooth animations
- [ ] Works on mobile/tablet/desktop
- [ ] Loading states clear

## Documentation Sources

1. Framer Motion - https://www.framer.com/motion/
2. Convex Reactive Queries - https://docs.convex.dev/client/react/useQuery
3. Tailwind Grid - https://tailwindcss.com/docs/grid-template-columns
