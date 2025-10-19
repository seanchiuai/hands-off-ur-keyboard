# Roadmap: Real-time Voice Agent

## Context

**Tech Stack:** Next.js, Convex, Clerk, PipeCat, Daily, Gemini API

**Feature Description:** Voice-based interaction system using PipeCat and Daily that allows users to communicate with the AI agent via microphone to describe products they want to purchase.

**Goals:**
- Enable hands-free product shopping via real-time voice conversation
- Integrate Gemini API for natural language understanding
- Provide low-latency audio streaming using Daily WebRTC infrastructure
- Support multimodal AI responses (voice + product data)

## Implementation Steps

Each step is mandatory for shipping Real-time Voice Agent.

### 1. Manual Setup (User Required)

- [ ] Create Daily.co account at https://dashboard.daily.co
- [ ] Generate Daily API key from dashboard (Settings → Developers)
- [ ] Enable domain allowlist for your Next.js app domain
- [ ] Set up Google Cloud project for Gemini API access
- [ ] Enable Gemini API in Google Cloud Console
- [ ] Generate Gemini API key with appropriate quotas
- [ ] Verify PipeCat installation requirements (Python 3.10+, FFmpeg)
- [ ] Set up a separate server/container for PipeCat voice agent (cannot run in Vercel due to WebSocket requirements)

### 2. Dependencies & Environment

**NPM Packages:**
```bash
npm install @daily-co/daily-js @daily-co/daily-react next react react-dom
npm install -D @types/node typescript
```

**Python Dependencies (for PipeCat agent):**
```bash
pip install pipecat-ai daily-python google-generativeai websockets
```

**Environment Variables:**

Frontend (.env.local):
```bash
NEXT_PUBLIC_DAILY_DOMAIN=your-daily-domain.daily.co
NEXT_PUBLIC_PIPECAT_AGENT_URL=https://your-pipecat-server.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

Backend (Convex):
```bash
DAILY_API_KEY=your_daily_api_key
GEMINI_API_KEY=your_gemini_api_key
```

PipeCat Agent Server:
```bash
DAILY_API_KEY=your_daily_api_key
GEMINI_API_KEY=your_gemini_api_key
CONVEX_DEPLOYMENT_URL=https://your-deployment.convex.cloud
```

### 3. Database Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  voiceSessions: defineTable({
    userId: v.id("users"),
    roomUrl: v.string(),
    roomName: v.string(),
    status: v.union(v.literal("active"), v.literal("ended"), v.literal("error")),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    metadata: v.optional(v.object({
      duration: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_room", ["roomName"]),

  voiceTranscripts: defineTable({
    sessionId: v.id("voiceSessions"),
    userId: v.id("users"),
    speaker: v.union(v.literal("user"), v.literal("agent")),
    text: v.string(),
    timestamp: v.number(),
    confidence: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  voiceCommands: defineTable({
    sessionId: v.id("voiceSessions"),
    userId: v.id("users"),
    command: v.string(),
    intent: v.string(),
    parameters: v.optional(v.any()),
    executedAt: v.number(),
    successful: v.boolean(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user_time", ["userId", "executedAt"]),
});
```

### 4. Backend Functions

**Mutations:**

`convex/voiceSessions.ts` - **createSession**
- **Purpose:** Create a new Daily room and voice session record
- **Args:** `{ userId: Id<"users"> }`
- **Returns:** `{ sessionId: Id<"voiceSessions">, roomUrl: string, token: string }`
- **Notes:** Calls Daily REST API to create room with 1-hour expiry

`convex/voiceSessions.ts` - **endSession**
- **Purpose:** Mark voice session as ended and record duration
- **Args:** `{ sessionId: Id<"voiceSessions"> }`
- **Returns:** `{ success: boolean }`
- **Notes:** Validates user ownership before updating

`convex/voiceTranscripts.ts` - **addTranscript**
- **Purpose:** Store voice transcript from PipeCat agent
- **Args:** `{ sessionId: Id<"voiceSessions">, speaker: "user" | "agent", text: string, timestamp: number }`
- **Returns:** `Id<"voiceTranscripts">`
- **Notes:** Called by PipeCat agent via Convex HTTP actions

`convex/voiceCommands.ts` - **recordCommand**
- **Purpose:** Log executed voice commands for analytics
- **Args:** `{ sessionId: Id<"voiceSessions">, command: string, intent: string, parameters: any, successful: boolean }`
- **Returns:** `Id<"voiceCommands">`
- **Notes:** Tracks product search, save, remove intents

**Queries:**

`convex/voiceSessions.ts` - **getActiveSession**
- **Purpose:** Get user's current active voice session
- **Args:** `{ userId: Id<"users"> }`
- **Returns:** `VoiceSession | null`
- **Notes:** Returns only active sessions

