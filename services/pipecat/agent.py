"""
PipeCat Voice Agent for Real-time Voice Shopping - PipeCat 0.0.90

This agent connects Daily's WebRTC audio transport to Gemini Live API
for natural voice conversations about product shopping.

Requirements:
- pipecat-ai[google,daily]
- httpx

Environment Variables:
- DAILY_ROOM_URL: Daily room URL to join
- DAILY_TOKEN: Daily meeting token
- GEMINI_API_KEY: Gemini API key
- CONVEX_URL: Convex deployment URL
- USER_ID: Clerk user ID
- SESSION_ID: Convex voice session ID
"""

import asyncio
import os
import sys
from loguru import logger

# PipeCat 0.0.90 imports
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.transports.daily.transport import DailyTransport, DailyParams
from pipecat.adapters.services.gemini_adapter import GeminiLLMAdapter
from pipecat.frames.frames import LLMMessagesFrame, EndFrame

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

    logger.info(f"Initializing voice agent for user {user_id}...")

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
            vad_audio_passthrough=True,
        ),
    )

    logger.info("Daily transport initialized")

    # Initialize Gemini adapter
    gemini = GeminiLLMAdapter(api_key=gemini_api_key)

    logger.info("Gemini adapter initialized")

    # System prompt for shopping assistant
    system_instruction = """You are a helpful voice shopping assistant.
Users will describe products they want to buy. Your job is to:
1. Ask clarifying questions about product preferences
2. Extract key product attributes (category, color, size, price range, etc.)
3. Help users find the perfect products

Keep responses natural and conversational. Speak concisely - aim for 2-3 sentences.
Be friendly and helpful!"""

    # Custom processor for extracting product search intents
    product_processor = ProductSearchProcessor(
        user_id=user_id, session_id=session_id, convex_url=convex_url
    )

    # Conversation logger saves to Convex
    conversation_logger = ConversationLogger(
        user_id=user_id, session_id=session_id, convex_url=convex_url
    )

    # Build pipeline: Transport → Gemini → Processors → Transport
    pipeline = Pipeline(
        [
            transport.input(),  # Daily audio input
            gemini,  # Gemini Live API
            product_processor,  # Extract product intents
            conversation_logger,  # Log to Convex
            transport.output(),  # Daily audio output
        ]
    )

    logger.info("Pipeline built")

    # Create pipeline task
    task = PipelineTask(pipeline)

    # Set initial context with system instruction
    await task.queue_frame(LLMMessagesFrame([{"role": "system", "content": system_instruction}]))

    logger.info("Agent ready, joining Daily room...")

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
        logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
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

        logger.info("Voice agent started successfully")

        # Create and run the pipeline runner
        runner = PipelineRunner()
        await runner.run(task)

    except KeyboardInterrupt:
        logger.info("Shutting down voice agent...")
    except Exception as e:
        logger.error(f"Agent error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        logger.info("Cleaning up...")
        if "task" in locals():
            await task.queue_frame(EndFrame())
        logger.info("Agent stopped")


if __name__ == "__main__":
    logger.info("Starting PipeCat Voice Agent...")
    asyncio.run(main())
