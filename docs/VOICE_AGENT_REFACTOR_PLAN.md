# Voice Agent Backend Refactoring Plan

## Overview

This plan outlines the refactoring of the voice agent backend to match the proven architecture from the gemini-pipecat-workshop. The current implementation uses outdated PipeCat patterns and services. We'll refactor to use the modern Gemini Multimodal Live API with proper Daily transport integration.

## Current State Analysis

### Current Architecture Issues

1. **Outdated Gemini Service**
   - Currently using: `GeminiLLMService` (text-based)
   - Should use: `GeminiMultimodalLiveLLMService` (native audio support)
   - Impact: Current implementation doesn't support real-time audio streaming

2. **Missing VAD Configuration**
   - No proper Voice Activity Detection setup
   - Missing `SileroVADAnalyzer` with `VADParams`
   - Impact: Poor quality audio detection and turn-taking

3. **Improper Pipeline Structure**
   - Missing `OpenAILLMContext` for conversation management
   - No context aggregator for handling streaming responses
   - Missing proper pipeline frame flow
   - Impact: Can't maintain conversation context properly

4. **No Function/Tool Registration**
   - Current implementation has no tools registered
   - Should have product search, save product, etc.
   - Impact: Voice agent can't take actions

5. **Missing Event Handlers**
   - No `on_client_connected` handler
   - No `on_client_disconnected` handler
   - Impact: Can't properly initialize conversation or cleanup

6. **Incorrect Pipeline Runner Pattern**
   - Direct task.run() instead of using PipelineRunner
   - Missing PipelineParams configuration
   - Impact: Less robust execution model

7. **Missing Room Creation Helper**
   - No daily_runner.py equivalent
   - Room creation logic embedded in API route
   - Impact: Harder to test agent independently

### Current File Structure

```
/pipecat-voice-agent/
├── voice_agent.py          # Main agent (outdated patterns)
├── orchestrator.py         # FastAPI orchestrator (needs updating)
├── .env                    # Environment config
└── venv/                   # Virtual environment

/services/pipecat/
└── agent.py                # Service layer (outdated)
```

## Target Architecture (From Workshop)

### Workshop Pattern

```python
# Key components from gemini-pipecat-workshop/quickstart/gemini-bot.py:

1. DailyTransport with proper VAD:
   transport = DailyTransport(
       room_url,
       token,
       "Pipecat",
       params=DailyParams(
           audio_in_enabled=True,
           audio_out_enabled=True,
           vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.5)),
       ),
   )

2. Gemini Multimodal Live Service:
   llm = GeminiMultimodalLiveLLMService(
       api_key=os.getenv("GOOGLE_API_KEY"),
       system_instruction=system_instruction,
       tools=tools,
   )

3. Function Registration:
   llm.register_function("function_name", handler_function)

4. Context Management:
   context = OpenAILLMContext([{"role": "user", "content": "Say hello."}])
   context_aggregator = llm.create_context_aggregator(context)

5. Proper Pipeline:
   pipeline = Pipeline([
       transport.input(),
       context_aggregator.user(),
       llm,
       transport.output(),
       context_aggregator.assistant(),
   ])

6. Pipeline Task with Params:
   task = PipelineTask(
       pipeline,
       params=PipelineParams(
           allow_interruptions=True,
           enable_metrics=True,
           enable_usage_metrics=True,
       ),
   )

7. Event Handlers:
   @transport.event_handler("on_client_connected")
   async def on_client_connected(transport, client):
       await task.queue_frames([context_aggregator.user().get_context_frame()])

   @transport.event_handler("on_client_disconnected")
   async def on_client_disconnected(transport, client):
       await task.cancel()

8. Pipeline Runner:
   runner = PipelineRunner()
   await runner.run(task)
```

### Workshop File Structure

```
/gemini-pipecat-workshop/quickstart/
├── daily_runner.py         # Daily room creation helper
├── gemini-bot.py           # Main bot with proper patterns
├── requirements.txt        # Dependencies
└── .env                    # Configuration
```

## Refactoring Steps

### Step 1: Update Requirements
**File:** `/pipecat-voice-agent/requirements.txt`

