# Roadmap: Real-Time Voice Agent

## Context

**Tech Stack**: Next.js (App Router), PipeCat (Python), Daily.co (WebRTC), Gemini Live API, Convex (Backend)

**Feature Description**: Enable users to interact with the AI shopping assistant through real-time voice conversations, with support for natural interruptions and streaming audio.

**Goals**:
- Sub-second latency voice interactions
- Natural conversation flow with interruption handling
- Seamless integration with product search capabilities
- Client-side microphone controls with server-side AI processing

## Implementation Steps

Each step is mandatory for shipping the Real-Time Voice Agent feature.

### 1. Manual Setup (User Required)

- [ ] Create a Daily.co account at https://dashboard.daily.co
- [ ] Generate Daily.co API key from dashboard
- [ ] Set up Google Cloud project for Gemini API access
- [ ] Enable Vertex AI API in Google Cloud Console
- [ ] Create service account for Gemini Live API
- [ ] Download service account JSON credentials
- [ ] Create BrightData account at https://brightdata.com
- [ ] Generate BrightData API key for product search

### 2. Dependencies & Environment

**NPM Packages**:
```bash
npm install @daily-co/daily-react @daily-co/daily-js
npm install @google/genai
npm install zod
```

**Python Dependencies** (for PipeCat server):
```bash
pip install pipecat-ai[daily,google]
pip install google-cloud-aiplatform
pip install python-dotenv
pip install websockets
```

**Environment Variables** (`.env.local`):
```bash
# Daily.co
DAILY_API_KEY=your_daily_api_key
DAILY_ROOM_URL=https://your-domain.daily.co/room-name

# Google Gemini
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GEMINI_API_KEY=your_gemini_api_key

# BrightData
BRIGHTDATA_API_KEY=your_brightdata_key

# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_url
CONVEX_DEPLOYMENT=your_deployment_name
```

### 3. Database Schema

