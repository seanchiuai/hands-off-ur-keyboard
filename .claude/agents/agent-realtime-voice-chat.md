---
name: agent-realtime-voice-chat
description: Real-time voice agent using PipeCat and Daily for voice-based product shopping
model: inherit
color: blue
tech_stack:
  framework: Next.js
  database: Convex
  auth: Clerk
  provider: PipeCat + Daily
generated: 2025-10-18T00:00:00Z
documentation_sources: [
  "https://docs.pipecat.ai",
  "https://docs.daily.co/reference/rest-api",
  "https://github.com/pipecat-ai/docs",
  "https://github.com/daily-co/daily-react"
]
---

# Agent: Real-time Voice Chat Implementation with PipeCat and Daily

## Agent Overview

This agent handles real-time voice interaction between users and the AI shopping assistant. It manages WebRTC connections via Daily, processes audio streams through PipeCat's pipeline architecture, and coordinates with the LLM backend agent for natural language understanding and product search execution. The voice agent enables hands-free shopping by capturing user speech, managing conversation flow, and providing audio feedback.

**Tech Stack**: PipeCat (Python), Daily WebRTC, Daily React (client), Convex (state sync), Next.js (frontend)

**Source**: PipeCat documentation, Daily REST API, Daily React SDK

## Critical Implementation Knowledge

### PipeCat Latest Updates 🚨

* PipeCat now supports WebRTC transport via both Daily and Small WebRTC transports
* Real-time audio streaming with built-in VAD (Voice Activity Detection) using Silero
* Pipeline-based architecture allows modular composition of audio processing components
* Native support for OpenAI Realtime API and Gemini Multimodal Live API
* Function calling support enables integration with external tools and services

### Common Pitfalls & Solutions 🚨

* **Pitfall**: Audio streams not properly initialized before pipeline starts
  * **Solution**: Always initialize DailyTransport with audio_in_enabled=True and audio_out_enabled=True before creating pipeline

* **Pitfall**: VAD not triggering conversation turns correctly
  * **Solution**: Use SileroVADAnalyzer with appropriate stop_secs parameter (0.5-1.0s) for natural conversation flow

* **Pitfall**: Pipeline components not properly ordered
  * **Solution**: Follow order: transport.input() → STT → context_aggregator.user() → (bridge to LLM agent) → TTS → transport.output() → context_aggregator.assistant()

* **Pitfall**: Daily room not properly provisioned before client joins
  * **Solution**: Create Daily room via REST API endpoint before returning room URL and token to client

* **Pitfall**: Client disconnect not properly handled
  * **Solution**: Implement on_participant_left event handler to cleanup pipeline and cancel tasks

### Best Practices 🚨

* Use Daily's transcription_enabled feature for backup transcription and debugging
* Implement proper error handling for participant connection/disconnection events
* Use PipelineParams with allow_interruptions=True for natural conversation flow
* Store conversation state in Convex for real-time sync with UI agent
* Use Daily React hooks (useParticipantIds, useParticipantProperty) for participant management
* Implement proper cleanup in event handlers to prevent memory leaks

## Implementation Steps

The architecture consists of a Python backend running the PipeCat pipeline and a Next.js frontend using Daily React for WebRTC connectivity.

### Backend Implementation

* `app/api/voice/connect/route.ts` - Creates Daily room and returns connection credentials
* `voice_agent/bot.py` - Main PipeCat bot implementation with pipeline setup
* `voice_agent/llm_bridge.py` - Bridges voice agent to Gemini LLM backend agent via Convex
* `voice_agent/conversation_manager.py` - Manages conversation state and context

### Frontend Integration

* `components/VoiceButton.tsx` - Microphone button component that initiates voice session
* `hooks/useDailyVoice.ts` - Custom hook wrapping Daily React for voice management
* `hooks/useConvexVoiceSync.ts` - Syncs voice conversation state with Convex
* `lib/daily-client.ts` - Daily client configuration and initialization

## Code Patterns

### `app/api/voice/connect/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const DAILY_API_KEY = process.env.DAILY_API_KEY!;
const DAILY_API_URL = 'https://api.daily.co/v1';

