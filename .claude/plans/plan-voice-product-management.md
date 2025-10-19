# Roadmap: Voice-Controlled Product Management

## Context

**Tech Stack:** Next.js, Convex, Clerk, Gemini API, PipeCat

**Feature Description:** Ability for users to save or remove specific products by referencing their numbers through voice commands to the agent.

**Goals:**
- Parse voice commands like "save product 3" or "remove 1 and 4"
- Update saved products list in real-time
- Provide voice confirmation feedback to user
- Support batch operations ("save 1, 3, and 5")

## Implementation Steps

Each step is mandatory for shipping Voice-Controlled Product Management.

### 1. Manual Setup (User Required)

- [ ] Ensure Gemini API is configured (from voice agent setup)
- [ ] Enable function calling in Gemini API project
- [ ] No additional accounts required (uses existing stack)
- [ ] Verify PipeCat agent can call Convex mutations (requires Convex HTTP endpoint)

### 2. Dependencies & Environment

**NPM Packages:**
```bash
npm install zod # for voice command schema validation
```

**Python Dependencies (for PipeCat agent):**
```bash
pip install pipecat-ai google-generativeai
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
```

PipeCat Agent Server:
```bash
GEMINI_API_KEY=your_gemini_api_key
CONVEX_DEPLOYMENT_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=your_convex_deploy_key
```

