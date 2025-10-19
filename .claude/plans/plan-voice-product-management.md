# Roadmap: Voice-Controlled Product Management (Voice-Only MVP)

## Context

**Tech Stack:** Next.js, Convex, Clerk, Gemini API

**Feature Description:** Save or remove products by speaking their numbers. Voice agent parses commands like "save product 3" or "remove 1 and 4" and updates the saved list in real-time.

**MVP Scope:**
- ✅ Save products via voice commands
- ✅ Remove products via voice commands
- ✅ Batch operations ("save 1, 3, and 5")
- ✅ View saved products at /saved route
- ❌ No manual save buttons (voice-only)
- ❌ No keyboard-based management

**Goals:**
- Parse voice commands for save/remove operations
- Update saved products list in real-time
- Provide voice confirmation feedback
- Support batch operations

## Implementation Steps

### 1. Manual Setup

Requires Gemini API key in Convex dashboard (already configured).

### 2. Dependencies

**Already Installed:**
```bash
@google/generative-ai
zod
```

### 3. Database Schema

```typescript
// convex/schema.ts
savedProducts: defineTable({
  userId: v.string(),
  productId: v.string(), // Reference to searchProducts
  productNumber: v.number(), // The number user referenced
  productName: v.string(),
  productDetails: v.optional(v.object({
    imageUrl: v.string(),
    price: v.number(),
    category: v.string(),
  })),
  savedAt: v.number(),
  lastModified: v.number(),
  savedVia: v.union(v.literal("voice"), v.literal("click")),
  voiceCommand: v.optional(v.string()),
})
.index("by_user", ["userId"])
.index("by_user_and_product", ["userId", "productId"]),

voiceCommands: defineTable({
  userId: v.string(),
  sessionId: v.string(),
  command: v.string(), // Raw voice input
  intent: v.union(
    v.literal("save_product"),
    v.literal("remove_product"),
    v.literal("save_multiple"),
    v.literal("remove_multiple"),
    v.literal("unknown")
  ),
  parameters: v.object({
    numbers: v.array(v.number()),
    action: v.union(v.literal("save"), v.literal("remove")),
  }),
  executedAt: v.number(),
  successful: v.boolean(),
  errorMessage: v.optional(v.string()),
})
.index("by_user", ["userId"])
.index("by_session", ["sessionId"])
.index("by_intent", ["intent"]),
```

### 4. Backend Functions

**Mutations:**

`convex/savedProducts.ts` - **saveProduct**
- Saves product by number
- Prevents duplicates
- Records voice command used

`convex/savedProducts.ts` - **removeProduct**
- Removes saved product by number
- Validates user ownership

`convex/savedProducts.ts` - **saveBatch**
- Saves multiple products at once
- Returns success/failure count

**Queries:**

`convex/savedProducts.ts` - **getSavedProducts**
- Returns all saved products for user
- Used by /saved route
- Ordered by savedAt DESC

**Actions:**

`convex/gemini.ts` - **parseVoiceCommand**
- Extracts intent and product numbers
- Handles various phrasings
- Returns structured command

`convex/voiceHandler.ts` - **processVoiceCommand**
- End-to-end handler for voice commands
- Calls appropriate mutations
- Returns voice-friendly confirmation

### 5. Frontend Integration

**Main Dashboard (`app/page.tsx`):**
- Products show save state visually
- No manual save buttons (voice-only)
- Real-time updates when products saved

**Saved Products Route (`app/saved/page.tsx`):**
- Simple list/grid of saved products
- Show product details
- Voice command to remove: "remove product 3 from saved"
- Link back to main dashboard

**Voice Command Examples:**
```
"save product 3"
"save number five"
"add item 2"
"save products 1, 3, and 5"
"remove product 4"
"delete items 2 and 6"
"remove all saved products"
```

### 6. MVP Scope

**Included:**
- ✅ Voice save/remove commands
- ✅ Batch operations
- ✅ /saved route for viewing
- ✅ Real-time updates
- ✅ Voice confirmation feedback

**Excluded (Not MVP):**
- ❌ Manual save buttons on product cards
- ❌ Drag-to-save UI
- ❌ Save to collections/folders
- ❌ Share saved list
- ❌ Export to email/SMS

### 7. User Flow

**Saving Products:**
1. User sees products 1-20 on dashboard
2. Says: "save products 2, 5, and 8"
3. Voice agent parses command
4. Products 2, 5, 8 visually marked as saved
5. Voice confirms: "Saved 3 products"

**Viewing Saved:**
1. User navigates to /saved
2. Sees all saved products
3. Can say: "remove product 3"
4. Product removed in real-time

### 8. Success Criteria

- [ ] Voice commands save products
- [ ] Multiple phrasings work
- [ ] Batch operations succeed
- [ ] /saved route displays list
- [ ] Real-time UI updates
- [ ] Voice confirmation clear

## Documentation Sources

1. Gemini Function Calling - https://ai.google.dev/gemini-api/docs/function-calling
2. Convex Mutations - https://docs.convex.dev/functions/mutations
