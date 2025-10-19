# MVP Architecture - Voice-Only Shopping

## Overview

**Hands Off Ur Keyboard** is a voice-only shopping platform. Users shop completely hands-free - no typing required.

## Core Principle

**🎤 Voice-Only = No Keyboard Required**

Every interaction happens through voice:
- Search for products → Say "find wireless headphones under $100"
- Save products → Say "save product 3"
- Remove products → Say "remove product 5"
- Refine search → Say "find cheaper options"

## Route Structure

The application has **only 2 routes** for maximum simplicity:

### 1. `/` - Main Voice Shopping Dashboard

**Purpose:** Single-page voice shopping experience

**Components:**
- **Microphone Button** - Large, prominent, center of screen
- **Preference Tags** - Auto-extracted from voice (e.g., "under $200", "wooden")
- **Product Grid** - Real-time numbered products (1-20)
- **Transcript Panel** - Live conversation with AI

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Header [Hands Off Ur Keyboard]    [Saved Products →]  │
├─────────────────────────────────────────────────────────┤
│                                                    ┌────┐
│  ┌──────────────────────┐                         │    │
│  │ Preferences:         │                         │ T  │
│  │ [wooden] [under $200]│                         │ r  │
│  └──────────────────────┘                         │ a  │
│                                                    │ n  │
│  ┌──────────────────────────────────────────┐     │ s  │
│  │                                          │     │ c  │
│  │          [🎤 Mic Button]                 │     │ r  │
│  │   "Click and describe what you want"     │     │ i  │
│  │                                          │     │ p  │
│  └──────────────────────────────────────────┘     │ t  │
│                                                    │    │
│  ┌──────────────────────────────────────────┐     │ P  │
│  │  Products                                │     │ a  │
│  │                                          │     │ n  │
│  │  [1] [2] [3] [4]                         │     │ e  │
│  │  [5] [6] [7] [8]                         │     │ l  │
│  │  ...                                     │     │    │
│  └──────────────────────────────────────────┘     └────┘
└─────────────────────────────────────────────────────────┘
```

**User Flow:**
1. Click microphone button
2. Say: "Find wooden desk under $200"
3. Tags appear: [wooden] [under $200]
4. Products appear numbered 1-20
5. Say: "Save product 3"
6. Say: "Find cheaper options" (triggers refinement)

### 2. `/saved` - Saved Products

**Purpose:** View and manage saved products via voice

**Features:**
- List/grid of all saved products
- Voice command to remove: "remove product 3"
- Link back to main dashboard
- Show how product was saved (voice command)

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  [← Back]  Saved Products (12 items)          [Icon]    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  💬 Tip: Say "remove product 3" to remove items         │
│                                                          │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐        │
│  │   1    │  │   2    │  │   3    │  │   4    │        │
│  │  Img   │  │  Img   │  │  Img   │  │  Img   │        │
│  │ Title  │  │ Title  │  │ Title  │  │ Title  │        │
│  │ Price  │  │ Price  │  │ Price  │  │ Price  │        │
│  └────────┘  └────────┘  └────────┘  └────────┘        │
│  ...                                                     │
└─────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **Tailwind CSS 4** - Styling
- **Framer Motion** - Smooth animations for product appearance
- **Clerk** - Authentication

### Backend
- **Convex** - Real-time database with live queries
- **Gemini API** - AI for voice command parsing and preference extraction
- **Daily.co** - WebRTC for real-time voice streaming
- **PipeCat** - Voice agent framework (separate server)
- **BrightData MCP** - Product search (optional, falls back to mock data)

## Core Features

### 1. Voice-Triggered Product Search

**How it works:**
1. User clicks mic → Daily.co room created
2. User speaks → PipeCat agent transcribes
3. Gemini analyzes transcript → Detects search intent
4. Gemini extracts parameters → `{category: "headphones", priceMax: 100}`
5. BrightData searches → Returns real products
6. Products saved to Convex → Appear in real-time
7. Products numbered 1-20 → User can reference by number

**Voice Examples:**
- "Find wireless headphones under $100"
- "Wooden desk at least 3 feet wide"
- "Red shoes size 10"
- "Laptop with SSD and at least 16GB RAM"

### 2. Dynamic Product Interface

**How it works:**
- Products appear in real-time as search completes
- Each product has large number (1-20) for voice reference
- Smooth fade-in animation (Framer Motion)
- Responsive grid (1-4 columns)

**Visual Design:**
- Prominent number badge (top-left)
- Product image
- Title, price, rating
- Saved state indicator

### 3. Voice-Controlled Product Management

**How it works:**
1. User says: "Save product 3"
2. Gemini parses command → `{intent: "save_product", numbers: [3]}`
3. Convex mutation → Saves product to `savedProducts` table
4. UI updates in real-time → Product shows saved state
5. Voice confirms: "Saved product 3"

**Voice Commands Supported:**
- "save product 3"
- "save number five"
- "add item 2"
- "save products 1, 3, and 5" (batch)
- "remove product 4"
- "delete items 2 and 6" (batch)

### 4. User Preference Management

**How it works:**
1. User says: "Find wooden desk under $200"
2. Gemini extracts preferences:
   ```javascript
   [
     {tag: "wooden", category: "material", value: "wood"},
     {tag: "under $200", category: "price", value: 200}
   ]
   ```
3. Preferences saved to Convex
4. Tags displayed on dashboard: [wooden] [under $200]
5. Click X to remove tags

**Refinement:**
1. User says: "Find cheaper options"
2. Gemini detects refinement → `{type: "cheaper", percentage: 20%}`
3. New search triggered → Price reduced to $160
4. Tag updates: [under $160]
5. Products refresh

## Database Schema Summary

```typescript
// Key tables
voiceSessions     - Active voice conversations
voiceTranscripts  - Conversation history
productSearches   - Search queries and parameters
searchProducts    - Products found (numbered 1-20)
savedProducts     - User's saved products
userPreferences   - Extracted preference tags
searchRefinements - Search modification history
voiceCommands     - Voice command logs
```

## What's NOT in MVP

**Removed for Simplicity:**
- ❌ `/search` page - No manual search forms
- ❌ `/voice` page - Consolidated into main dashboard
- ❌ `/voice-demo` page - Not needed for MVP
- ❌ `/shop` page - Renamed to `/` (main dashboard)
- ❌ Keyboard-based search - Voice-only
- ❌ Manual save buttons - Voice-only
- ❌ Filter/sort UI - Voice-only refinement
- ❌ Product detail pages - Inline expansion only
- ❌ Collections/folders - Simple saved list only
- ❌ Share/export - Not MVP
- ❌ Advanced settings - Keep it simple

## User Journey

### First-Time User

1. **Land on page** → See landing page with sign-in
2. **Sign in** → Redirected to main dashboard
3. **See mic button** → Large, prominent, inviting
4. **Click mic** → Grant microphone permission
5. **Speak** → "Find wireless headphones under $100"
6. **See tags** → [wireless] [under $100]
7. **See products** → Numbered 1-20, appearing in real-time
8. **Save** → Say "save product 3"
9. **View saved** → Click "Saved Products" button → See /saved page

### Returning User

1. **Land on page** → Authenticated, see dashboard
2. **See preferences** → Tags from previous searches
3. **Continue shopping** → Refinements apply to new searches
4. **Quick save** → Say "save 2, 5, and 8"

## Performance Targets

- **Voice latency:** <300ms round-trip
- **Search latency:** <5s for 20 products
- **Product appearance:** Real-time streaming (as found)
- **Cache hit rate:** >30% for repeat searches
- **UI responsiveness:** 60fps animations

## Error Handling

**Microphone Issues:**
- Permission denied → Clear instructions with visuals
- Not available → Show error message

**Voice Recognition:**
- Low confidence → Ask for clarification
- Unknown command → "I didn't understand. Try saying..."
- Multiple intents → "Did you mean...?"

**Search Errors:**
- BrightData down → Fall back to mock data
- Gemini API error → Use basic keyword extraction
- No results → Voice feedback + suggestions

**Network Issues:**
- Daily.co disconnected → Reconnection UI
- Convex offline → Cached data + sync when back

## Development Workflow

### Setup
```bash
# Install dependencies
npm install

