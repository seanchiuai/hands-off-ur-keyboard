---
name: agent-voice-shopping-assistant
description: Real-time voice AI agent for hands-free product search and shopping with preference management
model: inherit
color: purple
tech_stack:
  framework: Next.js
  database: Convex
  auth: Clerk
  provider: Gemini API, PipeCat, Daily, BrightData MCP
generated: 2025-10-17T23:56:00Z
documentation_sources: [
  "https://www.pipecat.ai/",
  "https://docs.daily.co/",
  "https://ai.google.dev/gemini-api/docs/function-calling",
  "https://ai.google.dev/gemini-api/docs/live-tools",
  "https://docs.brightdata.com/api-reference/MCP-Server",
  "https://docs.convex.dev/auth/clerk",
  "https://clerk.com/docs/integrations/databases/convex",
  "https://docs.convex.dev/client/react/nextjs/"
]
---

# Agent: Voice Shopping Assistant Implementation with PipeCat, Daily, and Gemini API

---

## Agent Overview

This agent enables a hands-free shopping experience where users interact with a real-time voice AI to search for products, compare options, and manage preferences without touching their keyboard. The system combines PipeCat's voice pipeline framework with Daily's WebRTC infrastructure for ultra-low latency voice communication, Gemini API with function calling and MCP support for intelligent product search via BrightData, and Convex for real-time state synchronization. Users speak their requirements, and the agent dynamically displays numbered product options with images, prices, and details while maintaining a preference list that persists user criteria like price ranges and product features.

**Tech Stack**: Next.js (frontend), Convex (real-time database), Clerk (authentication), PipeCat (voice framework), Daily (WebRTC), Gemini API (LLM with function calling), BrightData MCP (product search)

**Source**: PipeCat documentation, Daily API docs, Gemini API function calling guide, BrightData MCP server documentation, Convex + Clerk integration guides

---

## Critical Implementation Knowledge

### PipeCat & Daily Latest Updates 🚨

* PipeCat v0.0.67+ supports parallel processing pipelines with ultra-low latency STT→LLM→TTS flow
* Daily Python SDK provides event webhooks for user join/leave events critical for session management
* PipeCat's modular architecture allows swapping STT/TTS providers without rewriting core logic
* WebRTC peer-to-peer connections minimize latency but require signaling coordination via backend
* Daily rooms must be created programmatically via API before users can join voice sessions

### Gemini API & MCP Latest Updates 🚨

* Gemini 2.X models dramatically simplified function calling - pass Python functions with docstrings directly
* Built-in MCP support in Gemini SDK reduces boilerplate for external tool integration
* Live API with tool use enables real-time function calling during streaming voice conversations
* Thought signatures (encrypted reasoning state) can be passed between turns for multi-step conversations
* BrightData MCP provides 5,000 free product search requests/month, requires search keywords and domain URLs

### Common Pitfalls & Solutions 🚨

* **Pitfall**: Voice sessions hang when Daily room creation fails before user clicks microphone
  * **Solution**: Pre-create Daily rooms on page load or implement exponential backoff retry logic

* **Pitfall**: Product search queries fail silently when BrightData MCP lacks required parameters
  * **Solution**: Validate search keywords and domain URLs before invoking MCP tools; log all tool calls

* **Pitfall**: Race conditions when user speaks new queries before previous product results render
  * **Solution**: Use Convex reactive queries with optimistic updates and version timestamps

* **Pitfall**: Authentication tokens expire mid-session causing voice disconnects
  * **Solution**: Implement Clerk token refresh in Convex HTTP actions and reconnect WebRTC on auth errors

* **Pitfall**: Browser microphone permissions blocked prevent voice session initialization
  * **Solution**: Check `navigator.permissions` API before rendering microphone button; show clear prompts

### Best Practices 🚨

* **DO** use Convex mutations for atomic product save/remove operations with user ID + product number
* **DO** implement structured output from Gemini to parse product numbers and action intents from voice
* **DO** stream TTS responses incrementally while product search runs to maintain conversational flow
* **DO** validate all MCP tool responses and gracefully handle rate limits or API errors
* **DO** store user preferences as structured tags in Convex with creation timestamps for sorting
* **DON'T** block the voice pipeline waiting for slow product search - return acknowledgment first
* **DON'T** store sensitive payment data in Convex - use Clerk user metadata or separate PCI-compliant service
* **DON'T** rely solely on voice for critical actions - provide visual confirmation for saves/removes
* **DON'T** exceed BrightData's 5K free tier without implementing request tracking and user notifications

