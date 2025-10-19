"""
PipeCat Voice Agent for Real-time Voice Shopping

This agent connects Daily's WebRTC audio transport to Gemini Live API
for natural voice conversations about product shopping.

Requirements:
- pipecat-ai
- daily-python
- google-generativeai
- httpx

Environment Variables:
- DAILY_ROOM_URL: Daily room URL to join
- DAILY_TOKEN: Daily meeting token
- GEMINI_API_KEY: Gemini API key
- CONVEX_URL: Convex deployment URL (use .convex.site for HTTP endpoints)
- USER_ID: Clerk user ID
- SESSION_ID: Convex voice session ID
"""

import asyncio
import os
import sys
from typing import Optional

try:
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.task import PipelineTask
    from pipecat.processors.aggregators.llm_response import LLMResponseAggregator
    from pipecat.transports.services.daily import DailyTransport, DailyParams
    from pipecat.services.gemini import GeminiLLMService
    from pipecat.frames.frames import LLMMessagesFrame
except ImportError:
    print("Error: PipeCat not installed. Run: pip install pipecat-ai daily-python")
    sys.exit(1)

# Import custom processors
from processors import ProductSearchProcessor, ConversationLogger


async def create_voice_agent(
    room_url: str,
    token: str,
    user_id: str,
    session_id: str,
    gemini_api_key: str,
    convex_url: str,
):
    """
    Creates a PipeCat voice agent for product shopping conversations.

    Args:
        room_url: Daily room URL to join
        token: Daily meeting token
        user_id: Clerk user ID for conversation context
        session_id: Convex voice session ID
        gemini_api_key: Gemini API key
        convex_url: Convex deployment URL
    """

    print(f"Initializing voice agent for user {user_id}...")

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

    print("Daily transport initialized")

    # Initialize Gemini Live API service
    gemini_service = GeminiLLMService(
        api_key=gemini_api_key,
        model="gemini-2.0-flash-exp",  # Latency-optimized
        params={
            "temperature": 0.7,
            "max_output_tokens": 500,  # Keep responses concise for voice
        },
    )

    print("Gemini service initialized")

    # System prompt for shopping assistant
    system_prompt = """You are a helpful voice shopping assistant.
Users will describe products they want to buy. Your job is to:
1. Ask clarifying questions about product preferences
2. Extract key product attributes (category, color, size, price range, etc.)
3. Confirm understanding before searching

Keep responses natural and conversational. Speak concisely - aim for 2-3 sentences.
When you have enough information, use the search_products function."""

    # Custom processor for extracting product search intents
    product_processor = ProductSearchProcessor(
        user_id=user_id, session_id=session_id, convex_url=convex_url
    )

    # Conversation logger saves to Convex
    conversation_logger = ConversationLogger(
        user_id=user_id, session_id=session_id, convex_url=convex_url
    )

    # LLM response aggregator for handling streaming responses
    aggregator = LLMResponseAggregator()

    # Build pipeline: Audio → Gemini → Product Search → Logger → Audio
    pipeline = Pipeline(
        [
            transport.input_processor(),  # Daily audio input
            gemini_service,  # Gemini Live API
            aggregator,  # Aggregate streaming responses
            product_processor,  # Extract product intents
            conversation_logger,  # Log to Convex
            transport.output_processor(),  # Daily audio output
        ]
    )

    print("Pipeline built")

    # Create pipeline task
    task = PipelineTask(pipeline)

    # Set initial context
    await task.queue_frames([LLMMessagesFrame([{"role": "system", "content": system_prompt}])])

    print("Agent ready, joining Daily room...")

    return transport, task


async def main():
    """Main entry point for the voice agent."""

    # Get configuration from environment
    room_url = os.getenv("DAILY_ROOM_URL")
    token = os.getenv("DAILY_TOKEN")
    user_id = os.getenv("USER_ID")
    session_id = os.getenv("SESSION_ID")
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    convex_url = os.getenv("CONVEX_URL")

    # Validate required environment variables
    required_vars = {
        "DAILY_ROOM_URL": room_url,
        "DAILY_TOKEN": token,
        "USER_ID": user_id,
        "SESSION_ID": session_id,
        "GEMINI_API_KEY": gemini_api_key,
        "CONVEX_URL": convex_url,
    }

    missing_vars = [name for name, value in required_vars.items() if not value]
    if missing_vars:
        print(f"Error: Missing required environment variables: {', '.join(missing_vars)}")
        sys.exit(1)

    try:
        # Create and run the voice agent
        transport, task = await create_voice_agent(
            room_url=room_url,
            token=token,
            user_id=user_id,
            session_id=session_id,
            gemini_api_key=gemini_api_key,
            convex_url=convex_url,
        )

        print("Voice agent started successfully")

        # Run the pipeline
        await task.run()

    except KeyboardInterrupt:
        print("\nShutting down voice agent...")
    except Exception as e:
        print(f"Agent error: {e}")
        import traceback

        traceback.print_exc()
    finally:
        print("Cleaning up...")
        if "transport" in locals():
            await transport.cleanup()
        print("Agent stopped")


if __name__ == "__main__":
    print("Starting PipeCat Voice Agent...")
    asyncio.run(main())
