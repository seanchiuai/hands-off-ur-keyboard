---
name: agent-voice-product-management
description: Voice-controlled product save/remove functionality using Gemini API with Convex mutations
model: inherit
color: purple
tech_stack:
  framework: Next.js
  database: Convex
  auth: Clerk
  provider: Gemini API
generated: 2025-10-18T00:00:00Z
documentation_sources: [
  "https://ai.google.dev/gemini-api/docs",
  "https://docs.convex.dev/",
  "https://clerk.com/docs",
  "https://nextjs.org/docs"
]
---

# Agent: Voice-Controlled Product Management Implementation with Gemini API

---

## Agent Overview

**Purpose** – This agent enables users to manage their saved products through natural voice commands processed by the Gemini API. Users can reference products by number (e.g., "save product 3" or "remove item 5") and the system will execute the corresponding Convex mutations to update their saved products list in real-time. The agent handles voice input processing, intent recognition, product number extraction, and state management through authenticated database operations.

**Tech Stack** – Next.js, Convex, Clerk, Gemini API, TypeScript, React Hooks

**Source** – Gemini API documentation for voice processing, Convex documentation for mutations and real-time updates, Clerk for authentication flow

---

## Critical Implementation Knowledge

### Gemini API Latest Updates 🚨

* Gemini 2.0 Flash Experimental supports real-time audio streaming for low-latency voice interactions
* Function calling is now available in streaming mode, enabling real-time intent extraction
* Multimodal input processing allows combining voice with visual product references
* System instructions can be configured per session for consistent product management behavior
* Token limits: 1M input tokens, 8K output tokens for Gemini 2.0 Flash

### Common Pitfalls & Solutions 🚨

* **Pitfall**: Voice commands contain ambiguous product references ("that one", "the last one")
  **Solution**: Maintain conversation context and map relative references to absolute product numbers using session state

* **Pitfall**: Concurrent voice commands cause race conditions in product save/remove operations
  **Solution**: Implement optimistic updates with conflict resolution and use Convex's atomic mutations

* **Pitfall**: Network latency between voice processing and database updates creates poor UX
  **Solution**: Use Gemini's streaming API for immediate feedback and Convex subscriptions for real-time state sync

* **Pitfall**: Users speak product numbers unclearly or use natural language ("the red shoes")
  **Solution**: Implement fuzzy matching and clarification prompts when confidence is low

* **Pitfall**: Authentication tokens expire during long voice sessions
  **Solution**: Implement token refresh logic and graceful session handling with Clerk

### Best Practices 🚨

* **DO** use Gemini's system instructions to define strict product reference formats
* **DO** implement client-side optimistic updates for instant visual feedback
* **DO** validate product numbers exist before executing mutations
* **DO** use Convex indexes for fast user-scoped product lookups
* **DO** provide audio confirmation feedback after successful operations
* **DON'T** process voice commands without user authentication verification
* **DON'T** store raw audio data; process and discard immediately
* **DON'T** allow product mutations without explicit user confirmation for bulk operations
* **DON'T** assume product numbers are sequential; always validate against current product list

---

## Implementation Steps

### Architecture Overview

The voice-controlled product management system follows a three-layer architecture: (1) Frontend voice capture using Web Audio API, (2) Gemini API processing layer for intent extraction and product number identification, and (3) Convex backend for authenticated mutations and real-time state synchronization. Voice input flows through Gemini's streaming API, which extracts structured commands (action: save/remove, productId: number) and triggers corresponding Convex mutations secured by Clerk authentication.

### Backend Implementation

* **convex/schema.ts** – Defines savedProducts table with userId, productId, productDetails, and timestamps with proper indexing
* **convex/products.ts** – Mutations for saveProduct and removeProduct with user authentication checks and optimistic update support
* **convex/products.ts** – Queries for getUserSavedProducts and getProductById for real-time subscriptions
* **convex/voiceCommands.ts** – Action to validate voice commands and route to appropriate mutations
* **convex/http.ts** – HTTP endpoint for Gemini webhook callbacks if using async processing

### Frontend Integration

* **app/components/VoiceProductManager.tsx** – Main component handling voice input capture and command execution
* **app/hooks/useVoiceCommands.ts** – Custom hook integrating Gemini API streaming with Web Audio API
* **app/hooks/useProductMutations.ts** – React hook wrapping Convex mutations with optimistic updates
* **app/components/ProductList.tsx** – Real-time product list display with voice command visual feedback
* **app/lib/gemini.ts** – Gemini API client configuration with function calling setup

---

## Code Patterns

