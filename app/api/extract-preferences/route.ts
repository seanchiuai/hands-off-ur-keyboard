import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define structured output schema for preference extraction
const preferenceSchema = {
  type: "object" as const,
  properties: {
    preferences: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          category: {
            type: "string" as const,
            description:
              "Category of preference (material, size, price, color, style, feature, other)",
            enum: [
              "material",
              "size",
              "price",
              "color",
              "style",
              "feature",
              "other",
            ],
          },
          tag: {
            type: "string" as const,
            description: "Specific preference value extracted from conversation",
          },
          value: {
            type: "string" as const,
            description: "Optional structured value for the preference",
          },
          priority: {
            type: "number" as const,
            description: "Priority from 1-10 based on user emphasis",
            minimum: 1,
            maximum: 10,
          },
          productContext: {
            type: "string" as const,
            description: "Optional product type this preference applies to",
          },
        },
        required: ["category", "tag", "priority"],
      },
    },
  },
  required: ["preferences"],
};

export async function POST(req: NextRequest) {
  try {
    // Verify user authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { transcript, conversationHistory } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json(
        { error: "Invalid transcript" },
        { status: 400 }
      );
    }

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not configured");
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    // Use Gemini model with structured output
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseMimeType: "application/json",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        responseSchema: preferenceSchema as any,
      },
    });

    const prompt = `You are a shopping preference extraction assistant. Analyze the following voice transcript from a shopping conversation and extract any user preferences mentioned.

Look for:
- Material preferences (wooden, metal, plastic, etc.)
- Size requirements (dimensions, capacity, etc.)
- Price constraints (under $X, around $Y, etc.)
- Color preferences
- Style preferences (modern, vintage, minimalist, etc.)
- Feature requirements (must have X, needs Y, etc.)

Consider the conversation context to determine priority (1-10) based on:
- Explicit emphasis ("I really need", "must have") = 8-10
- Strong preference ("I prefer", "I like") = 6-8
- Mild preference ("maybe", "ideally") = 4-6
- Mentioned in passing = 1-3

Previous conversation context:
${conversationHistory || "No previous context"}

Current user statement:
"${transcript}"

Extract all preferences as structured tags. If no clear preferences are mentioned, return an empty array.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const extracted = JSON.parse(response);

    // Validate extracted preferences
    if (!extracted.preferences || !Array.isArray(extracted.preferences)) {
      return NextResponse.json(
        { error: "Invalid extraction result" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preferences: extracted.preferences,
    });
  } catch (error) {
    console.error("Preference extraction error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Extraction failed",
      },
      { status: 500 }
    );
  }
}