**Changes:**
```txt
# Current
pipecat-ai
daily-python
google-generativeai
httpx

# New (match workshop)
python-dotenv
pipecat-ai[daily,google,silero]
```

**Why:**
- Need silero extras for VAD support
- Need google extras for Gemini Live API
- Add python-dotenv for better env management

### Step 2: Create Daily Runner Helper
**File:** `/pipecat-voice-agent/daily_runner.py` (NEW)

**Purpose:**
- Extract Daily room creation logic
- Make it reusable for testing
- Match workshop pattern

**Implementation:**
```python
import argparse
import os
import aiohttp
from pipecat.transports.services.helpers.daily_rest import (
    DailyRESTHelper,
    DailyRoomParams,
)

async def configure(aiohttp_session: aiohttp.ClientSession):
    """Create Daily room and return (room_url, token)"""
    parser = argparse.ArgumentParser(description="Daily AI SDK Bot Sample")
    parser.add_argument("-k", "--apikey", type=str, required=False)
    args, unknown = parser.parse_known_args()

    key = args.apikey or os.getenv("DAILY_API_KEY")
    if not key:
        raise Exception("No Daily API key specified")

    daily_rest_helper = DailyRESTHelper(
        daily_api_key=key,
        daily_api_url=os.getenv("DAILY_API_URL", "https://api.daily.co/v1"),
        aiohttp_session=aiohttp_session,
    )

    room = await daily_rest_helper.create_room(DailyRoomParams())
    if not room.url:
        raise Exception("Failed to create Daily room")

    token = await daily_rest_helper.get_token(room.url)
    if not token:
        raise Exception(f"Failed to create Daily room token")

    return (room.url, token)
```

### Step 3: Define Voice Agent Tools/Functions
**File:** `/pipecat-voice-agent/tools.py` (NEW)

**Purpose:**
- Define product search functions
- Define save/remove product functions
- Handle function callbacks

**Implementation:**
```python
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams
import httpx
import os

# Function handlers
async def search_products(params: FunctionCallParams):
    """Search for products based on voice query"""
    convex_url = os.getenv("CONVEX_URL")

    async with httpx.AsyncClient() as client:
        result = await client.post(
            f"{convex_url}/searchProductsByVoice",
            json={
                "query": params.arguments["query"],
                "category": params.arguments.get("category"),
                "priceRange": params.arguments.get("priceRange"),
            }
        )
        products = result.json()

        # Return results to LLM
        await params.result_callback({
            "products": products,
            "count": len(products),
        })

async def save_product(params: FunctionCallParams):
    """Save a product by number from search results"""
    convex_url = os.getenv("CONVEX_URL")
    user_id = params.arguments["userId"]

    async with httpx.AsyncClient() as client:
        await client.post(
            f"{convex_url}/saveProductByNumber",
            json={
                "userId": user_id,
                "productNumber": params.arguments["productNumber"],
            }
        )

        await params.result_callback({
            "success": True,
            "message": f"Product {params.arguments['productNumber']} saved"
        })

async def remove_product(params: FunctionCallParams):
    """Remove a saved product by number"""
    convex_url = os.getenv("CONVEX_URL")
    user_id = params.arguments["userId"]

    async with httpx.AsyncClient() as client:
        await client.post(
            f"{convex_url}/removeProductByNumber",
            json={
                "userId": user_id,
                "productNumber": params.arguments["productNumber"],
            }
        )

        await params.result_callback({
            "success": True,
            "message": f"Product {params.arguments['productNumber']} removed"
        })

# Function schemas
search_function = FunctionSchema(
    name="search_products",
    description="Search for products based on user's voice query",
    properties={
        "query": {
            "type": "string",
            "description": "The product search query extracted from user's voice input",
        },
        "category": {
            "type": "string",
            "description": "Product category (optional)",
        },
        "priceRange": {
            "type": "string",
            "description": "Price range like 'under $100' or '$50-$150' (optional)",
        },
    },
    required=["query"],
)

save_function = FunctionSchema(
    name="save_product",
    description="Save a product from search results by its number",
    properties={
        "productNumber": {
            "type": "number",
            "description": "The number of the product to save (1-based index)",
        },
        "userId": {
            "type": "string",
            "description": "The user ID",
        },
    },
    required=["productNumber", "userId"],
)

remove_function = FunctionSchema(
    name="remove_product",
    description="Remove a saved product by its number",
    properties={
        "productNumber": {
            "type": "number",
            "description": "The number of the product to remove",
        },
        "userId": {
            "type": "string",
            "description": "The user ID",
        },
    },
    required=["productNumber", "userId"],
)

# Tools schema
tools = ToolsSchema(
    standard_tools=[search_function, save_function, remove_function],
)
```

