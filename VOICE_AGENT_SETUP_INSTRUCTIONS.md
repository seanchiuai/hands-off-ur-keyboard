# Voice Agent Setup Instructions

## Current Status

✅ **Working:**
- Next.js frontend with Daily.co room creation
- Convex backend
- Orchestrator service running
- All API keys configured

❌ **Not Working:**
- Voice agent startup due to PipeCat API version mismatch

## The Problem

The voice agent code was written for an older version of PipeCat, but version 0.0.90 is installed, which has:
1. Different import paths (`LLMResponseAggregator` → `LLMFullResponseAggregator`)
2. Different service locations (`pipecat.services.gemini` → `pipecat.services.gemini_multimodal_live.gemini`)
3. Additional dependencies (google-cloud-speech, google-cloud-texttospeech)
4. Deprecated modules (Daily transport moved)

## Quick Solutions (Choose One)

### Option 1: Downgrade PipeCat (Recommended for Testing)

```bash
cd pipecat-voice-agent
source venv/bin/activate
pip uninstall pipecat-ai -y
pip install pipecat-ai==0.0.40
pip install google-generativeai
```

### Option 2: Use OpenAI Realtime API Instead

OpenAI's Realtime API is more stable and well-documented:

```bash
# Install openai
pip install openai

# Update .env with OpenAI key
echo "OPENAI_API_KEY=your_key_here" >> .env
```

Then modify `voice_agent.py` to use OpenAI instead of Gemini.

### Option 3: Manual Agent Testing

Skip the orchestrator and run the agent manually:

```bash
cd pipecat-voice-agent
source venv/bin/activate

# Set environment variables
export DAILY_ROOM_URL="get_from_browser_console"
export DAILY_TOKEN="get_from_browser_console"
export SESSION_ID="test-session"

# Run agent directly
python voice_agent.py
```

##  Recommended Next Steps

1. **For quick testing**: Try Option 1 (downgrade PipeCat)
2. **For production**: Consider Option 2 (OpenAI Realtime API is more stable)
3. **For debugging**: Use Option 3 to test manually

## Files Fixed So Far

✅ Fixed TypeScript build errors in:
- `components/SearchProductsGrid.tsx`
- `components/VoiceChat.tsx`
- `components/VoiceShoppingPanel.tsx`

✅ Fixed orchestrator port mismatch:
- `.env.local`: Changed port from 8001 → 8000

✅ Installed dependencies:
- `google-genai`
- `google-cloud-speech`

## Testing Checklist

Once the voice agent is fixed:

1. [ ] Start orchestrator: `python orchestrator.py`
2. [ ] Start Next.js: `npm run dev`
3. [ ] Click microphone button
4. [ ] Check for "Agent Connected" message
5. [ ] Speak and verify transcripts appear

## Support

If you continue having issues, the problem is specifically with the PipeCat library version mismatch. The recommended path forward is to either:
- Use the working `/services/pipecat/` setup (if it has a compatible environment)
- Or switch to OpenAI Realtime API which has better stability