**Convex Schema** (`convex/schema.ts`):

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Voice sessions tracking
  voiceSessions: defineTable({
    userId: v.id("users"),
    dailyRoomUrl: v.string(),
    dailyRoomName: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("ended"),
      v.literal("error")
    ),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
    // Track conversation context
    conversationId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_started_at", ["startedAt"]),

  // Voice transcripts for debugging and analytics
  voiceTranscripts: defineTable({
    sessionId: v.id("voiceSessions"),
    userId: v.id("users"),
    speaker: v.union(v.literal("user"), v.literal("agent")),
    text: v.string(),
    timestamp: v.number(),
    // Audio metadata
    confidence: v.optional(v.number()),
    isInterruption: v.optional(v.boolean()),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_timestamp", ["timestamp"]),

  // Daily.co room management
  dailyRooms: defineTable({
    roomName: v.string(),
    roomUrl: v.string(),
    expiresAt: v.number(),
    isActive: v.boolean(),
    config: v.object({
      maxParticipants: v.number(),
      enableChat: v.boolean(),
      enableScreenShare: v.boolean(),
      enableRecording: v.boolean(),
    }),
  })
    .index("by_room_name", ["roomName"])
    .index("by_active", ["isActive"])
    .index("by_expires", ["expiresAt"]),
});
```

### 4. Backend Functions

#### Mutations

**Create Voice Session** (`convex/voiceSessions.ts`):
```typescript
export const createVoiceSession = mutation({
  args: {
    userId: v.id("users"),
    dailyRoomUrl: v.string(),
    dailyRoomName: v.string(),
  },
  handler: async (ctx, args) => {
    const sessionId = await ctx.db.insert("voiceSessions", {
      userId: args.userId,
      dailyRoomUrl: args.dailyRoomUrl,
      dailyRoomName: args.dailyRoomName,
      status: "active",
      startedAt: Date.now(),
    });
    return sessionId;
  },
});
```
- **Purpose**: Initialize new voice session when user clicks microphone
- **Returns**: `Id<"voiceSessions">`
- **Notes**: Tracks session start time for analytics

**End Voice Session** (`convex/voiceSessions.ts`):
```typescript
export const endVoiceSession = mutation({
  args: {
    sessionId: v.id("voiceSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const duration = Date.now() - session.startedAt;

    await ctx.db.patch(args.sessionId, {
      status: "ended",
      endedAt: Date.now(),
      duration,
    });

    return { duration };
  },
});
```
- **Purpose**: Close voice session and calculate duration
- **Returns**: `{ duration: number }`
- **Notes**: Called when user ends conversation or on timeout

**Save Transcript** (`convex/voiceTranscripts.ts`):
```typescript
export const saveTranscript = mutation({
  args: {
    sessionId: v.id("voiceSessions"),
    userId: v.id("users"),
    speaker: v.union(v.literal("user"), v.literal("agent")),
    text: v.string(),
    confidence: v.optional(v.number()),
    isInterruption: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const transcriptId = await ctx.db.insert("voiceTranscripts", {
      ...args,
      timestamp: Date.now(),
    });
    return transcriptId;
  },
});
```
- **Purpose**: Store conversation transcript for analytics
- **Returns**: `Id<"voiceTranscripts">`
- **Notes**: Real-time saving as conversation progresses

#### Queries

**Get Active Session** (`convex/voiceSessions.ts`):
```typescript
export const getActiveSession = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("voiceSessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});
```
- **Purpose**: Check if user has active voice session
- **Returns**: `VoiceSession | null`
- **Notes**: Prevents multiple concurrent sessions

**Get Session Transcripts** (`convex/voiceTranscripts.ts`):
```typescript
export const getSessionTranscripts = query({
  args: {
    sessionId: v.id("voiceSessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("voiceTranscripts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});
```
- **Purpose**: Retrieve full conversation history
- **Returns**: `VoiceTranscript[]`
- **Notes**: Used for debugging and context restoration

#### Actions

**Create Daily Room** (`convex/dailyRooms.ts`):
```typescript
export const createDailyRoom = action({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Call Daily.co API to create room
    const response = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          max_participants: 2,
          enable_chat: false,
          enable_screenshare: false,
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
        },
      }),
    });

    const roomData = await response.json();

    // Store room in database
    await ctx.runMutation(internal.dailyRooms.saveRoom, {
      roomName: roomData.name,
      roomUrl: roomData.url,
      expiresAt: roomData.config.exp * 1000,
      isActive: true,
      config: {
        maxParticipants: 2,
        enableChat: false,
        enableScreenShare: false,
        enableRecording: false,
      },
    });

    return {
      roomUrl: roomData.url,
      roomName: roomData.name,
    };
  },
});
```
- **Purpose**: Create Daily.co room for voice session
- **Returns**: `{ roomUrl: string, roomName: string }`
- **Limits**: 1-hour room expiry, 2 max participants
- **Notes**: Called before starting PipeCat session

**Start PipeCat Agent** (`convex/pipecat.ts`):
```typescript
export const startPipecatAgent = action({
  args: {
    sessionId: v.id("voiceSessions"),
    dailyRoomUrl: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Trigger Python PipeCat server via webhook or queue
    const response = await fetch(`${process.env.PIPECAT_SERVER_URL}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: args.sessionId,
        dailyRoomUrl: args.dailyRoomUrl,
        userId: args.userId,
        geminiConfig: {
          model: "gemini-2.0-flash-exp",
          systemInstruction: "You are a helpful shopping assistant...",
        },
      }),
    });

    const data = await response.json();
    return {
      agentId: data.agentId,
      status: data.status,
    };
  },
});
```
- **Purpose**: Initialize PipeCat agent for voice processing
- **Returns**: `{ agentId: string, status: string }`
- **Notes**: Communicates with separate Python server

### 5. Frontend

#### Components

**VoiceButton.tsx** (`app/components/VoiceButton.tsx`):
- Client Component with microphone icon
- States: `idle`, `connecting`, `active`, `disconnecting`
- Uses `useDaily()` hook from `@daily-co/daily-react`
- Triggers room creation and agent start on click
- Shows visual feedback (pulsing animation when active)

**VoiceSession.tsx** (`app/components/VoiceSession.tsx`):
- Client Component managing Daily call lifecycle
- Uses `DailyProvider` wrapper
- Implements `useParticipants()` for agent detection
- Handles `useDailyEvent()` for connection state
- Auto-saves transcripts using `useMutation()`
- Displays real-time audio waveform visualization

**VoiceControls.tsx** (`app/components/VoiceControls.tsx`):
- Client Component for mute/unmute controls
- Uses `useDevices()` from `@daily-co/daily-react`
- Implements `enableMic()` / `disableMic()`
- Visual indicators for microphone state
- Optional: Volume level indicator

#### State Strategy

- **Daily Call State**: Managed by `@daily-co/daily-react` hooks
- **Session Metadata**: Synced with Convex via `useQuery(api.voiceSessions.getActiveSession)`
- **Transcript Updates**: Real-time via `useAction()` for saving
- **Connection Status**: Local state with `useState()` for UI feedback
- **Audio Stream**: Managed by Daily.co SDK, no local storage needed

#### File Structure

```
app/
├── components/
│   ├── VoiceButton.tsx
│   ├── VoiceSession.tsx
│   ├── VoiceControls.tsx
│   └── AudioVisualizer.tsx
├── hooks/
│   ├── useVoiceSession.ts
│   └── useDailyRoom.ts
└── dashboard/
    └── page.tsx (integrates VoiceButton)
```

### 6. Error Prevention

#### API Error Handling
- Daily.co API failures: Retry with exponential backoff (max 3 attempts)
- Gemini API rate limits: Queue requests, show "please wait" message
- Network disconnections: Auto-reconnect Daily call, preserve session state
- Room expiry: Pre-emptively create new room before expiry

#### Schema Validation
```typescript
import { z } from "zod";

const VoiceSessionSchema = z.object({
  userId: z.string(),
  dailyRoomUrl: z.string().url(),
  status: z.enum(["active", "ended", "error"]),
});
```

#### Rate Limiting
- Limit voice session creation: 1 per user every 30 seconds
- Daily room creation: 10 per user per hour
- Transcript saves: Batched every 5 seconds to reduce writes

#### Authentication & Authorization
- Enforce Clerk authentication for all voice endpoints
- Validate `userId` matches authenticated user in all mutations
- Use Daily meeting tokens (not room URLs) for production security

#### Type Safety
- Strict TypeScript throughout frontend and Convex functions
- Use Convex's generated types: `api.voiceSessions.createVoiceSession`
- Zod validation for PipeCat webhook payloads

#### Boundaries & Quotas
- Daily.co: 2 participants max per room
- Gemini Live API: Monitor token usage, implement cutoff at 100k tokens/session
- Session timeout: Auto-end after 30 minutes of inactivity
- Storage: Limit transcripts to 1000 entries per user

### 7. Testing

#### Unit Tests
- `createVoiceSession`: Validates session creation with correct user ID
- `endVoiceSession`: Ensures duration calculation accuracy
- `saveTranscript`: Tests timestamp ordering
- `getActiveSession`: Verifies single active session per user
- `createDailyRoom`: Mock Daily.co API, test room configuration

#### Integration Tests
- Full flow: Create session → Join room → Agent starts → End session
- Transcript saving: Verify transcripts saved during active session
- Session cleanup: Test automatic session end on timeout
- Daily room expiry: Ensure rooms deleted after expiration

#### End-to-End Tests (Playwright)
1. User clicks microphone button
2. Daily room created and joined
3. PipeCat agent joins call
4. User speaks (mock audio input)
5. Agent responds (verify audio output)
6. User ends call
7. Session marked as ended in database
8. Transcript available in session history

#### Performance Tests
- Measure end-to-end latency: Click → Agent response
- Target: <2 seconds from button click to agent ready
- Monitor Daily WebRTC connection quality
- Test with varying network conditions (throttled connections)

#### AI-Specific Tests
- Gemini API response time: <500ms for typical queries
- Interruption handling: Verify agent stops speaking when user interrupts
- Context retention: Test multi-turn conversations maintain context
- Function calling: Ensure Gemini correctly triggers product search tools

## Documentation Sources

1. PipeCat Documentation - https://docs.pipecat.ai/getting-started/overview
2. Daily.co React Hooks - https://docs.daily.co/reference/daily-react
3. Gemini Live API Guide - https://ai.google.dev/gemini-api/docs/live
4. Convex Backend Documentation - https://docs.convex.dev
5. Next.js App Router - https://nextjs.org/docs/app
6. Daily.co API Reference - https://docs.daily.co/reference/rest-api
7. Google Cloud Vertex AI - https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal-live-api
8. Clerk Next.js Integration - https://clerk.com/docs/quickstarts/nextjs
9. BrightData MCP Server - https://docs.brightdata.com/api-reference/MCP-Server
10. Zod Validation - https://zod.dev