`convex/voiceTranscripts.ts` - **getSessionTranscripts**
- **Purpose:** Retrieve all transcripts for a session
- **Args:** `{ sessionId: Id<"voiceSessions"> }`
- **Returns:** `Array<VoiceTranscript>`
- **Notes:** Ordered by timestamp ascending

**Actions:**

`convex/daily.ts` - **createDailyRoom**
- **Purpose:** Call Daily REST API to create temporary room
- **Args:** `{ userId: Id<"users"> }`
- **Returns:** `{ roomUrl: string, roomName: string, token: string }`
- **Notes:** Sets room expiry to 1 hour, enables recording for debugging

`convex/pipecat.ts` - **startPipecatAgent**
- **Purpose:** Trigger PipeCat agent to join Daily room
- **Args:** `{ roomUrl: string, sessionId: Id<"voiceSessions"> }`
- **Returns:** `{ agentStarted: boolean }`
- **Notes:** Sends HTTP request to PipeCat server with room credentials

### 5. Frontend

**Components:**

`app/voice/page.tsx` - Main voice shopping page
- Uses `useCall()` from `@daily-co/daily-react` to manage Daily call
- Integrates Clerk `useUser()` for authentication
- Manages microphone permissions and audio device selection
- Displays real-time transcripts from Convex

`components/VoiceMicButton.tsx` - Microphone toggle button
- Visual states: idle, connecting, active, error
- Handles Daily call join/leave logic
- Shows recording indicator when active

`components/VoiceTranscriptPanel.tsx` - Live transcript display
- Subscribes to `useQuery(api.voiceTranscripts.getSessionTranscripts)`
- Auto-scrolls to latest message
- Differentiates user vs agent messages

`hooks/useVoiceSession.ts` - Voice session management hook
- Wraps `useMutation(api.voiceSessions.createSession)` and `endSession`
- Manages Daily room lifecycle
- Returns `{ startSession, endSession, activeSession, isConnecting }`

`hooks/useDailyCall.ts` - Daily.co integration hook
- Wraps `@daily-co/daily-react` hooks
- Handles participant events and audio track management
- Returns `{ joinCall, leaveCall, participants, localAudio }`

### 6. Error Prevention

**API Error Handling:**
- Wrap Daily API calls in try-catch with exponential backoff
- Handle rate limits (429) from Daily API (max 100 rooms/min)
- Validate Gemini API quotas before starting session (QPM limits)
- Return user-friendly error messages ("Unable to start voice session")

**Schema Validation:**
- Use Convex validators (`v.id()`, `v.string()`) for all mutations
- Validate room URLs match Daily domain pattern
- Check session ownership before mutations (`ctx.auth.getUserIdentity()`)

**Authentication/Authorization:**
- Require Clerk authentication for all voice session endpoints
- Validate userId matches authenticated user in all mutations
- Use Daily meeting tokens with user-specific permissions
- Implement session timeout after 1 hour

**Type Safety:**
- Define TypeScript interfaces for all PipeCat agent responses
- Type Daily room configuration objects
- Use Convex-generated types for all database operations

**Rate Limiting:**
- Limit voice sessions to 1 concurrent per user
- Implement cooldown period (30s) between session creation
- Monitor Gemini API token usage per session

**Boundaries/Quotas:**
- Daily: 100 rooms/min creation limit, 50 concurrent participants
- Gemini API: 60 requests/min for gemini-1.5-flash
- PipeCat: Monitor server CPU/memory, scale horizontally if needed

### 7. Testing

**Unit Tests:**
- [ ] Test `createSession` mutation with valid userId
- [ ] Test `endSession` validates session ownership
- [ ] Test `addTranscript` rejects invalid speaker values
- [ ] Test Daily room creation returns valid URLs
- [ ] Test PipeCat agent startup handles connection failures

**Integration Tests:**
- [ ] End-to-end flow: create session → join room → send transcript → end session
- [ ] Test Gemini API integration with sample voice commands
- [ ] Verify Convex receives transcripts from PipeCat agent
- [ ] Test session timeout after 1 hour

**E2E Tests (Playwright):**
- [ ] User clicks mic button → Daily room loads → audio permissions granted
- [ ] User speaks → transcript appears in real-time
- [ ] User ends session → room closes → session marked ended

**Performance Tests:**
- [ ] Measure audio latency (target: <300ms round-trip)
- [ ] Test concurrent sessions (target: 10 users)
- [ ] Monitor Gemini API response time (target: <2s)

## Documentation Sources

1. Daily.co Next.js Integration - https://docs.daily.co/guides/products/prebuilt/getting-started-with-prebuilt
2. PipeCat Voice AI Framework - https://docs.pipecat.ai/
3. Gemini API Live Streaming - https://ai.google.dev/api/generate-content#streaming
4. Daily React Hooks - https://docs.daily.co/reference/daily-react/use-daily
5. Convex Actions for HTTP Requests - https://docs.convex.dev/functions/actions
6. WebRTC Best Practices for Voice - https://webrtc.org/getting-started/overview