export async function POST(request: NextRequest) {
  try {
    // Create a Daily room
    const roomResponse = await fetch(`${DAILY_API_URL}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`
      },
      body: JSON.stringify({
        properties: {
          enable_chat: false,
          enable_screenshare: false,
          enable_recording: false,
          start_audio_off: false,
          start_video_off: true,
          exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
        }
      })
    });

    if (!roomResponse.ok) {
      throw new Error('Failed to create Daily room');
    }

    const room = await roomResponse.json();

    // Create a meeting token for the user
    const tokenResponse = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`
      },
      body: JSON.stringify({
        properties: {
          room_name: room.name,
          is_owner: false,
          user_name: 'User'
        }
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to create meeting token');
    }

    const { token } = await tokenResponse.json();

    // Trigger Python bot to join the room
    await fetch(process.env.VOICE_BOT_URL + '/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_url: room.url,
        token: token
      })
    });

    return NextResponse.json({
      roomUrl: room.url,
      token: token
    });
  } catch (error) {
    console.error('Voice connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize voice session' },
      { status: 500 }
    );
  }
}
```

This endpoint creates a Daily room, generates a user token, and triggers the Python bot to join, returning credentials for the client to connect.

### `voice_agent/bot.py`

```python
import asyncio
import aiohttp
import os
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_response import (
    LLMAssistantResponseAggregator,
    LLMUserResponseAggregator
)
from pipecat.frames.frames import LLMMessagesFrame, EndFrame
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.transports.services.daily import DailyParams, DailyTransport
from pipecat.vad.silero import SileroVADAnalyzer
from convex import ConvexClient

# Initialize Convex client for state sync
convex_client = ConvexClient(os.getenv("CONVEX_URL"))

async def run_bot(room_url: str, token: str, session_id: str):
    """Main bot entry point that handles voice conversation."""
    async with aiohttp.ClientSession() as session:
        # Configure Daily transport with audio and VAD
        transport = DailyTransport(
            room_url,
            token,
            "Shopping Assistant",
            DailyParams(
                audio_in_enabled=True,
                audio_out_enabled=True,
                video_out_enabled=False,
                vad_analyzer=SileroVADAnalyzer(
                    params={"stop_secs": 0.7}
                ),
                transcription_enabled=True,
            )
        )

        # Configure TTS service
        tts = ElevenLabsTTSService(
            aiohttp_session=session,
            api_key=os.getenv("ELEVENLABS_API_KEY"),
            voice_id=os.getenv("ELEVENLABS_VOICE_ID"),
            model="eleven_flash_v2_5"
        )

        # Initialize conversation context
        messages = [
            {
                "role": "system",
                "content": "You are a helpful shopping assistant. Listen to the user's product requests and help them find what they need. Keep responses brief and natural for voice conversation."
            }
        ]

        # Create aggregators for conversation context
        context_in = LLMUserResponseAggregator(messages)
        context_out = LLMAssistantResponseAggregator(messages)

        # Build pipeline: Input → User Context → (LLM Bridge) → TTS → Output → Assistant Context
        pipeline = Pipeline([
            transport.input(),
            context_in,
            # LLM processing happens via Convex bridge to Gemini agent
            tts,
            transport.output(),
            context_out,
        ])

        # Create pipeline task with interruption support
        task = PipelineTask(
            pipeline,
            params=PipelineParams(
                allow_interruptions=True,
                enable_metrics=True
            )
        )

        @transport.event_handler("on_first_participant_joined")
        async def on_first_participant_joined(transport, participant):
            """Start conversation when user joins."""
            transport.capture_participant_transcription(participant["id"])
            # Greet the user
            await task.queue_frames([
                LLMMessagesFrame([{
                    "role": "assistant",
                    "content": "Hi! I'm your shopping assistant. What would you like to buy today?"
                }])
            ])

        @transport.event_handler("on_participant_left")
        async def on_participant_left(transport, participant, reason):
            """Cleanup when user disconnects."""
            await task.queue_frame(EndFrame())

        @transport.event_handler("on_transcription_message")
        async def on_transcription(transport, message):
            """Send user transcription to Convex for LLM processing."""
            if message["participantId"] != transport.participant_id:
                # User spoke - send to Convex for LLM agent processing
                await convex_client.mutation(
                    "voice:processUserMessage",
                    {
                        "sessionId": session_id,
                        "message": message["text"],
                        "timestamp": message["timestamp"]
                    }
                )

        # Run the pipeline
        runner = PipelineRunner()
        await runner.run(task)
```

