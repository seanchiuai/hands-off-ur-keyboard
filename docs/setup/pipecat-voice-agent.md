# PipeCat Voice Agent Setup Guide

This guide explains how to set up the PipeCat voice agent server that powers the real-time voice shopping experience.

## Overview

The voice shopping feature uses:
- **Daily.co** - WebRTC infrastructure for low-latency audio streaming
- **PipeCat** - Voice agent orchestration framework
- **Gemini Live API** - AI language model with native audio processing
- **Convex** - Real-time database for session and transcript storage

## Architecture

```
User Browser (Daily.co client)
    ↓ WebRTC Audio
Daily.co Room
    ↓ Audio Stream
PipeCat Agent (Python server)
    ↓ Process Audio
Gemini Live API
    ↓ AI Response
PipeCat Agent
    ↓ WebRTC Audio
Daily.co Room
    ↓ Audio Stream
User Browser
```

## Prerequisites

1. **Daily.co Account**
   - Sign up at https://dashboard.daily.co
   - Get your API key from the dashboard
   - Add to `.env.local`: `DAILY_API_KEY=your_key_here`
   - Add to Convex dashboard environment variables

2. **Google Gemini API Key**
   - Get from https://ai.google.dev
   - Add to Convex dashboard: `GEMINI_API_KEY=your_key_here`

3. **Python 3.9+**
   - Required for PipeCat server

## PipeCat Server Setup

### Step 1: Create PipeCat Server Directory

Create a separate directory for the PipeCat server (outside Next.js project):

```bash
mkdir pipecat-voice-agent
cd pipecat-voice-agent
```

### Step 2: Install Dependencies

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install PipeCat and dependencies
pip install pipecat-ai
pip install daily-python
pip install google-generativeai
pip install httpx  # For Convex HTTP calls
```

### Step 3: Create Agent Script

Create `voice_agent.py`:

```python
import asyncio
import os
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask
from pipecat.processors.aggregators.llm_response import LLMResponseAggregator
from pipecat.transports.services.daily import DailyTransport, DailyParams
from pipecat.services.gemini import GeminiLLMService
from pipecat.frames.frames import LLMMessagesFrame
import httpx

# Custom processor for logging transcripts to Convex
class TranscriptLogger:
    def __init__(self, convex_url: str, session_id: str):
        self.convex_url = convex_url
        self.session_id = session_id

    async def log_transcript(self, speaker: str, text: str):
        """Log transcript to Convex"""
        async with httpx.AsyncClient() as client:
            try:
                await client.post(
                    f"{self.convex_url}/addTranscript",
                    json={
                        "sessionId": self.session_id,
                        "speaker": speaker,
                        "text": text,
                        "timestamp": int(time.time() * 1000),
                    },
                )
            except Exception as e:
                print(f"Failed to log transcript: {e}")