### Step 4: Refactor Main Voice Agent
**File:** `/pipecat-voice-agent/voice_agent.py` (MAJOR REFACTOR)

**Key Changes:**
1. Replace `GeminiLLMService` with `GeminiMultimodalLiveLLMService`
2. Add proper VAD with `SileroVADAnalyzer`
3. Add `OpenAILLMContext` and context aggregator
4. Implement proper pipeline with context flow
5. Add event handlers for client lifecycle
6. Use `PipelineRunner` instead of direct task.run()
7. Register tool functions
8. Add proper PipelineParams

**Full Implementation:**
```python
import asyncio
import os
import aiohttp
from datetime import datetime
from dotenv import load_dotenv
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.services.gemini_multimodal_live.gemini import (
    GeminiMultimodalLiveLLMService,
)
from pipecat.transports.services.daily import DailyParams, DailyTransport

from tools import (
    tools,
    search_products,
    save_product,
    remove_product,
)

load_dotenv(override=True)

# System instruction for voice shopping assistant
system_instruction = """
You are a helpful voice shopping assistant for a product search platform.

Your capabilities:
1. search_products: Search for products based on user voice queries
2. save_product: Save a product by its number from search results
3. remove_product: Remove a saved product

Guidelines:
- Ask clarifying questions to understand what the user is looking for
- Extract key product attributes (category, color, size, price range)
- When you have enough information, use search_products function
- Announce how many products were found
- Help users save products by number (e.g., "save product 3")
- Keep responses natural and conversational
- Speak concisely - aim for 2-3 sentences maximum
- Confirm actions after executing them
"""

async def create_voice_agent(
    room_url: str,
    token: str,
    user_id: str,
    session_id: str,
):
    """
    Creates a PipeCat voice agent for product shopping.

    Args:
        room_url: Daily room URL to join
        token: Daily meeting token
        user_id: User ID for conversation context
        session_id: Voice session ID
    """

    logger.info(f"Initializing voice agent for user {user_id}, session {session_id}")

    # Configure Daily transport with proper VAD
    transport = DailyTransport(
        room_url,
        token,
        "Voice Shopping Agent",
        params=DailyParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(
                params=VADParams(
                    stop_secs=0.5,  # Half-second pause detection
                )
            ),
        ),
    )

    logger.info("Daily transport configured")

    # Configure Gemini Multimodal Live service
    llm = GeminiMultimodalLiveLLMService(
        api_key=os.getenv("GOOGLE_API_KEY"),
        system_instruction=system_instruction,
        tools=tools,
    )

    logger.info("Gemini Multimodal Live service configured")

    # Register function handlers
    llm.register_function("search_products", search_products)
    llm.register_function("save_product", save_product)
    llm.register_function("remove_product", remove_product)

    logger.info("Functions registered")

    # Create conversation context
    context = OpenAILLMContext(
        [
            {
                "role": "user",
                "content": "Say hello and introduce yourself as a voice shopping assistant."
            }
        ],
    )

    # Create context aggregator for streaming responses
    context_aggregator = llm.create_context_aggregator(context)

    logger.info("Context initialized")

    # Build pipeline with proper frame flow
    pipeline = Pipeline(
        [
            transport.input(),           # Daily audio input
            context_aggregator.user(),   # Aggregate user input
            llm,                         # Gemini Live API processing
            transport.output(),          # Daily audio output
            context_aggregator.assistant(),  # Aggregate assistant output
        ]
    )

    logger.info("Pipeline built")

    # Create pipeline task with configuration
    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,      # Allow user to interrupt
            enable_metrics=True,           # Track performance
            enable_usage_metrics=True,     # Track API usage
        ),
    )

    logger.info("Pipeline task created")

    # Event handler: Client connected
    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"Client connected: {client}")
        # Initialize conversation with greeting
        await task.queue_frames([context_aggregator.user().get_context_frame()])

    # Event handler: Client disconnected
    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected: {client}")
        # Cancel the pipeline task
        await task.cancel()

    logger.info("Event handlers registered")

    return transport, task


async def main():
    """Main entry point for voice agent"""

    logger.info("Starting Voice Shopping Agent...")

    # Get configuration from environment
    room_url = os.getenv("DAILY_ROOM_URL")
    token = os.getenv("DAILY_TOKEN")
    user_id = os.getenv("USER_ID")
    session_id = os.getenv("SESSION_ID")

    # Validate required variables
    required_vars = {
        "DAILY_ROOM_URL": room_url,
        "DAILY_TOKEN": token,
        "USER_ID": user_id,
        "SESSION_ID": session_id,
        "GOOGLE_API_KEY": os.getenv("GOOGLE_API_KEY"),
        "CONVEX_URL": os.getenv("CONVEX_URL"),
    }

    missing_vars = [name for name, value in required_vars.items() if not value]
    if missing_vars:
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
        return

    try:
        # Create voice agent
        transport, task = await create_voice_agent(
            room_url=room_url,
            token=token,
            user_id=user_id,
            session_id=session_id,
        )

        logger.info("Voice agent created successfully")

        # Create pipeline runner
        runner = PipelineRunner()

        logger.info("Starting pipeline...")

        # Run the pipeline
        await runner.run(task)

        logger.info("Pipeline completed")

    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Agent error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        logger.info("Agent stopped")


if __name__ == "__main__":
    asyncio.run(main())
```

