import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define function calling schema for refinement detection
const refinementFunctions = [
  {
    name: "refine_product_search",
    description:
      "Refine the current product search based on user request for changes",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        refinementType: {
          type: SchemaType.STRING,
          format: "enum" as const,
          enum: [
            "price_lower",
            "price_higher",
            "add_feature",
            "remove_feature",
            "change_size",
            "cheaper",
            "custom",
          ],
          description: "Type of refinement requested",
        },
        refinementValue: {
          type: SchemaType.STRING,
          description:
            "Specific value for the refinement (e.g., price amount, feature name, size specification)",
        },
        targetPercentage: {
          type: SchemaType.NUMBER,
          description:
            "For price refinements, percentage change requested (e.g., 20 for 20% cheaper)",
        },
        extractedPreferences: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.STRING,
          },
          description: "List of preference tags extracted from the refinement request",
        },
      },
      required: ["refinementType", "refinementValue", "extractedPreferences"],
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { voiceCommand, currentSearchContext } = await req.json();

    if (!voiceCommand) {
      return NextResponse.json(
        { error: "Missing voice command" },
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

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ functionDeclarations: refinementFunctions as any }],
    });

    const prompt = `You are analyzing a user's voice command to determine if they want to refine their product search.

Current search context:
${JSON.stringify(currentSearchContext, null, 2)}

User's voice command:
"${voiceCommand}"

Common refinement patterns:
- "Find cheaper options" / "Show me something less expensive" → price_lower
- "I want better quality" / "Show premium options" → price_higher
- "Make it bigger" / "I need larger" → change_size (increase)
- "Show smaller versions" → change_size (decrease)
- "Must have [feature]" / "Add [feature]" → add_feature
- "Without [feature]" / "Remove [feature]" → remove_feature
- "Show me wooden ones" / "Filter by material" → add_feature

Determine if this is a refinement request and call the appropriate function with extracted preferences.`;

    const result = await model.generateContent(prompt);
    const response = result.response;

    // Check if function was called
    const functionCalls = response.functionCalls();
    const functionCall = functionCalls?.[0];

    if (!functionCall) {
      return NextResponse.json({
        isRefinement: false,
        message: "No refinement detected",
      });
    }

    const args = functionCall.args as {
      refinementType: string;
      refinementValue: string;
      targetPercentage?: number;
      extractedPreferences?: string[];
    };

    return NextResponse.json({
      isRefinement: true,
      refinement: {
        type: args.refinementType,
        value: args.refinementValue,
        targetPercentage: args.targetPercentage,
        extractedPreferences: args.extractedPreferences || [],
      },
    });
  } catch (error) {
    console.error("Refinement analysis error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
      },
      { status: 500 }
    );
  }
}
