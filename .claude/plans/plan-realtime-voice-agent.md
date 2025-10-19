# Roadmap: Real-time Voice Agent (Voice-Only MVP)

## Context

**Tech Stack:** Next.js, Convex, Clerk, PipeCat, Daily, Gemini API

**Feature Description:** Real-time voice interaction on the main dashboard. Users click a microphone button, speak naturally to describe products they want, and the AI responds via voice while displaying results in real-time.

**MVP Scope:**
- ✅ Microphone button on main dashboard
- ✅ Real-time voice conversation with AI
- ✅ Voice transcript display
- ✅ Automatic product search detection
- ❌ No separate /voice page (integrated into main dashboard)
- ❌ No keyboard chat (voice-only)

**Goals:**
- Enable hands-free shopping via real-time voice on main dashboard
- Integrate Gemini API for natural language understanding
- Provide low-latency audio streaming using Daily WebRTC
- Support voice-triggered product search and commands

## Implementation Steps

### 1. Manual Setup (User Required)

- [ ] Daily.co account and API key
- [ ] Gemini API key in Convex dashboard
- [ ] PipeCat agent server deployed (separate from Vercel)

### 2. Dependencies

**Already Installed:**
```bash
@daily-co/daily-js
@daily-co/daily-react
@google/generative-ai
```

**Environment Variables:**

Frontend (.env.local):
```bash
NEXT_PUBLIC_DAILY_API_KEY=your_daily_key
```

Convex Dashboard:
```bash
DAILY_API_KEY=your_daily_key
GEMINI_API_KEY=your_gemini_key
```

PipeCat Server:
```bash
DAILY_API_KEY=your_daily_key
GEMINI_API_KEY=your_gemini_key
CONVEX_DEPLOYMENT_URL=https://your-deployment.convex.cloud
```

### 3. Database Schema

```typescript
// convex/schema.ts
voiceSessions: defineTable({
  userId: v.string(),
  roomUrl: v.optional(v.string()),
  roomName: v.optional(v.string()),
  status: v.union(
    v.literal("active"),
    v.literal("ended"),
    v.literal("error")
  ),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  metadata: v.optional(v.object({
    duration: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })),
})
.index("by_user", ["userId"])
.index("by_status", ["status"]),

voiceTranscripts: defineTable({
  sessionId: v.id("voiceSessions"),
  userId: v.string(),
  speaker: v.union(v.literal("user"), v.literal("agent")),
  text: v.string(),
  timestamp: v.number(),
  confidence: v.optional(v.number()),
})
.index("by_session", ["sessionId"])
.index("by_user", ["userId"]),
```

### 4. Backend Functions

**Mutations:**

`convex/voiceSessions.ts` - **createSession**
- Creates Daily room and voice session
- Returns room URL and token
- Called when user clicks mic button on dashboard

`convex/voiceSessions.ts` - **endSession**
- Marks session as ended
- Records duration

`convex/voiceTranscripts.ts` - **addTranscript**
- Stores conversation transcript
- Called by PipeCat agent in real-time

**Queries:**

`convex/voiceSessions.ts` - **getActiveSession**
- Returns user's current voice session
- Used by dashboard to show mic state

`convex/voiceTranscripts.ts` - **getSessionTranscripts**
- Returns conversation history
- Displayed on dashboard in real-time

**Actions:**

`convex/daily.ts` - **createDailyRoom**
- Calls Daily API to create temporary room
- 1-hour expiry

### 5. Frontend Integration

**Main Dashboard (`app/page.tsx`):**
- Microphone button (prominent, center of screen)
- Live transcript panel (side or bottom)
- Product grid (appears when products found)
- Preference tags (top or side)

**Components:**
- `VoiceMicButton` - Large, accessible mic toggle
- `VoiceTranscriptPanel` - Real-time conversation display
- Integrated into single dashboard layout

**User Flow:**
1. User lands on dashboard
2. Clicks large microphone button
3. Grants microphone permission
4. Speaks: "Find wooden desk under $200"
5. Transcript appears in real-time
6. AI responds via voice
7. Products appear on dashboard
8. User continues conversation

### 6. MVP Scope

**Included:**
- ✅ Mic button on main dashboard
- ✅ Real-time voice conversation
- ✅ Live transcript display
- ✅ Voice session management
- ✅ Daily.co WebRTC integration

**Excluded (Not MVP):**
- ❌ Separate /voice page (consolidated into main dashboard)
- ❌ Multiple concurrent sessions
- ❌ Voice settings/preferences UI
- ❌ Recording playback

### 7. Error Handling

- Microphone permission denied → Show clear instructions
- Daily room creation fails → Retry with exponential backoff
- PipeCat agent unavailable → Show error message
- Network issues → Graceful reconnection

### 8. Success Criteria

- [ ] Mic button on main dashboard
- [ ] Real-time voice works
- [ ] Transcript displays live
- [ ] Audio latency <300ms
- [ ] Session persists during conversation

## Documentation Sources

1. Daily.co Docs - https://docs.daily.co
2. PipeCat Framework - https://docs.pipecat.ai
3. Gemini API - https://ai.google.dev/gemini-api/docs