### Step 5: Update Orchestrator
**File:** `/pipecat-voice-agent/orchestrator.py`

**Changes:**
- Add proper logging
- Update environment variable handling
- Add health check endpoint
- Improve error handling

**Implementation:**
```python
import asyncio
import os
import subprocess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from loguru import logger

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SessionRequest(BaseModel):
    room_url: str
    token: str
    user_id: str
    session_id: str

# Track running agent processes
running_agents = {}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "active_agents": len(running_agents),
    }

@app.post("/start-agent")
async def start_agent(request: SessionRequest):
    """Start a voice agent for a session"""
    try:
        logger.info(f"Starting agent for session {request.session_id}")

        # Prepare environment variables
        env = os.environ.copy()
        env.update({
            "DAILY_ROOM_URL": request.room_url,
            "DAILY_TOKEN": request.token,
            "USER_ID": request.user_id,
            "SESSION_ID": request.session_id,
        })

        # Start agent process
        process = subprocess.Popen(
            ["python", "voice_agent.py"],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # Track the process
        running_agents[request.session_id] = {
            "process": process,
            "user_id": request.user_id,
            "room_url": request.room_url,
        }

        logger.info(f"Agent started for session {request.session_id}")

        return {
            "status": "started",
            "session_id": request.session_id,
        }

    except Exception as e:
        logger.error(f"Failed to start agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stop-agent/{session_id}")
async def stop_agent(session_id: str):
    """Stop a voice agent"""
    if session_id in running_agents:
        logger.info(f"Stopping agent for session {session_id}")

        agent_info = running_agents[session_id]
        process = agent_info["process"]

        # Terminate the process
        process.terminate()

        # Wait for termination
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            logger.warning(f"Agent didn't terminate, killing process")
            process.kill()

        # Remove from tracking
        del running_agents[session_id]

        logger.info(f"Agent stopped for session {session_id}")

        return {"status": "stopped"}

    logger.warning(f"Agent not found for session {session_id}")
    return {"status": "not_found"}

@app.get("/agents")
async def list_agents():
    """List all running agents"""
    return {
        "agents": [
            {
                "session_id": session_id,
                "user_id": info["user_id"],
                "room_url": info["room_url"],
            }
            for session_id, info in running_agents.items()
        ]
    }

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Voice Agent Orchestrator...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Step 6: Update Environment Configuration
**File:** `/pipecat-voice-agent/.env.example`

**Changes:**
```bash
# Daily Configuration
DAILY_API_KEY=your_daily_api_key_here
DAILY_API_URL=https://api.daily.co/v1

