# Real-time Voice Agent Setup Guide

This guide will help you set up the real-time voice shopping assistant powered by Daily.co, PipeCat, and Gemini Live API.

## Overview

The voice agent enables hands-free product shopping through natural voice conversations. The architecture consists of:

- **Frontend**: Next.js app with Daily React Hooks for WebRTC audio
- **Backend**: Next.js API routes for Daily room creation + Convex for data storage
- **Voice Agent Service**: PipeCat-powered Python service connecting Daily to Gemini Live API

## Prerequisites

### 1. Accounts & API Keys

You need accounts and API keys from the following services:

#### Daily.co (WebRTC Infrastructure)
1. Create account at https://dashboard.daily.co
2. Navigate to Settings → Developers
3. Generate an API key
4. (Optional) Configure domain allowlist for your Next.js domain

#### Google Cloud / Gemini API
1. Create a Google Cloud project at https://console.cloud.google.com
2. Enable the Gemini API
3. Generate an API key at https://aistudio.google.com/app/apikey
4. Verify your quota limits (recommended: Gemini 2.0 Flash)

#### Clerk (Already Configured)
- Authentication is already set up in this project
- Users must be logged in to access voice chat

#### Convex (Already Configured)
- Database schema has been updated with voice-related tables
- HTTP endpoints will be used by the PipeCat agent

### 2. Python Environment (for PipeCat Agent)

The PipeCat voice agent requires:
- Python 3.10 or higher
- FFmpeg for audio processing

#### Install Python 3.10+

**macOS:**
```bash
brew install python@3.11
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install python3.11 python3.11-venv
```

**Windows:**
Download from https://www.python.org/downloads/

#### Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

## Installation Steps

### Step 1: Configure Environment Variables

#### Frontend (.env.local)

Add the Daily API key to your `.env.local` file:

```bash
# Daily.co Configuration
DAILY_API_KEY=your_daily_api_key_here
```

Your existing environment variables should already include:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_GEMINI_API_KEY`

#### PipeCat Agent Service

Create a `.env` file in `services/pipecat/`:

```bash
cd services/pipecat
cp .env.example .env
```

Edit `.env` with:

```bash
# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Convex Backend (use .convex.site for HTTP endpoints)
CONVEX_URL=https://your-deployment.convex.site

# Note: DAILY_ROOM_URL, DAILY_TOKEN, USER_ID, and SESSION_ID
# are passed dynamically when starting each agent instance
```

### Step 2: Install Dependencies

#### Frontend Dependencies (Already Installed)

The following packages have been installed:
- `@daily-co/daily-js`
- `@daily-co/daily-react`

#### PipeCat Agent Dependencies

```bash
cd services/pipecat
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 3: Update Convex Schema

The Convex schema has been updated with the following tables:
- `voiceSessions` - Tracks Daily room sessions
- `voiceTranscripts` - Stores conversation transcripts
- `voiceCommands` - Logs voice commands (existing)

Push the schema to Convex:

```bash
npm run dev:backend
```

Or manually:

```bash
npx convex dev
```

### Step 4: Deploy PipeCat Agent Service

**IMPORTANT:** The PipeCat agent CANNOT run on Vercel due to WebSocket requirements. You must deploy it separately.

#### Option A: Local Development

For testing, run the agent locally:

```bash
cd services/pipecat
source venv/bin/activate

# Set environment variables for a test session
export GEMINI_API_KEY="your_key"
export CONVEX_URL="https://your-deployment.convex.site"
export DAILY_ROOM_URL="https://your-domain.daily.co/room-name"
export DAILY_TOKEN="your_meeting_token"
export USER_ID="clerk_user_id"
export SESSION_ID="convex_session_id"

python agent.py
```

#### Option B: Production Deployment

Deploy to a platform that supports long-running processes:

**Railway (Recommended)**
1. Create a Railway project
2. Add a new service from GitHub
3. Set environment variables
4. Railway will auto-deploy on push

**Render**
1. Create a new Web Service
2. Set build command: `pip install -r requirements.txt`
3. Set start command: `python agent.py`
4. Configure environment variables

**Fly.io**
1. Install flyctl: `brew install flyctl`
2. Create `fly.toml` configuration
3. Deploy: `fly deploy`

**Docker Deployment**

Create `Dockerfile` in `services/pipecat/`:

```dockerfile
FROM python:3.11-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "agent.py"]
```

Build and run:
```bash
docker build -t voice-agent .
docker run --env-file .env voice-agent
```

### Step 5: Configure Agent Startup Webhook

You need a way to start a PipeCat agent instance when a user creates a voice session. Options:

#### Option 1: Manual Start (Testing Only)

Start agent manually with session details from the frontend console.

#### Option 2: HTTP Webhook (Recommended)

Create a simple webhook server that:
1. Receives POST request from Next.js when room is created
2. Spawns agent.py with environment variables
3. Returns success/failure

Example using Flask:

