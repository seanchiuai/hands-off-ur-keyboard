"""
Custom PipeCat processors for product search and conversation logging.

These processors integrate with Convex backend to:
1. Extract product search intents from voice conversations
2. Log conversation transcripts for user history
3. Trigger product searches based on LLM function calls
"""

import time
import httpx
from typing import Any, Dict, Optional

# PipeCat 0.0.90 imports
from pipecat.processors.frame_processor import FrameProcessor
from pipecat.frames.frames import LLMMessagesFrame, Frame


class ProductSearchProcessor(FrameProcessor):
    """
    Extracts product search intents and triggers Convex queries.

    When the LLM calls the search_products function, this processor:
    1. Extracts product attributes from function arguments
    2. Calls Convex HTTP endpoint to search products
    3. Returns results to LLM for natural language response
    """

    def __init__(self, user_id: str, session_id: str, convex_url: str):
        super().__init__()
        self.user_id = user_id
        self.session_id = session_id
        self.convex_url = convex_url.rstrip('/')

    async def process_frame(self, frame, direction):
        """Process frames looking for search_products function calls."""

        # For now, just pass through frames - function calling to be added later
        # TODO: Implement Gemini function calling for product search
        await self.push_frame(frame, direction)
        return frame


class ConversationLogger(FrameProcessor):
    """
    Logs conversation turns to Convex for history and analysis.

    This processor:
    1. Captures all LLM messages (user and agent)
    2. Sends them to Convex for persistent storage
    3. Enables transcript display in the frontend
    """

    def __init__(self, user_id: str, session_id: str, convex_url: str):
        super().__init__()
        self.user_id = user_id
        self.session_id = session_id
        self.convex_url = convex_url.rstrip('/')
        self.logged_messages = set()  # Prevent duplicate logging

    async def _log_to_convex(
        self, speaker: str, text: str, timestamp: int, confidence: Optional[float] = None
    ):
        """Send transcript to Convex."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.convex_url}/addTranscript",
                    json={
                        "sessionId": self.session_id,
                        "speaker": speaker,
                        "text": text,
                        "timestamp": timestamp,
                        "confidence": confidence,
                    },
                    headers={
                        "Content-Type": "application/json",
                    },
                    timeout=5.0,
                )

                if response.status_code != 200:
                    print(f"Failed to log transcript: {response.status_code} - {response.text}")

        except Exception as e:
            print(f"Error logging to Convex: {e}")

    async def process_frame(self, frame, direction):
        """Process frames and log conversation turns."""

        # Log LLM messages to Convex
        if isinstance(frame, LLMMessagesFrame):
            for message in frame.messages:
                role = message.get("role")
                content = message.get("content")

                # Skip system messages and function calls
                if role in ("system", "function") or not content:
                    continue

                # Create unique key to prevent duplicate logging
                message_key = f"{role}:{content[:50]}"
                if message_key in self.logged_messages:
                    continue

                self.logged_messages.add(message_key)

                # Map role to speaker
                speaker = "user" if role == "user" else "agent"
                timestamp = int(time.time() * 1000)

                # Log to Convex (non-blocking)
                await self._log_to_convex(
                    speaker=speaker,
                    text=content,
                    timestamp=timestamp,
                )

                print(f"Logged {speaker} message: {content[:100]}...")

        # Pass frame through
        await self.push_frame(frame, direction)
        return frame