### 3. Database Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  savedProducts: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
    savedAt: v.number(),
    savedVia: v.union(v.literal("voice"), v.literal("click")),
    voiceCommand: v.optional(v.string()), // Original command if saved via voice
  })
    .index("by_user", ["userId"])
    .index("by_product", ["productId"])
    .index("by_user_product", ["userId", "productId"]),

  voiceCommands: defineTable({
    userId: v.id("users"),
    sessionId: v.id("voiceSessions"),
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
});
```

### 4. Backend Functions

**Mutations:**

`convex/savedProducts.ts` - **saveProduct**
- **Purpose:** Save a product by its display number
- **Args:** `{ userId: Id<"users">, searchId: Id<"productSearches">, productNumber: number, savedVia: "voice" | "click", voiceCommand?: string }`
- **Returns:** `{ success: boolean, productId: Id<"savedProducts"> }`
- **Notes:** Looks up product by number, creates savedProducts entry, prevents duplicates

`convex/savedProducts.ts` - **removeProduct**
- **Purpose:** Remove a saved product by its display number
- **Args:** `{ userId: Id<"users">, searchId: Id<"productSearches">, productNumber: number }`
- **Returns:** `{ success: boolean }`
- **Notes:** Finds product by number, deletes savedProducts entry

`convex/savedProducts.ts` - **saveBatch**
- **Purpose:** Save multiple products at once
- **Args:** `{ userId: Id<"users">, searchId: Id<"productSearches">, productNumbers: number[], voiceCommand?: string }`
- **Returns:** `{ successCount: number, failedNumbers: number[] }`
- **Notes:** Processes array of numbers, returns partial success status

`convex/savedProducts.ts` - **removeBatch**
- **Purpose:** Remove multiple saved products at once
- **Args:** `{ userId: Id<"users">, searchId: Id<"productSearches">, productNumbers: number[] }`
- **Returns:** `{ successCount: number, failedNumbers: number[] }`
- **Notes:** Processes array of numbers, continues on individual failures

`convex/voiceCommands.ts` - **recordCommand**
- **Purpose:** Log voice command for analytics
- **Args:** `{ userId: Id<"users">, sessionId: Id<"voiceSessions">, command: string, intent: string, parameters: any, successful: boolean }`
- **Returns:** `Id<"voiceCommands">`
- **Notes:** Tracks accuracy of command parsing

**Queries:**

`convex/savedProducts.ts` - **getSavedProducts**
- **Purpose:** Get all saved products for user
- **Args:** `{ userId: Id<"users"> }`
- **Returns:** `Array<SavedProduct & { product: Product }>`
- **Notes:** Joins with products table to include full product data

`convex/savedProducts.ts` - **isProductSaved**
- **Purpose:** Check if specific product is saved
- **Args:** `{ userId: Id<"users">, productId: Id<"products"> }`
- **Returns:** `boolean`
- **Notes:** Used to show saved state in UI

**Actions:**

`convex/gemini.ts` - **parseVoiceCommand**
- **Purpose:** Use Gemini function calling to extract intent and parameters
- **Args:** `{ command: string }`
- **Returns:** `{ intent: string, parameters: { numbers: number[], action: "save" | "remove" } }`
- **Notes:** Uses Gemini 1.5 Flash with function declaration for command parsing

`convex/voiceHandler.ts` - **processVoiceCommand**
- **Purpose:** End-to-end handler: parse command → execute mutation → return confirmation
- **Args:** `{ userId: Id<"users">, sessionId: Id<"voiceSessions">, searchId: Id<"productSearches">, command: string }`
- **Returns:** `{ success: boolean, message: string, affectedProducts: number[] }`
- **Notes:** Called by PipeCat agent, returns voice-friendly confirmation message

### 5. Frontend

**Components:**

`components/SavedProductsList.tsx` - Sidebar list of saved products
- Uses `useQuery(api.savedProducts.getSavedProducts)`
- Displays mini product cards with remove button
- Shows count badge ("3 saved")
- Props: `{ userId: Id<"users"> }`

`components/ProductCard.tsx` - Enhanced with save button
- Add "Save" button overlay (or heart icon)
- Toggle saved state visually (filled vs outline icon)
- Shows "Saved via voice" badge if `savedVia === "voice"`
- Props: `{ product: Product, isSaved: boolean, onSave: () => void }`

`components/VoiceCommandFeedback.tsx` - Confirmation toast
- Displays when voice command succeeds ("Saved product 3")
- Shows error message if command fails
- Auto-dismisses after 3 seconds
- Props: `{ message: string, type: "success" | "error" }`

**Hooks:**

`hooks/useVoiceProductCommands.ts` - Voice command processing
- Wraps `useAction(api.voiceHandler.processVoiceCommand)`
- Subscribes to PipeCat agent command events via WebSocket
- Returns `{ processCommand, isProcessing, lastResult }`

`hooks/useSavedProducts.ts` - Saved products management
- Wraps `useQuery(api.savedProducts.getSavedProducts)`
- Wraps `useMutation(api.savedProducts.saveProduct)` and `removeProduct`
- Returns `{ savedProducts, saveProduct, removeProduct, isSaved }`

### 6. Error Prevention

**API Error Handling:**
- Catch Gemini API errors in `parseVoiceCommand` and return `intent: "unknown"`
- Handle product not found errors gracefully ("Product 99 not found")
- Retry failed mutations once before returning error
- Return user-friendly voice messages ("Sorry, I couldn't find product 3")

**Schema Validation:**
- Use Zod to validate parsed command parameters
- Ensure product numbers are positive integers
- Validate numbers array is not empty
- Check action is either "save" or "remove"

**Authentication/Authorization:**
- Verify userId matches authenticated user in all mutations
- Validate user owns the voice session
- Check user has access to the search results

**Type Safety:**
- Define strict TypeScript interfaces for voice command results
- Type Gemini function calling schemas
- Use Convex-generated types for all database operations

**Rate Limiting:**
- Limit voice commands to 10 per minute per user
- Throttle Gemini API calls (max 60 requests/min)
- Prevent duplicate save operations within 1 second

**Boundaries/Quotas:**
- Max batch size: 10 products per command
- Validate product numbers are within search result range (1-20)
- Gemini API: 60 requests/min for command parsing

### 7. Testing

**Unit Tests:**
- [ ] Test `saveProduct` mutation prevents duplicates
- [ ] Test `saveBatch` returns partial success correctly
- [ ] Test `parseVoiceCommand` with various phrasings ("save 3", "save product number three")
- [ ] Test number extraction ("save 1, 3, and 5" → [1, 3, 5])
- [ ] Test invalid commands return `intent: "unknown"`

**Integration Tests:**
- [ ] End-to-end: voice command → Gemini parse → mutation → confirmation message
- [ ] Test batch save: "save 1, 2, 3" saves all three products
- [ ] Test remove after save: product disappears from saved list
- [ ] Verify real-time update in sidebar when product is saved

**E2E Tests (Playwright):**
- [ ] User says "save product 3" → product 3 shows saved icon
- [ ] User says "remove 1 and 2" → products 1 and 2 removed from saved list
- [ ] Invalid command → error message appears
- [ ] Saved products persist across page refresh

**Performance Tests:**
- [ ] Measure command processing latency (target: <2s from voice to confirmation)
- [ ] Test batch operations (10 products) complete quickly
- [ ] Monitor Gemini API response time (target: <1s)

**Accuracy Tests:**
- [ ] Test voice command recognition accuracy with various phrasings
- [ ] Measure intent classification accuracy (target: >95%)
- [ ] Test with background noise and accents
- [ ] Verify number extraction accuracy (target: >98%)

## Documentation Sources

1. Gemini Function Calling - https://ai.google.dev/gemini-api/docs/function-calling
2. Convex Mutations - https://docs.convex.dev/functions/mutations
3. PipeCat Event Handling - https://docs.pipecat.ai/guide/events
4. Zod Schema Validation - https://zod.dev/
5. Voice Command Design Patterns - https://www.nngroup.com/articles/voice-commands/