```python
from flask import Flask, request
import subprocess
import os

app = Flask(__name__)

@app.route('/start-agent', methods=['POST'])
def start_agent():
    data = request.json

    env = os.environ.copy()
    env.update({
        'DAILY_ROOM_URL': data['roomUrl'],
        'DAILY_TOKEN': data['token'],
        'USER_ID': data['userId'],
        'SESSION_ID': data['sessionId'],
    })

    subprocess.Popen(['python', 'agent.py'], env=env)

    return {'success': True}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
```

Update `app/api/daily-room/route.ts` to call this webhook after creating the room.

## Testing

### Test Frontend Integration

1. Start the Next.js development server:
```bash
npm run dev
```

2. Navigate to http://localhost:3000/voice

3. Click "Start Voice Chat"

4. Allow microphone access

5. Check browser console for:
   - Daily room creation success
   - WebRTC connection status
   - Session ID

### Test PipeCat Agent

1. Use the Daily room URL and token from the frontend console

2. Start the agent:
```bash
cd services/pipecat
export DAILY_ROOM_URL="room_url_from_console"
export DAILY_TOKEN="token_from_console"
export USER_ID="test_user"
export SESSION_ID="test_session"
python agent.py
```

3. Speak into your microphone

4. Verify:
   - Agent joins the Daily room
   - Audio is processed
   - Transcripts appear in frontend
   - Gemini responses are spoken

## Troubleshooting

### Frontend Issues

**"Failed to create voice chat room"**
- Check `DAILY_API_KEY` is set in `.env.local`
- Verify Daily API key is valid
- Check Daily dashboard for rate limits

**Microphone not working**
- Grant browser microphone permissions
- Check browser console for errors
- Try different browser (Chrome recommended)

**Agent not connecting**
- Check "Waiting for agent..." indicator
- Verify PipeCat agent is running
- Check agent logs for connection errors

### PipeCat Agent Issues

**"Error: PipeCat not installed"**
```bash
pip install pipecat-ai daily-python
```

**"FFmpeg not found"**
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg
```

**"Failed to join Daily room"**
- Verify `DAILY_ROOM_URL` and `DAILY_TOKEN` are correct
- Check network connectivity
- Ensure room hasn't expired (10 minute default)

**"Gemini API error"**
- Verify `GEMINI_API_KEY` is correct
- Check API quota limits
- Use Gemini 2.0 Flash for best latency

**Transcripts not appearing in frontend**
- Use `CONVEX_URL` with `.convex.site` (not `.convex.cloud`)
- Check Convex authentication
- Verify `SESSION_ID` matches Convex session record

### Database Issues

**"Session not found"**
- Ensure Convex schema is deployed
- Check session was created successfully
- Verify user authentication

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Browser                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Next.js Frontend (localhost:3000/voice)           │     │
│  │  - VoiceChat component                             │     │
│  │  - Daily React Hooks                               │     │
│  │  - Real-time transcript display                    │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Daily.co WebRTC Room                            │
│  - Audio streaming                                           │
│  - Low-latency transport                                     │
│  - Cloud recording                                           │
└────────┬───────────────────────────────────────────┬────────┘
         │                                           │
         ▼                                           ▼
┌──────────────────────┐              ┌───────────────────────┐
│  Next.js API Route   │              │  PipeCat Agent        │
│  /api/daily-room     │              │  (Python Service)     │
│  - Create room       │              │  - Daily transport    │
│  - Generate token    │              │  - Gemini Live API    │
│  - Auth check        │              │  - Custom processors  │
└──────┬───────────────┘              └──────────┬────────────┘
       │                                         │
       │                                         │
       ▼                                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    Convex Backend                             │
│  - voiceSessions (room management)                            │
│  - voiceTranscripts (conversation logs)                       │
│  - voiceCommands (intent tracking)                            │
│  - Real-time queries & mutations                              │
└──────────────────────────────────────────────────────────────┘
```

## Features Implemented

✅ Daily.co room creation via Next.js API route
✅ Convex database schema for voice sessions
✅ Frontend voice chat UI with Daily React Hooks
✅ Real-time transcript display
✅ Microphone controls and status indicators
✅ PipeCat voice agent with Gemini Live API
✅ Custom processors for product search and logging
✅ Session management and cleanup
✅ Error handling and user feedback

## Next Steps

1. **Deploy PipeCat Agent** - Choose a deployment platform and set up the agent service
2. **Configure Webhook** - Implement agent startup automation
3. **Add Product Search** - Connect voice commands to product database
4. **Test End-to-End** - Complete a full voice shopping session
5. **Monitor Performance** - Track latency, errors, and user satisfaction

## Resources

- [Daily.co Documentation](https://docs.daily.co/)
- [PipeCat Documentation](https://docs.pipecat.ai/)
- [Gemini Live API](https://ai.google.dev/gemini-api/docs/live)
- [Convex Documentation](https://docs.convex.dev/)
- [Daily React Hooks](https://docs.daily.co/reference/daily-react)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review agent logs for errors
3. Check Convex and Daily dashboards
4. Verify all environment variables are set correctly
