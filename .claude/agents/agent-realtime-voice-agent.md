---
name: agent-realtime-voice-agent
description: Real-time voice interaction system using PipeCat and Daily for voice-based product shopping with Gemini AI
model: inherit
color: purple
tech_stack:
  framework: Next.js
  database: Convex
  auth: Clerk
  provider: PipeCat and Daily for voice, Gemini API for LLM
generated: 2025-10-18T00:00:00Z
documentation_sources: [
  "https://github.com/pipecat-ai/pipecat",
  "https://www.daily.co/blog/advice-on-building-voice-ai-in-june-2025/",
  "https://ai.google.dev/gemini-api/docs/live",
  "https://cloud.google.com/vertex-ai/generative-ai/docs/live-api/streamed-conversations",
  "https://www.daily.co/blog/build-a-real-time-video-chat-app-with-next-js-and-daily/"
]
---

# Agent: Real-time Voice Agent Implementation with PipeCat, Daily, and Gemini

## Agent Overview

**Purpose** – This agent implements a real-time voice interaction system that enables users to communicate with an AI shopping assistant via microphone input. Users can describe products they want to purchase through natural voice conversations, leveraging PipeCat's voice agent framework, Daily's WebRTC infrastructure for low-latency audio streaming, and Gemini's Live API for multimodal AI responses. The system handles voice activity detection, turn-taking, interruptions, and converts spoken requests into structured product searches.

**Tech Stack** – Next.js (frontend framework), PipeCat (voice agent orchestration), Daily (WebRTC audio transport), Gemini Live API (LLM with native audio processing), Convex (backend database and real-time queries), Clerk (authentication and user management)

**Source** – Implementation follows best practices from PipeCat's official documentation, Daily's voice AI implementation guides, Gemini Live API integration patterns, and Next.js API routes for WebRTC room creation and management.

## Critical Implementation Knowledge

### PipeCat & Daily Latest Updates 🚨

* **Framework-First Approach** – As of 2025, voice AI infrastructure (latency optimization, turn detection, context management, function calling) is solved in frameworks like PipeCat. Focus engineering effort on prompt engineering and use-case-specific logic rather than building infrastructure.
* **Default Settings Work** – Start with PipeCat's default VAD (voice activity detection) and interruption handling. Production-ready voice agents ship using framework defaults before custom tuning.
* **Gemini Live API Native Audio** – Gemini 2.0's Live API processes audio streams natively without separate STT/TTS, reducing latency and enabling more natural voice interactions with built-in voice activity detection.
* **Context Management Required** – For multi-turn conversations, implement "context engineering" using state machines (PipeCat Flows) to keep conversation context focused and prevent token bloat.
* **Daily React Hooks** – For React/Next.js apps, always use Daily's React Hooks library rather than the lower-level Call Object API for state management.

### Common Pitfalls & Solutions 🚨

* **Pitfall:** Implementing custom VAD or interruption logic before testing defaults
  * **Solution:** Use PipeCat's built-in VAD and turn-taking. Only customize after establishing baseline performance with framework defaults.

* **Pitfall:** Missing CORS headers on Daily room creation endpoints
  * **Solution:** Include CORS headers in all Next.js API routes that create Daily rooms, following Convex HTTP endpoint patterns.

* **Pitfall:** Not implementing observability before production
  * **Solution:** Add traces and error logging early. Voice agents fail due to prompt issues and provider reliability - you need visibility into failure modes.

* **Pitfall:** Using long, complex prompts for voice conversations
  * **Solution:** Keep prompts concise and state-focused. Use PipeCat Flows for multi-step workflows to maintain context efficiently.

* **Pitfall:** Blocking on perfect latency before shipping
  * **Solution:** Gemini Live API and PipeCat defaults deliver sub-second latency. Ship with good-enough performance, then optimize based on real user feedback.

* **Pitfall:** Not handling WebSocket connection failures
  * **Solution:** Implement reconnection logic for both Daily's WebRTC transport and Gemini's Live API WebSocket connections.

### Best Practices 🚨