async def create_voice_agent(room_url: str, token: str, session_id: str):
    """
    Creates a PipeCat voice agent for product shopping conversations.
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
            vad_enabled=True,  # Voice activity detection
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
    2. Extract key product attributes (category, color, size, price range)
    3. Confirm understanding before searching
    4. Help users save products by number

    Keep responses natural and conversational. Speak concisely - 2-3 sentences max.
    When you have enough information, describe the product search you'll perform."""

    # Transcript logger
    transcript_logger = TranscriptLogger(
        convex_url=os.getenv("CONVEX_URL"),
        session_id=session_id,
    )

    # LLM response aggregator
    aggregator = LLMResponseAggregator()

    # Build pipeline: Audio → Gemini → Audio
    pipeline = Pipeline([
        transport.input_processor(),
        gemini_service,
        aggregator,
        transport.output_processor(),
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

async def main():
    """Main entry point for voice agent"""
    # These should be passed as environment variables
    room_url = os.getenv("DAILY_ROOM_URL")
    token = os.getenv("DAILY_TOKEN")
    session_id = os.getenv("SESSION_ID")

    if not all([room_url, token, session_id]):
        raise ValueError("Missing required environment variables")

    transport, task = await create_voice_agent(room_url, token, session_id)

    try:
        await task.run()
    except Exception as e:
        print(f"Agent error: {e}")
    finally:
        await transport.cleanup()

if __name__ == "__main__":
    asyncio.run(main())
```

### Step 4: Create Environment File

Create `.env` in the pipecat-voice-agent directory:

```bash
# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# Convex Backend URL (use .site not .cloud for HTTP endpoints)
CONVEX_URL=https://your-deployment.convex.site

# These will be passed per session:
# DAILY_ROOM_URL=https://your-domain.daily.co/room-name
# DAILY_TOKEN=meeting_token
# SESSION_ID=convex_session_id
```

### Step 5: Create Agent Orchestrator

For production, create an orchestrator that spawns agents per session:

Create `orchestrator.py`:

```python
import asyncio
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess

app = FastAPI()

class SessionRequest(BaseModel):
    room_url: str
    token: str
    session_id: str

# Track running agents
running_agents = {}

@app.post("/start-agent")
async def start_agent(request: SessionRequest):
    """Start a voice agent for a session"""
    try:
        # Set environment variables for this agent
        env = os.environ.copy()
        env["DAILY_ROOM_URL"] = request.room_url
        env["DAILY_TOKEN"] = request.token
        env["SESSION_ID"] = request.session_id

        # Start agent process
        process = subprocess.Popen(
            ["python", "voice_agent.py"],
            env=env,
        )

        running_agents[request.session_id] = process

        return {"status": "started", "session_id": request.session_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stop-agent/{session_id}")
async def stop_agent(session_id: str):
    """Stop a voice agent"""
    if session_id in running_agents:
        process = running_agents[session_id]
        process.terminate()
        del running_agents[session_id]
        return {"status": "stopped"}
    return {"status": "not_found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

Install FastAPI:
```bash
pip install fastapi uvicorn
```

### Step 6: Run the Orchestrator

```bash
python orchestrator.py
```

The orchestrator will listen on port 8000 for agent start/stop requests.

## Integration with Next.js App

### Option 1: Manual Agent Start (Development)

For development, manually start agents when sessions begin:

1. User starts voice chat in browser
2. Daily room created via `/api/daily-room`
3. Manually run: `DAILY_ROOM_URL=... DAILY_TOKEN=... SESSION_ID=... python voice_agent.py`

### Option 2: Automated Agent Start (Production)

Update the Next.js API route to call the orchestrator:

In `app/api/daily-room/route.ts`, add after session creation:

```typescript
// Trigger agent start
await fetch('http://your-pipecat-server:8000/start-agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    room_url: room.url,
    token: token,
    session_id: sessionId,
  }),
});
```

## Deployment

### Development
- Run PipeCat server locally
- Point Next.js to `http://localhost:8000`

### Production Options

1. **Separate Server**
   - Deploy PipeCat on a VM (AWS EC2, GCP Compute Engine)
   - Ensure it's accessible from your Next.js deployment
   - Use environment variable for orchestrator URL

2. **Docker Container**
   - Create Dockerfile for PipeCat server
   - Deploy to container service (AWS ECS, Google Cloud Run)

3. **Serverless Functions** (Advanced)
   - Package PipeCat as serverless function
   - Cold starts may impact latency

## Troubleshooting

### Agent doesn't join room
- Check Daily API key is valid
- Verify room URL and token are correct
- Check network connectivity

### No audio streaming
- Ensure VAD is enabled in DailyParams
- Check microphone permissions in browser
- Verify Daily room has audio enabled

### Transcripts not saving
- Check Convex URL is correct (.site not .cloud)
- Verify session ID exists in Convex
- Check authentication if using Convex auth

### High latency
- Use Gemini 2.0 Flash (not Pro)
- Ensure PipeCat server is geographically close to users
- Check Daily region settings

## Testing

Test the agent manually:

```bash
# Terminal 1: Start orchestrator
python orchestrator.py

# Terminal 2: Create a test session
curl -X POST http://localhost:8000/start-agent \
  -H "Content-Type: application/json" \
  -d '{
    "room_url": "https://your-domain.daily.co/test-room",
    "token": "your_token",
    "session_id": "test_session_123"
  }'
```

## Next Steps

1. Set up Daily.co account and get API key
2. Get Gemini API key
3. Install Python dependencies
4. Create voice_agent.py script
5. Test locally with manual agent start
6. Deploy orchestrator for production
7. Update Next.js to call orchestrator

## Resources

- PipeCat Documentation: https://docs.pipecat.ai
- Daily.co Docs: https://docs.daily.co
- Gemini API Docs: https://ai.google.dev/gemini-api/docs