### `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  savedProducts: defineTable({
    userId: v.string(), // Clerk user ID
    productId: v.string(), // Product identifier from main product catalog
    productNumber: v.number(), // Display number for voice commands (1-indexed)
    productName: v.string(), // Product name for confirmation
    productDetails: v.optional(v.object({
      imageUrl: v.string(),
      price: v.number(),
      category: v.string(),
    })),
    savedAt: v.number(), // Timestamp for ordering
    lastModified: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_product", ["userId", "productId"])
    .index("by_user_and_number", ["userId", "productNumber"]),

  products: defineTable({
    name: v.string(),
    description: v.string(),
    price: v.number(),
    category: v.string(),
    imageUrl: v.string(),
    inStock: v.boolean(),
  })
    .index("by_category", ["category"]),
});
```

This schema ensures fast user-scoped lookups and supports product number-based voice commands through the `by_user_and_number` index.

### `convex/products.ts`

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Save product with voice command support
export const saveProduct = mutation({
  args: {
    productId: v.string(),
    productNumber: v.number(), // Voice reference number
  },
  handler: async (ctx, args) => {
    // Verify authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: User must be authenticated");
    }

    const userId = identity.subject;

    // Check if already saved
    const existing = await ctx.db
      .query("savedProducts")
      .withIndex("by_user_and_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    if (existing) {
      // Update existing entry's number if changed
      await ctx.db.patch(existing._id, {
        productNumber: args.productNumber,
        lastModified: Date.now(),
      });
      return { success: true, action: "updated", productId: args.productId };
    }

    // Fetch product details
    const product = await ctx.db
      .query("products")
      .filter((q) => q.eq(q.field("_id"), args.productId))
      .first();

    if (!product) {
      throw new Error(`Product ${args.productId} not found`);
    }

    // Create new saved product entry
    const savedId = await ctx.db.insert("savedProducts", {
      userId,
      productId: args.productId,
      productNumber: args.productNumber,
      productName: product.name,
      productDetails: {
        imageUrl: product.imageUrl,
        price: product.price,
        category: product.category,
      },
      savedAt: Date.now(),
      lastModified: Date.now(),
    });

    return {
      success: true,
      action: "saved",
      productId: args.productId,
      savedId
    };
  },
});

// Remove product by number (voice command)
export const removeProductByNumber = mutation({
  args: { productNumber: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized: User must be authenticated");
    }

    const userId = identity.subject;

    // Find product by number
    const savedProduct = await ctx.db
      .query("savedProducts")
      .withIndex("by_user_and_number", (q) =>
        q.eq("userId", userId).eq("productNumber", args.productNumber)
      )
      .first();

    if (!savedProduct) {
      throw new Error(`No saved product found with number ${args.productNumber}`);
    }

    // Delete the saved product
    await ctx.db.delete(savedProduct._id);

    return {
      success: true,
      action: "removed",
      productNumber: args.productNumber,
      productName: savedProduct.productName
    };
  },
});

// Get all saved products for user (real-time subscription)
export const getUserSavedProducts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;

    return await ctx.db
      .query("savedProducts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});
```

These mutations handle authentication, prevent duplicates, and provide detailed response data for voice confirmation feedback.

### `app/lib/gemini.ts`

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

// System instruction for product management
const SYSTEM_INSTRUCTION = `You are a voice-controlled product management assistant.
Your role is to extract user intent and product numbers from voice commands.

Valid commands:
- "save product [number]" or "add item [number]"
- "remove product [number]" or "delete item [number]"

Extract: { action: "save" | "remove", productNumber: number }

If unclear, ask for clarification. Product numbers are always positive integers.`;

// Initialize Gemini model with function calling
export const createVoiceCommandModel = () => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.1, // Low temperature for deterministic command extraction
      topK: 1,
      topP: 0.8,
    },
    tools: [{
      functionDeclarations: [{
        name: "executeProductCommand",
        description: "Execute a save or remove command for a product",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              enum: ["save", "remove"],
              description: "The action to perform on the product",
            },
            productNumber: {
              type: "number",
              description: "The product number referenced in the voice command (1-indexed)",
            },
            confidence: {
              type: "number",
              description: "Confidence score from 0-1 for the extracted command",
            },
          },
          required: ["action", "productNumber", "confidence"],
        },
      }],
    }],
  });

  return model;
};

// Process voice command and extract structured data
export const processVoiceCommand = async (audioBlob: Blob): Promise<{
  action: "save" | "remove";
  productNumber: number;
  confidence: number;
  transcript: string;
}> => {
  const model = createVoiceCommandModel();

  // Convert blob to base64
  const arrayBuffer = await audioBlob.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString('base64');

  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [{
        inlineData: {
          mimeType: audioBlob.type,
          data: base64Audio,
        },
      }],
    }],
  });

  const response = result.response;
  const functionCall = response.functionCalls()?.[0];

  if (!functionCall || functionCall.name !== "executeProductCommand") {
    throw new Error("Could not extract product command from voice input");
  }

  const args = functionCall.args as {
    action: "save" | "remove";
    productNumber: number;
    confidence: number;
  };

  // Get transcript for user feedback
  const transcript = response.text() || "Voice command processed";

  return {
    ...args,
    transcript,
  };
};
```

This Gemini integration uses function calling to extract structured commands with confidence scores for validation.

### `app/hooks/useVoiceCommands.ts`

```typescript
import { useState, useCallback, useRef } from "react";
import { processVoiceCommand } from "@/lib/gemini";