* **Do:** Start with latency-optimized models (Gemini 2.0 Flash) and test every new model release against your evaluation criteria
* **Do:** Implement TTS models with word-level timestamps (if not using Gemini's native audio output) to align context with what users heard during interruptions
* **Do:** Use Next.js API routes (pages/api) for Daily room creation so they deploy as serverless functions on Vercel
* **Do:** Store conversation transcripts and user preferences in Convex with user-scoped queries for security
* **Do:** Implement prompt caching in Gemini API calls to optimize for speed and cost
* **Don't:** Build custom WebRTC signaling infrastructure - use Daily's managed service
* **Don't:** Try to implement speech-to-speech models without thorough evaluation - as of July 2025, the three-model approach (STT → LLM → TTS) remains more reliable for production
* **Don't:** Expose Daily API keys in frontend code - always create rooms via authenticated backend API routes
* **Don't:** Cache Gemini Live API connections across multiple users - maintain session isolation

## Implementation Steps

The architecture follows a client-server pattern with WebRTC audio streaming:

1. **Frontend (Next.js):** User interface for voice chat, Daily client integration, microphone access, real-time audio visualization
2. **Backend API Routes:** Daily room creation, authentication validation, session management
3. **Voice Agent Service:** PipeCat orchestration layer connecting Daily audio transport to Gemini Live API
4. **Database Layer:** Convex stores conversation history, user preferences, and product search results

### Backend Implementation

**Key Server Files and Responsibilities:**

* **`pages/api/daily-room.ts`** – Creates Daily WebRTC rooms with authentication, returns room URL and token for client connection
* **`convex/voiceAgents.ts`** – Stores conversation sessions, transcripts, and extracted product search intents
* **`services/pipecat/agent.py`** – PipeCat voice agent that connects Daily transport to Gemini Live API, handles turn-taking and function calling
* **`services/pipecat/processors.py`** – Custom processors for product search intent extraction, preference learning, and shopping cart integration
* **`convex/http.ts`** – HTTP endpoints for PipeCat agent to call Convex functions (CORS-enabled)

### Frontend Integration

**Key React Components and Hooks:**

* **`components/VoiceChat.tsx`** – Main voice chat interface using Daily React Hooks
* **`hooks/useDailyRoom.ts`** – Manages Daily room connection, participant state, and audio track management
* **`hooks/useVoiceAgent.ts`** – Handles voice agent session lifecycle, sends user context to backend
* **`components/AudioVisualizer.tsx`** – Real-time audio waveform visualization during active conversations
* **`components/ConversationHistory.tsx`** – Displays conversation transcripts fetched from Convex

**Core Integration Pattern:**

```typescript
// Frontend initiates voice session
const { startCall, endCall, isConnected } = useDailyRoom();
const { startAgent, conversationId } = useVoiceAgent();

// User clicks "Start Voice Chat"
const handleStartVoice = async () => {
  const { roomUrl, token } = await createDailyRoom();
  await startCall(roomUrl, token);
  await startAgent(conversationId);
};
```

## Code Patterns

### `pages/api/daily-room.ts`

Complete Next.js API route for creating authenticated Daily rooms:

```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';

// CORS headers for Daily room creation
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader(CORS_HEADERS).end();
  }

  // Verify authentication
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create Daily room
    const response = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          // Room expires after 10 minutes of inactivity
          exp: Math.floor(Date.now() / 1000) + 600,
          // Enable audio-only for voice agents
          enable_chat: false,
          enable_screenshare: false,
          enable_recording: 'cloud', // For conversation logging
          // Optimize for low latency
          enable_prejoin_ui: false,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create Daily room');
    }

    const room = await response.json();

    // Create meeting token for authenticated user
    const tokenResponse = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: room.name,
          // Associate token with Clerk user ID
          user_name: userId,
          // Token valid for 1 hour
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to create meeting token');
    }

    const { token } = await tokenResponse.json();

    // Return room URL and token
    res.status(200).json({
      roomUrl: room.url,
      token,
      roomName: room.name,
    });
  } catch (error) {
    console.error('Daily room creation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
```

**Validation:** This endpoint authenticates users via Clerk, creates a Daily room with appropriate settings for voice-only conversations, generates a user-specific meeting token, and returns credentials for the frontend to connect. Room expires automatically to prevent resource leaks.

### `services/pipecat/agent.py`

PipeCat voice agent connecting Daily transport to Gemini Live API:

```python
import asyncio
import os
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask
from pipecat.processors.aggregators.llm_response import LLMResponseAggregator
from pipecat.transports.services.daily import DailyTransport, DailyParams
from pipecat.services.gemini import GeminiLLMService
from pipecat.processors.frameworks.langchain import LangchainProcessor

# Custom processor for product search intent extraction
from processors import ProductSearchProcessor, ConversationLogger

async def create_voice_agent(room_url: str, token: str, user_id: str):
    """
    Creates a PipeCat voice agent for product shopping conversations.

    Args:
        room_url: Daily room URL to join
        token: Daily meeting token
        user_id: Clerk user ID for conversation context
    """

    # Initialize Daily transport for WebRTC audio
    transport = DailyTransport(
        room_url,
        token,
        "Voice Shopping Agent",
        DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            video_out_enabled=False,  # Audio-only
            vad_enabled=True,  # Use Daily's built-in VAD
            vad_analyzer=DailyParams.VadAnalyzerType.SILERO,
        ),
    )

    # Initialize Gemini Live API service
    gemini_service = GeminiLLMService(
        api_key=os.getenv("GEMINI_API_KEY"),
        model="gemini-2.0-flash-exp",  # Latency-optimized
        params={
            "temperature": 0.7,
            "max_output_tokens": 500,  # Keep responses concise
        },
    )

    # System prompt for shopping assistant
    system_prompt = """You are a helpful voice shopping assistant.
    Users will describe products they want to buy. Your job is to:
    1. Ask clarifying questions about product preferences
    2. Extract key product attributes (category, color, size, price range, etc.)
    3. Confirm understanding before searching

    Keep responses natural and conversational. Speak concisely - aim for 2-3 sentences.
    When you have enough information, use the search_products function."""

    # Custom processor for extracting product search intents
    product_processor = ProductSearchProcessor(user_id=user_id)

    # Conversation logger saves to Convex
    conversation_logger = ConversationLogger(user_id=user_id)

    # LLM response aggregator for handling streaming responses
    aggregator = LLMResponseAggregator()

    # Build pipeline: Audio → Gemini → Product Search → Audio
    pipeline = Pipeline([
        transport.input_processor(),      # Daily audio input
        gemini_service,                   # Gemini Live API
        aggregator,                       # Aggregate streaming responses
        product_processor,                # Extract product intents
        conversation_logger,              # Log to Convex
        transport.output_processor(),     # Daily audio output
    ])

    # Create pipeline task
    task = PipelineTask(pipeline)

    # Set initial context
    await task.queue_frames([
        LLMMessagesFrame([
            {"role": "system", "content": system_prompt}
        ])
    ])

    return transport, task

# Run agent
async def main():
    room_url = os.getenv("DAILY_ROOM_URL")
    token = os.getenv("DAILY_TOKEN")
    user_id = os.getenv("USER_ID")

    transport, task = await create_voice_agent(room_url, token, user_id)

    try:
        await task.run()
    except Exception as e:
        print(f"Agent error: {e}")
    finally:
        await transport.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
```

**Validation:** This agent creates a complete voice interaction pipeline using PipeCat's default VAD and turn-taking settings, connects Daily's WebRTC audio to Gemini's Live API, and processes responses through custom processors for product search extraction and conversation logging.

### `services/pipecat/processors.py`

Custom PipeCat processors for product search and logging:

```python
from pipecat.processors.frame_processor import FrameProcessor
from pipecat.frames.frames import LLMMessagesFrame, FunctionCallFrame
import httpx
import os

class ProductSearchProcessor(FrameProcessor):
    """Extracts product search intents and triggers Convex queries."""

    def __init__(self, user_id: str):
        super().__init__()
        self.user_id = user_id
        self.convex_url = os.getenv("CONVEX_URL")

    async def process_frame(self, frame):
        # Check if LLM called search_products function
        if isinstance(frame, FunctionCallFrame):
            if frame.function_name == "search_products":
                # Extract product attributes from function args
                attributes = frame.arguments

                # Call Convex mutation to search products
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{self.convex_url}/searchProducts",
                        json={
                            "userId": self.user_id,
                            "attributes": attributes,
                        },
                        headers={
                            "Content-Type": "application/json",
                        },
                    )

                    if response.status_code == 200:
                        results = response.json()
                        # Return results to LLM for natural language response
                        return LLMMessagesFrame([
                            {
                                "role": "function",
                                "name": "search_products",
                                "content": str(results),
                            }
                        ])

        # Pass through other frames unchanged
        return frame

class ConversationLogger(FrameProcessor):
    """Logs conversation turns to Convex for history and analysis."""

    def __init__(self, user_id: str):
        super().__init__()
        self.user_id = user_id
        self.convex_url = os.getenv("CONVEX_URL")

    async def process_frame(self, frame):
        # Log LLM messages to Convex
        if isinstance(frame, LLMMessagesFrame):
            for message in frame.messages:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"{self.convex_url}/logConversation",
                        json={
                            "userId": self.user_id,
                            "role": message.get("role"),
                            "content": message.get("content"),
                            "timestamp": int(time.time() * 1000),
                        },
                        headers={
                            "Content-Type": "application/json",
                        },
                    )

        return frame
```

**Validation:** These processors integrate PipeCat's frame-based architecture with Convex backend. ProductSearchProcessor intercepts function calls from Gemini and triggers product searches, while ConversationLogger persists all conversation turns for user history.

### `components/VoiceChat.tsx`

React component using Daily React Hooks for voice chat UI:

```typescript
'use client';

import { useCallback, useState } from 'react';
import { useDaily, useLocalParticipant, useParticipantIds } from '@daily-co/daily-react';
import { DailyProvider } from '@daily-co/daily-react';

export function VoiceChat() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const daily = useDaily();
  const localParticipant = useLocalParticipant();
  const participantIds = useParticipantIds();

  // Check if agent is in the room (more than just local user)
  const isAgentConnected = participantIds.length > 1;

  const startVoiceChat = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Call Next.js API to create Daily room
      const response = await fetch('/api/daily-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create voice chat room');
      }

      const { roomUrl, token } = await response.json();

      // Join Daily room
      await daily?.join({
        url: roomUrl,
        token,
      });

      // Note: PipeCat agent joins room separately via webhook or background service
      // triggered by room creation event
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start voice chat');
      console.error('Voice chat error:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [daily]);

  const endVoiceChat = useCallback(async () => {
    await daily?.leave();
  }, [daily]);

  return (
    <div className="voice-chat-container">
      <h2>Voice Shopping Assistant</h2>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!daily?.isJoined() ? (
        <button
          onClick={startVoiceChat}
          disabled={isConnecting}
          className="start-button"
        >
          {isConnecting ? 'Connecting...' : 'Start Voice Chat'}
        </button>
      ) : (
        <>
          <div className="status">
            <div className="indicator">
              {localParticipant?.audioTrack ? '🎤 Microphone Active' : '🔇 Microphone Off'}
            </div>
            <div className="indicator">
              {isAgentConnected ? '🤖 Agent Connected' : '⏳ Waiting for agent...'}
            </div>
          </div>

          <AudioVisualizer audioTrack={localParticipant?.audioTrack} />

          <button
            onClick={endVoiceChat}
            className="end-button"
          >
            End Chat
          </button>
        </>
      )}
    </div>
  );
}

// Wrapper with DailyProvider
export function VoiceChatWithProvider() {
  return (
    <DailyProvider>
      <VoiceChat />
    </DailyProvider>
  );
}
```

**Validation:** This component uses Daily's React Hooks to manage room connection, participant state, and audio tracks. It authenticates via Next.js API route, requests microphone permission, and provides clear UI feedback about connection status.

## Testing & Debugging

* **Daily Dashboard** – Monitor active rooms, participant connections, and recordings at https://dashboard.daily.co
* **Gemini API Logs** – Track API usage, latency metrics, and errors in Google Cloud Console or AI Studio
* **PipeCat Logging** – Enable debug logging in PipeCat agent to trace frame processing and pipeline execution
* **Convex Dashboard** – View conversation logs, product search queries, and real-time database updates
* **WebRTC Stats** – Use Daily's `getNetworkStats()` to monitor audio quality, packet loss, and latency
* **Unit Tests** – Test individual processors (ProductSearchProcessor, ConversationLogger) with mock frames
* **Integration Tests** – Test full pipeline with recorded audio samples to validate end-to-end behavior
* **Observability** – Integrate Sentry or similar for production error tracking and performance monitoring
* **User Feedback** – Collect user ratings after conversations to identify prompt engineering improvements

## Environment Variables

### Frontend (Next.js)

```bash
# .env.local

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_*****

# Convex Backend
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Daily (API key is server-side only, not exposed to frontend)
```

### Backend (Next.js API Routes)

```bash
# .env.local

# Daily API Key (server-side only)
DAILY_API_KEY=your_daily_api_key

# Clerk Server Key
CLERK_SECRET_KEY=sk_test_*****
```

### Voice Agent Service (PipeCat)

```bash
# .env

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Convex Backend URL (replace .convex.cloud with .convex.site for HTTP endpoints)
CONVEX_URL=https://your-deployment.convex.site

# Daily Room Connection (passed dynamically per session)
DAILY_ROOM_URL=https://your-domain.daily.co/room-name
DAILY_TOKEN=meeting_token_from_api

# User Context (passed per session)
USER_ID=clerk_user_id
```

### Convex Environment Variables

```bash
# Set in Convex Dashboard, not .env.local

# Clerk JWT Issuer
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-domain.clerk.accounts.dev
```

## Success Metrics

* **Latency < 1 second** – Measure time from user speech end to agent response start (VAD detection to TTS start)
* **Successful Intent Extraction** – Track percentage of conversations where product search intent is correctly identified
* **Conversation Completion Rate** – Percentage of voice sessions that successfully complete product searches vs. early dropoffs
* **Accurate Product Matching** – User confirmation rate for recommended products based on voice descriptions
* **WebRTC Connection Reliability** – Monitor Daily room connection success rate and audio quality metrics
* **Gemini API Success Rate** – Track API call success vs. failures, measure response times
* **User Satisfaction Score** – Post-conversation rating (1-5 stars) collected after each session
* **Conversation Length** – Average turns per session (target: 3-7 turns for focused product search)
* **Data Persistence** – 100% of conversations logged to Convex with complete transcripts
* **Security Compliance** – Zero unauthorized access to other users' conversation history (validated via Convex auth checks)
* **Function Invocation Accuracy** – Percentage of product searches triggered at appropriate conversation moments
