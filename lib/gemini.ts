import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Initialize Gemini API client
const getGeminiClient = () => {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not configured. Please add it to .env.local");
  }
  return new GoogleGenerativeAI(apiKey);
};

// System instruction for product management
const SYSTEM_INSTRUCTION = `You are a voice-controlled product management assistant.
Your role is to extract user intent and product numbers from voice commands.

Valid commands:
- "save product [number]" or "add item [number]" or "save [number]"
- "remove product [number]" or "delete item [number]" or "remove [number]"
- "save products [number], [number], and [number]" for multiple items
- "remove items [number] and [number]" for multiple items

Extract: { action: "save" | "remove", productNumbers: number[], confidence: number }

Product numbers are always positive integers (1, 2, 3, etc.).
If the command is unclear or doesn't match the pattern, return a low confidence score.`;

// Initialize Gemini model with function calling
export const createVoiceCommandModel = () => {
  const genAI = getGeminiClient();

  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.1, // Low temperature for deterministic command extraction
      topK: 1,
      topP: 0.8,
    },
    tools: [{
      functionDeclarations: [{
        name: "executeProductCommand",
        description: "Execute a save or remove command for one or more products",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            action: {
              type: SchemaType.STRING,
              description: "The action to perform: 'save' or 'remove'",
            },
            productNumbers: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.NUMBER,
              },
              description: "Array of product numbers referenced in the voice command (1-indexed)",
            },
            confidence: {
              type: SchemaType.NUMBER,
              description: "Confidence score from 0-1 for the extracted command",
            },
          },
          required: ["action", "productNumbers", "confidence"],
        },
      }],
    }],
  });

  return model;
};

// Process voice command and extract structured data
export const processVoiceCommand = async (audioBlob: Blob): Promise<{
  action: "save" | "remove";
  productNumbers: number[];
  confidence: number;
  transcript: string;
}> => {
  try {
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

    // Debug logging
    console.log("Gemini response:", {
      text: response.text(),
      functionCalls: response.functionCalls(),
      candidates: response.candidates,
    });

    const functionCall = response.functionCalls()?.[0];

    if (!functionCall || functionCall.name !== "executeProductCommand") {
      console.error("No valid function call found. Response:", response.text());
      throw new Error("Could not extract product command from voice input. Please try saying 'save product 1' or 'remove product 2'");
    }

    const args = functionCall.args as {
      action: string;
      productNumbers: number[];
      confidence: number;
    };

    // Validate action
    if (args.action !== "save" && args.action !== "remove") {
      throw new Error(`Invalid action: ${args.action}. Must be 'save' or 'remove'`);
    }

    // Validate product numbers
    if (!args.productNumbers || args.productNumbers.length === 0) {
      throw new Error("No product numbers extracted from command");
    }

    // Validate all numbers are positive integers
    const invalidNumbers = args.productNumbers.filter(
      (num) => !Number.isInteger(num) || num <= 0
    );
    if (invalidNumbers.length > 0) {
      throw new Error(`Invalid product numbers: ${invalidNumbers.join(", ")}`);
    }

    // Get transcript for user feedback
    const transcript = response.text() || "Voice command processed";

    return {
      action: args.action as "save" | "remove",
      productNumbers: args.productNumbers,
      confidence: args.confidence,
      transcript,
    };
  } catch (error) {
    console.error("Error processing voice command:", error);
    throw error;
  }
};

// Alternative: Process text command (for testing without audio)
export const processTextCommand = async (text: string): Promise<{
  action: "save" | "remove";
  productNumbers: number[];
  confidence: number;
  transcript: string;
}> => {
  try {
    const model = createVoiceCommandModel();

    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [{ text }],
      }],
    });

    const response = result.response;

    // Debug logging
    console.log("Gemini text response:", {
      text: response.text(),
      functionCalls: response.functionCalls(),
      candidates: response.candidates,
    });

    const functionCall = response.functionCalls()?.[0];

    if (!functionCall || functionCall.name !== "executeProductCommand") {
      console.error("No valid function call found. Response:", response.text());
      throw new Error("Could not extract product command from text input. Please try 'save product 1' or 'remove product 2'");
    }

    const args = functionCall.args as {
      action: string;
      productNumbers: number[];
      confidence: number;
    };

    // Validate action
    if (args.action !== "save" && args.action !== "remove") {
      throw new Error(`Invalid action: ${args.action}. Must be 'save' or 'remove'`);
    }

    // Validate product numbers
    if (!args.productNumbers || args.productNumbers.length === 0) {
      throw new Error("No product numbers extracted from command");
    }

    return {
      action: args.action as "save" | "remove",
      productNumbers: args.productNumbers,
      confidence: args.confidence,
      transcript: text,
    };
  } catch (error) {
    console.error("Error processing text command:", error);
    throw error;
  }
};