This bot initializes the PipeCat pipeline with Daily transport, handles participant events, and bridges user speech to the LLM backend via Convex.

### `components/VoiceButton.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useDailyVoice } from '@/hooks/useDailyVoice';

export function VoiceButton() {
  const [isConnecting, setIsConnecting] = useState(false);
  const { isConnected, connect, disconnect } = useDailyVoice();

  const handleClick = async () => {
    if (isConnected) {
      await disconnect();
    } else {
      setIsConnecting(true);
      try {
        await connect();
      } catch (error) {
        console.error('Failed to connect:', error);
      } finally {
        setIsConnecting(false);
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      className={`
        relative w-20 h-20 rounded-full flex items-center justify-center
        transition-all duration-200 shadow-lg
        ${isConnected
          ? 'bg-red-500 hover:bg-red-600 animate-pulse'
          : 'bg-blue-500 hover:bg-blue-600'
        }
        ${isConnecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {isConnected ? (
        <MicOff className="w-8 h-8 text-white" />
      ) : (
        <Mic className="w-8 h-8 text-white" />
      )}
    </button>
  );
}
```

This component provides the microphone button UI that users click to start/stop voice sessions.

### `hooks/useDailyVoice.ts`

```typescript
import { useState, useCallback, useRef } from 'react';
import { DailyCall } from '@daily-co/daily-js';
import Daily from '@daily-co/daily-js';
import { useConvexVoiceSync } from './useConvexVoiceSync';

export function useDailyVoice() {
  const [isConnected, setIsConnected] = useState(false);
  const callRef = useRef<DailyCall | null>(null);
  const { startSession, endSession } = useConvexVoiceSync();

  const connect = useCallback(async () => {
    try {
      // Request connection credentials from backend
      const response = await fetch('/api/voice/connect', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to get connection credentials');
      }

      const { roomUrl, token } = await response.json();

      // Create Daily call instance
      const call = Daily.createCallObject({
        audioSource: true,
        videoSource: false,
      });

      callRef.current = call;

      // Set up event handlers
      call.on('joined-meeting', () => {
        setIsConnected(true);
        startSession();
      });

      call.on('left-meeting', () => {
        setIsConnected(false);
        endSession();
      });

      call.on('error', (error) => {
        console.error('Daily error:', error);
        setIsConnected(false);
      });

      // Join the room
      await call.join({ url: roomUrl, token });

    } catch (error) {
      console.error('Connection error:', error);
      throw error;
    }
  }, [startSession]);

  const disconnect = useCallback(async () => {
    if (callRef.current) {
      await callRef.current.leave();
      await callRef.current.destroy();
      callRef.current = null;
      setIsConnected(false);
      endSession();
    }
  }, [endSession]);

  return {
    isConnected,
    connect,
    disconnect,
  };
}
```

This hook manages the Daily voice connection lifecycle and syncs with Convex session state.

## Testing & Debugging

* Use Daily dashboard to monitor room activity and participant connections
* Enable PipeCat metrics with `enable_metrics=True` to track pipeline performance
* Test VAD sensitivity by adjusting `stop_secs` parameter (0.5-1.5s range)
* Use Daily's `transcription_enabled` for verifying speech-to-text accuracy
* Monitor Convex dashboard for real-time message flow between agents
* Test interruption handling by speaking while assistant is responding
* Verify proper cleanup by checking Daily rooms are deleted after sessions end
* Use browser DevTools to monitor WebRTC stats and audio stream quality

## Environment Variables

### Frontend (Next.js)
```bash
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
DAILY_API_KEY=your_daily_api_key
VOICE_BOT_URL=http://localhost:8000  # Python bot endpoint
```

### Backend (Python Voice Bot)
```bash
DAILY_API_KEY=your_daily_api_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id
CONVEX_URL=https://your-project.convex.cloud
```

## Success Metrics

* Voice session establishes connection within 2 seconds of button click
* VAD accurately detects speech start/end with <500ms latency
* Audio responses from TTS begin within 1 second of LLM completion
* User interruptions properly cancel ongoing TTS playback
* Conversation state correctly syncs to Convex in real-time
* Daily rooms properly cleanup after participant disconnect
* Voice transcription accuracy >95% for clear speech
* Pipeline handles 10+ conversation turns without degradation