# Google Gemini API
GOOGLE_API_KEY=your_google_api_key_here

# Convex Backend
CONVEX_URL=https://your-deployment.convex.site

# Session-specific (passed at runtime)
# DAILY_ROOM_URL=
# DAILY_TOKEN=
# USER_ID=
# SESSION_ID=
```

### Step 7: Update Integration in Next.js
**File:** `app/api/daily-room/route.ts`

**Changes:**
- Add orchestrator webhook call
- Handle agent startup errors
- Return agent status

**Implementation:**
```typescript
// After creating room and session, start the agent
try {
  const orchestratorUrl = process.env.ORCHESTRATOR_URL || "http://localhost:8000";

  const agentResponse = await fetch(`${orchestratorUrl}/start-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      room_url: room.url,
      token: token,
      user_id: userId,
      session_id: sessionId,
    }),
  });

  if (!agentResponse.ok) {
    console.error("Failed to start voice agent:", await agentResponse.text());
  }
} catch (error) {
  console.error("Error starting voice agent:", error);
  // Don't fail the request if agent startup fails
}
```

## Testing Plan

### Unit Testing
1. Test Daily room creation helper
2. Test function callbacks independently
3. Test tool schema definitions

### Integration Testing
1. Test full pipeline with mock Daily transport
2. Test event handlers
3. Test context aggregation

### End-to-End Testing
1. Start orchestrator locally
2. Create voice session from frontend
3. Verify agent joins room
4. Test voice interaction
5. Test product search function
6. Test save/remove functions
7. Verify transcripts in Convex

## Migration Checklist

- [ ] Step 1: Update requirements.txt
- [ ] Step 2: Install new dependencies (`pip install -r requirements.txt`)
- [ ] Step 3: Create daily_runner.py
- [ ] Step 4: Create tools.py with function definitions
- [ ] Step 5: Refactor voice_agent.py with new patterns
- [ ] Step 6: Update orchestrator.py
- [ ] Step 7: Update .env.example
- [ ] Step 8: Test agent standalone with mock data
- [ ] Step 9: Update API route to call orchestrator
- [ ] Step 10: Test full integration end-to-end
- [ ] Step 11: Update documentation
- [ ] Step 12: Deploy to production

## Breaking Changes

1. **API Changes:**
   - Orchestrator now expects `user_id` in addition to previous params
   - Response format includes agent status

2. **Environment Variables:**
   - `GEMINI_API_KEY` renamed to `GOOGLE_API_KEY` (matches workshop)
   - New required: `DAILY_API_URL` (optional, has default)

3. **Dependencies:**
   - Requires `pipecat-ai[daily,google,silero]` instead of separate packages
   - Adds `python-dotenv` dependency

## Rollback Plan

If issues arise:
1. Keep old voice_agent.py as voice_agent.py.backup
2. Can switch orchestrator to use backup file
3. Frontend doesn't need changes (API contract same)
4. Revert requirements.txt if dependency issues

## Success Metrics

After refactoring, we should see:
- [ ] Faster audio response times (Gemini Live is lower latency)
- [ ] Better turn-taking (proper VAD)
- [ ] Working function calls (product search, save, remove)
- [ ] Proper conversation context maintenance
- [ ] Cleaner agent lifecycle management
- [ ] Better error handling and logging

## Timeline

- **Step 1-2:** 30 minutes (dependencies)
- **Step 3:** 1 hour (daily_runner.py + tools.py)
- **Step 4:** 2 hours (voice_agent.py refactor)
- **Step 5:** 30 minutes (orchestrator updates)
- **Step 6-7:** 30 minutes (env and API route)
- **Testing:** 2 hours
- **Documentation:** 1 hour

**Total Estimated Time:** 7-8 hours

## Notes

- This refactoring brings the voice agent in line with current PipeCat best practices
- The workshop pattern is proven and production-ready
- Main benefits: native audio support, proper VAD, function calling, better context management
- After refactoring, the agent will be much more maintainable and extensible

## References

- Workshop code: `~/Desktop/gemini-pipecat-workshop/quickstart/`
- PipeCat docs: https://docs.pipecat.ai/
- Gemini Live API: https://ai.google.dev/gemini-api/docs/live
- Daily.co API: https://docs.daily.co/