# Add API keys to .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=xxx
NEXT_PUBLIC_GEMINI_API_KEY=xxx
NEXT_PUBLIC_DAILY_API_KEY=xxx

# Add to Convex Dashboard
GEMINI_API_KEY=xxx
DAILY_API_KEY=xxx
BRIGHTDATA_API_KEY=xxx (optional)

# Start dev server
npm run dev
```

### Testing Flow
1. Open http://localhost:3000
2. Sign in
3. Click mic → grant permission
4. Say: "Find wooden desk under $200"
5. Verify: Tags appear, products appear numbered
6. Say: "Save product 3"
7. Verify: Product marked as saved
8. Navigate to /saved
9. Verify: Product appears in saved list

## Deployment

### Vercel (Frontend + Next.js)
```bash
npm run build
# Deploy to Vercel
```

### Convex (Backend)
```bash
npx convex deploy
# Add production environment variables
```

### PipeCat (Voice Agent)
- Deploy to separate server (Railway, Render, VPS)
- Cannot run on Vercel (WebSocket requirements)
- Requires Python 3.10+ and FFmpeg

## Success Metrics

**MVP Launch Criteria:**
- [x] Main dashboard with voice button
- [x] Real-time voice conversation works
- [x] Products appear numbered 1-20
- [x] Save via voice commands works
- [x] Preference tags auto-extract
- [x] /saved page displays saved items
- [ ] Convex environment variables configured
- [ ] Daily.co integration working
- [ ] PipeCat agent deployed

**Post-Launch:**
- Voice command accuracy >90%
- Average session duration >3 minutes
- Products saved per session >2
- User retention >50% week 1

---

**Last Updated:** October 19, 2025
**Version:** MVP 1.0
**Status:** Ready for API configuration and testing