export const useVoiceCommands = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
      setError(null);
    } catch (err) {
      setError("Microphone access denied");
      console.error("Error accessing microphone:", err);
    }
  }, []);

  const stopListening = useCallback(async (): Promise<{
    action: "save" | "remove";
    productNumber: number;
    confidence: number;
  } | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        try {
          // Process with Gemini
          const result = await processVoiceCommand(audioBlob);
          setTranscript(result.transcript);

          // Validate confidence threshold
          if (result.confidence < 0.7) {
            setError("Low confidence - please repeat command");
            resolve(null);
            return;
          }

          resolve(result);
        } catch (err) {
          setError("Failed to process voice command");
          console.error("Voice processing error:", err);
          resolve(null);
        } finally {
          setIsListening(false);
          // Clean up stream
          mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
  };
};
```

This hook manages Web Audio API integration with automatic cleanup and confidence-based validation.

### `app/components/VoiceProductManager.tsx`

```typescript
"use client";

import { useVoiceCommands } from "@/hooks/useVoiceCommands";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export const VoiceProductManager = () => {
  const { isListening, transcript, error, startListening, stopListening } = useVoiceCommands();
  const [feedback, setFeedback] = useState<string>("");

  const saveProduct = useMutation(api.products.saveProduct);
  const removeProduct = useMutation(api.products.removeProductByNumber);

  const handleVoiceCommand = async () => {
    if (isListening) {
      // Stop and process
      const result = await stopListening();

      if (!result) {
        setFeedback("Could not understand command");
        return;
      }

      try {
        if (result.action === "save") {
          await saveProduct({
            productId: `product-${result.productNumber}`, // Map number to ID
            productNumber: result.productNumber,
          });
          setFeedback(`Product ${result.productNumber} saved!`);
        } else {
          const response = await removeProduct({
            productNumber: result.productNumber,
          });
          setFeedback(`${response.productName} removed!`);
        }
      } catch (err) {
        setFeedback(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    } else {
      // Start listening
      await startListening();
      setFeedback("Listening...");
    }
  };

  return (
    <div className="voice-manager">
      <button
        onClick={handleVoiceCommand}
        className={`voice-button ${isListening ? "listening" : ""}`}
        aria-label={isListening ? "Stop listening" : "Start voice command"}
      >
        {isListening ? "🎤 Stop" : "🎤 Voice Command"}
      </button>

      {transcript && (
        <div className="transcript">
          <strong>You said:</strong> {transcript}
        </div>
      )}

      {feedback && (
        <div className="feedback">
          {feedback}
        </div>
      )}

      {error && (
        <div className="error">
          {error}
        </div>
      )}
    </div>
  );
};
```

This component provides immediate visual feedback and handles the complete voice command flow with error handling.

---

## Testing & Debugging

* **Gemini API Playground** – Test voice command extraction at https://aistudio.google.com with sample audio files
* **Convex Dashboard** – Monitor mutation execution, view logs, and inspect real-time data changes
* **Browser DevTools** – Use Media Recorder API debugging in Chrome/Firefox for audio capture issues
* **Unit Tests** – Test `processVoiceCommand` with pre-recorded audio samples for various command formats
* **Integration Tests** – Validate complete flow from audio input through mutation execution with test user accounts
* **Confidence Threshold Testing** – Analyze false positive/negative rates at different confidence levels (0.5-0.9)
* **Network Tab** – Monitor Gemini API request/response times and Convex WebSocket connections
* **Voice Command Log** – Implement logging for all voice commands with timestamps and success/failure rates

---

## Environment Variables

### Frontend (.env.local)
```bash
# Gemini API for voice processing
NEXT_PUBLIC_GEMINI_API_KEY=AIza*********************

# Convex backend
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# Clerk authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_*********************
```

### Backend (Convex Dashboard)
```bash
# Clerk JWT validation
CLERK_JWT_ISSUER_DOMAIN=https://your-app.clerk.accounts.dev

# Optional: Gemini API for server-side processing
GEMINI_API_KEY=AIza*********************
```

---

## Success Metrics

* Voice command recognition accuracy > 90% for clear audio input
* End-to-end latency < 2 seconds from voice stop to database update confirmation
* Real-time UI updates appear within 500ms of mutation completion via Convex subscriptions
* Zero unauthorized product mutations (100% authentication enforcement)
* Confidence threshold correctly filters ambiguous commands (false positive rate < 5%)
* Product save/remove operations execute atomically without data corruption
* User can successfully manage 20+ products by voice without errors
* Voice session handles token refresh gracefully without interruption
* Audio data is immediately discarded after processing (no storage persistence)
* Clear error messages for unsupported commands with suggested alternatives
