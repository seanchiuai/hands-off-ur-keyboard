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

try:
    from pipecat.processors.frame_processor import FrameProcessor
    from pipecat.frames.frames import LLMMessagesFrame, FunctionCallFrame
except ImportError:
    print("Error: PipeCat not installed. Run: pip install pipecat-ai")
    import sys
    sys.exit(1)


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

    async def process_frame(self, frame):
        """Process frames looking for search_products function calls."""

        # Check if LLM called search_products function
        if isinstance(frame, FunctionCallFrame):
            if frame.function_name == "search_products":
                print(f"Product search triggered: {frame.arguments}")

                # Extract product attributes from function args
                attributes = frame.arguments

                try:
                    # Call Convex mutation to search products
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            f"{self.convex_url}/searchProducts",
                            json={
                                "userId": self.user_id,
                                "sessionId": self.session_id,
                                "attributes": attributes,
                            },
                            headers={
                                "Content-Type": "application/json",
                            },
                            timeout=10.0,
                        )

                        if response.status_code == 200:
                            results = response.json()
                            print(f"Search results: {len(results.get('products', []))} products found")

                            # Return results to LLM for natural language response
                            return LLMMessagesFrame([
                                {
                                    "role": "function",
                                    "name": "search_products",
                                    "content": str(results),
                                }
                            ])
                        else:
                            print(f"Search failed: {response.status_code} - {response.text}")
                            # Return error to LLM
                            return LLMMessagesFrame([
                                {
                                    "role": "function",
                                    "name": "search_products",
                                    "content": "Sorry, I couldn't search for products right now. Please try again.",
                                }
                            ])

                except Exception as e:
                    print(f"Error calling Convex search: {e}")
                    # Return error to LLM
                    return LLMMessagesFrame([
                        {
                            "role": "function",
                            "name": "search_products",
                            "content": "Sorry, I encountered an error while searching. Please try again.",
                        }
                    ])

        # Pass through other frames unchanged
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

    async def process_frame(self, frame):
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

        return frame