---

## Implementation Steps

The architecture consists of three layers: a Next.js frontend with a single-page dashboard, a PipeCat voice pipeline running in a backend service, and Convex functions for real-time state management. The voice flow is: user clicks microphone → Daily room created → PipeCat pipeline starts → user speaks → Gemini processes with function calling → BrightData MCP searches products → results saved to Convex → UI reactively updates. Preferences are extracted from conversation context and stored as tags.

### Backend Implementation

* **`convex/sessions.ts`** - Mutations and queries for managing voice session state (active/inactive), Daily room tokens, and session metadata
* **`convex/products.ts`** - Mutations for saving/removing products by number, queries for fetching user's product list with real-time subscriptions
* **`convex/preferences.ts`** - Mutations for adding/removing preference tags, queries for retrieving user preference list
* **`convex/http.ts`** - HTTP actions for creating Daily rooms via REST API, handling Clerk webhooks for user sync
* **`backend/voice_pipeline.py`** - PipeCat pipeline initialization with STT (e.g., Deepgram), Gemini LLM with function calling, TTS (e.g., ElevenLabs), Daily transport
* **`backend/tools.py`** - Python functions for product search (BrightData MCP), save product, remove product, add preference that Gemini can call

### Frontend Integration

* **`app/page.tsx`** - Main dashboard with microphone button, product grid, preference tag list
* **`components/MicrophoneButton.tsx`** - Button component that initializes Daily room, manages connection state, shows visual feedback
* **`components/ProductGrid.tsx`** - Dynamic grid displaying numbered products with images, prices, details from Convex query
* **`components/PreferenceList.tsx`** - Tag list component subscribing to Convex preferences query, displays formatted tags
* **`hooks/useVoiceSession.ts`** - Custom hook wrapping Daily client initialization, room joining, and cleanup on unmount
* **`hooks/useProducts.ts`** - Custom hook for Convex `useQuery` on products collection with real-time updates
* **`hooks/usePreferences.ts`** - Custom hook for Convex `useQuery` on preferences collection with real-time updates

---

## Code Patterns

