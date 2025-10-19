# PipeCat Voice Agent Service

This service runs a PipeCat voice agent that connects Daily's WebRTC audio transport to Gemini Live API for real-time voice conversations.

## Prerequisites

- Python 3.10 or higher
- FFmpeg (required by PipeCat for audio processing)

### Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

## Installation

1. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Configuration

Create a `.env` file with the following variables:

```bash
# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Convex Backend (use .convex.site for HTTP endpoints)
CONVEX_URL=https://your-deployment.convex.site

# The following are passed dynamically per session:
# DAILY_ROOM_URL=https://your-domain.daily.co/room-name
# DAILY_TOKEN=meeting_token_from_api
# USER_ID=clerk_user_id
# SESSION_ID=convex_voice_session_id
```

## Running the Agent

The agent should be triggered for each new voice session. You have several options:

### Option 1: Manual Trigger (for testing)

```bash
export DAILY_ROOM_URL="https://your-domain.daily.co/room-name"
export DAILY_TOKEN="your_meeting_token"
export USER_ID="clerk_user_id"
export SESSION_ID="convex_session_id"

python agent.py
```

### Option 2: HTTP Webhook (recommended for production)

Create a simple Flask/FastAPI server that:
1. Receives webhook from Next.js when a room is created
2. Spawns agent.py as a subprocess with environment variables
3. Returns success/failure status

### Option 3: Containerized Deployment

Deploy the agent as a Docker container on:
- Railway
- Render
- Fly.io
- AWS ECS
- Google Cloud Run

## Architecture

```
User Browser (Daily Client)
    ↓
Daily WebRTC Room
    ↓
PipeCat Agent (this service)
    ↓
Gemini Live API ←→ Product Search ←→ Convex Backend
```

## Custom Processors

### ProductSearchProcessor
- Intercepts `search_products` function calls from Gemini
- Calls Convex HTTP endpoint to search products
- Returns results to LLM for natural language response

### ConversationLogger
- Captures all conversation turns
- Stores transcripts in Convex database
- Enables real-time transcript display in frontend

## Deployment Notes

**IMPORTANT:** This service cannot run on Vercel due to WebSocket requirements. Deploy it separately on a platform that supports long-running processes:

1. **Railway** - Easy deployment with auto-scaling
2. **Render** - Simple Docker deployment
3. **Fly.io** - Global edge deployment
4. **AWS ECS/Fargate** - Enterprise-grade scaling
5. **Google Cloud Run** - Serverless containers

## Monitoring

Monitor these metrics:
- Agent connection success rate
- Audio latency (target: <1s)
- Gemini API response time
- Convex API call success rate
- WebSocket connection stability

## Troubleshooting

**Agent fails to start:**
- Check FFmpeg is installed: `ffmpeg -version`
- Verify Python version: `python --version` (must be 3.10+)
- Check all environment variables are set

**Audio quality issues:**
- Monitor network latency to Daily servers
- Check Gemini API response times
- Verify VAD settings in agent.py

**Transcript not appearing:**
- Verify CONVEX_URL uses `.convex.site` not `.convex.cloud`
- Check Convex authentication settings
- Review ConversationLogger logs

## Development

Run with debug logging:
```bash
export DEBUG=1
python agent.py
```

This will print detailed information about:
- Frame processing in the pipeline
- Daily room connection status
- Gemini API requests/responses
- Convex HTTP calls