### `convex/sessions.ts`

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create or update voice session with Daily room info
export const upsertSession = mutation({
  args: {
    userId: v.string(),
    roomUrl: v.string(),
    roomToken: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive")),
  },
  handler: async (ctx, args) => {
    // Check authentication via Clerk
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Find existing session for user
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        roomUrl: args.roomUrl,
        roomToken: args.roomToken,
        status: args.status,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("sessions", {
      userId: args.userId,
      roomUrl: args.roomUrl,
      roomToken: args.roomToken,
      status: args.status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Get active session for current user
export const getActiveSession = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});
```

This pattern demonstrates authenticated mutations with Clerk identity verification, upsert logic to prevent duplicate sessions, and real-time queries filtered by user and status.

### `convex/products.ts`

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Save product from voice command (e.g., "save product 3")
export const saveProduct = mutation({
  args: {
    productNumber: v.number(),
    name: v.string(),
    price: v.string(),
    imageUrl: v.string(),
    details: v.string(),
    sourceUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    // Check if product number already saved to prevent duplicates
    const existing = await ctx.db
      .query("products")
      .withIndex("by_user_and_number", (q) =>
        q.eq("userId", identity.subject).eq("productNumber", args.productNumber)
      )
      .first();

    if (existing) {
      return { success: false, message: `Product ${args.productNumber} already saved` };
    }

    await ctx.db.insert("products", {
      userId: identity.subject,
      productNumber: args.productNumber,
      name: args.name,
      price: args.price,
      imageUrl: args.imageUrl,
      details: args.details,
      sourceUrl: args.sourceUrl,
      createdAt: Date.now(),
    });

    return { success: true, message: `Product ${args.productNumber} saved` };
  },
});

// Remove product by number (e.g., "remove product 5")
export const removeProduct = mutation({
  args: { productNumber: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const product = await ctx.db
      .query("products")
      .withIndex("by_user_and_number", (q) =>
        q.eq("userId", identity.subject).eq("productNumber", args.productNumber)
      )
      .first();

    if (!product) {
      return { success: false, message: `Product ${args.productNumber} not found` };
    }

    await ctx.db.delete(product._id);
    return { success: true, message: `Product ${args.productNumber} removed` };
  },
});

// Get all products for current user
export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});
```

This demonstrates atomic save/remove operations with duplicate checking, query indexing by userId + productNumber for fast lookups, and real-time subscriptions via Convex queries.

### `backend/voice_pipeline.py`

```python
import os
import asyncio
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.elevenlabs import ElevenLabsTTSService
from pipecat.services.gemini import GeminiLLMService
from pipecat.transports.daily import DailyTransport
from pipecat.frames.frames import LLMFunctionCallFrame

# Tool functions that Gemini can call
async def search_products(keyword: str, max_results: int = 5):
    """Search for products using BrightData MCP.

    Args:
        keyword: Product search term (e.g., "wooden desk")
        max_results: Maximum number of results to return
    """
    # Call BrightData MCP server via Gemini SDK MCP integration
    # Returns list of products with name, price, imageUrl, details, sourceUrl
    pass

async def save_product(product_number: int, product_data: dict):
    """Save a product to user's list.

    Args:
        product_number: Number shown to user in UI
        product_data: Dict with name, price, imageUrl, details, sourceUrl
    """
    # Call Convex mutation via HTTP action
    pass

async def remove_product(product_number: int):
    """Remove a product from user's list.

    Args:
        product_number: Number of product to remove
    """
    # Call Convex mutation via HTTP action
    pass

async def add_preference(tag: str):
    """Add a preference tag to user's list.

    Args:
        tag: Preference like "wooden", "under $50", "3ft tall"
    """
    # Call Convex mutation via HTTP action
    pass

async def run_voice_pipeline(room_url: str, room_token: str, user_id: str):
    """Initialize and run the voice shopping assistant pipeline."""

    # Initialize transport with Daily room
    transport = DailyTransport(
        room_url=room_url,
        token=room_token,
        bot_name="Shopping Assistant",
    )

    # Initialize services
    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))

    tts = ElevenLabsTTSService(
        api_key=os.getenv("ELEVENLABS_API_KEY"),
        voice_id=os.getenv("ELEVENLABS_VOICE_ID"),
    )

    # Initialize Gemini with function calling tools
    llm = GeminiLLMService(
        api_key=os.getenv("GEMINI_API_KEY"),
        model="gemini-2.0-flash",
        tools=[search_products, save_product, remove_product, add_preference],
        system_instruction="""You are a helpful shopping assistant.
        Users will tell you what products they want to buy.
        Search for products, show them numbered options, and help them
        save items or update their preferences. Always acknowledge actions."""
    )

    # Create pipeline: STT → LLM → TTS
    pipeline = Pipeline([
        transport.input_processor(),
        stt,
        llm,
        tts,
        transport.output_processor(),
    ])

    # Run pipeline task
    task = PipelineTask(pipeline)

    await task.run()

# Entry point called from HTTP endpoint
def start_session(room_url: str, room_token: str, user_id: str):
    asyncio.run(run_voice_pipeline(room_url, room_token, user_id))
```

This shows PipeCat's pipeline architecture with Daily transport, function definitions that Gemini can invoke, and the complete STT→LLM→TTS flow with tool calling.

### `app/page.tsx`

```typescript
"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import MicrophoneButton from "@/components/MicrophoneButton";
import ProductGrid from "@/components/ProductGrid";
import PreferenceList from "@/components/PreferenceList";

export default function Dashboard() {
  const { user, isLoaded } = useUser();

  // Real-time subscriptions to Convex data
  const products = useQuery(api.products.listProducts);
  const preferences = useQuery(api.preferences.listPreferences);
  const activeSession = useQuery(api.sessions.getActiveSession);

  if (!isLoaded) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">
          Keep Your Hands Off Your Keyboard
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main voice interface */}
          <div className="lg:col-span-2">
            <MicrophoneButton
              userId={user.id}
              isActive={activeSession?.status === "active"}
            />

            {/* Dynamic product grid */}
            <ProductGrid products={products ?? []} />
          </div>

          {/* Sidebar with preferences */}
          <div>
            <PreferenceList preferences={preferences ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

This demonstrates the main dashboard with Clerk authentication, Convex real-time queries that auto-update when backend data changes, and the three key UI components.

### `components/MicrophoneButton.tsx`

```typescript
"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useVoiceSession } from "@/hooks/useVoiceSession";

interface Props {
  userId: string;
  isActive: boolean;
}

export default function MicrophoneButton({ userId, isActive }: Props) {
  const [isConnecting, setIsConnecting] = useState(false);
  const { startSession, endSession } = useVoiceSession();
  const createRoom = useMutation(api.http.createDailyRoom);
  const upsertSession = useMutation(api.sessions.upsertSession);

  const handleClick = async () => {
    if (isActive) {
      // End active session
      await endSession();
      await upsertSession({
        userId,
        roomUrl: "",
        roomToken: "",
        status: "inactive"
      });
      return;
    }

    try {
      setIsConnecting(true);

      // Create Daily room via Convex HTTP action
      const room = await createRoom({ userId });

      // Update session state
      await upsertSession({
        userId,
        roomUrl: room.url,
        roomToken: room.token,
        status: "active",
      });

      // Start Daily WebRTC connection and PipeCat pipeline
      await startSession(room.url, room.token, userId);

    } catch (error) {
      console.error("Failed to start session:", error);
      alert("Failed to start voice session. Please try again.");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
        isActive
          ? "bg-red-500 hover:bg-red-600 animate-pulse"
          : "bg-blue-500 hover:bg-blue-600"
      } disabled:opacity-50`}
    >
      {isConnecting ? (
        <span className="text-white text-sm">Connecting...</span>
      ) : isActive ? (
        <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" />
        </svg>
      ) : (
        <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
        </svg>
      )}
    </button>
  );
}
```

This demonstrates session lifecycle management with visual feedback, Daily room creation flow, and proper error handling with user-friendly messages.

---

## Testing & Debugging

* **PipeCat Pipeline Monitoring**: Enable debug logging in pipeline config to trace STT→LLM→TTS frame flow; check for dropped frames or latency spikes
* **Daily Dashboard**: Use https://dashboard.daily.co to monitor room creation, participant connections, WebRTC quality metrics, and bandwidth usage
* **Gemini Function Call Logs**: Log all function invocations with timestamps, arguments, and return values to debug MCP tool failures
* **BrightData Request Tracking**: Monitor MCP server logs for rate limits, invalid parameters, or API errors; track monthly request quota usage
* **Convex Dashboard**: Use Convex dashboard's real-time function logs to debug mutations, queries, and authentication errors
* **Unit Tests**: Write Vitest tests for Convex functions with mock authentication context; test edge cases like duplicate saves, invalid product numbers
* **Integration Tests**: Use Playwright to automate microphone button clicks, mock MediaStream APIs, verify product grid updates after simulated voice commands
* **Voice Flow Testing**: Manually test with phrases like "find wooden desks under $200", "save product 2", "show me cheaper options", "remove product 5"
* **Error Boundary**: Wrap components in React error boundaries to catch and display WebRTC connection failures or Convex query errors gracefully

---

## Environment Variables

### Frontend (Next.js)

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Convex Backend
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

### Backend (Python Voice Pipeline)

```bash
# Speech Services
DEEPGRAM_API_KEY=...        # Speech-to-text
ELEVENLABS_API_KEY=...      # Text-to-speech
ELEVENLABS_VOICE_ID=...     # Voice ID for TTS

# LLM & Product Search
GEMINI_API_KEY=...          # Gemini API for function calling
BRIGHTDATA_API_KEY=...      # BrightData MCP server

# WebRTC Infrastructure
DAILY_API_KEY=...           # Daily.co room creation
```

### Convex Environment

```bash
# Convex Dashboard → Settings → Environment Variables
CLERK_WEBHOOK_SECRET=whsec_...  # For Clerk user sync
DAILY_API_KEY=...               # For creating rooms from Convex
```

---

## Success Metrics

* **Real-time Responsiveness**: Voice round-trip latency (user speech → agent response) under 2 seconds for 95th percentile
* **Accurate User Understanding**: Gemini correctly extracts product numbers and actions (save/remove) with >90% accuracy in voice transcripts
* **Multi-turn Conversations**: Users successfully complete 3+ turn conversations (search → refine → save) without disconnects
* **Product Search Quality**: BrightData MCP returns relevant products with images and prices for >85% of search queries
* **Data Persistence**: All saved products and preferences sync to Convex within 500ms and persist across sessions
* **Authentication Security**: Zero unauthorized access to other users' products or preferences; Clerk JWT validation on every mutation
* **Browser Compatibility**: Voice sessions work on Chrome, Safari, Firefox with proper microphone permission handling
* **Error Recovery**: Users can reconnect after network failures or page refreshes without losing session context
* **Preference Extraction**: Voice agent correctly identifies and saves preference tags (price ranges, materials, dimensions) in >75% of conversations
* **BrightData Quota Management**: Application stays within 5K free requests/month or gracefully notifies users when approaching limits

