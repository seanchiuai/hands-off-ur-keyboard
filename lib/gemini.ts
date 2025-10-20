import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const getGeminiClient = () => {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY (or NEXT_PUBLIC_GEMINI_API_KEY) is not configured."
    );
  }
  return new GoogleGenerativeAI(apiKey);
};

const PRICE_RESEARCH_SYSTEM_PROMPT = `You are a price tracking analyst helping users decide when to buy products.
Given price histories, multi-store offers, and review excerpts you produce concise, actionable insights.
Always answer in short paragraphs or bullet lists.`;

/**
 * Summarise review snippets into pros/cons lists.
 */
export async function geminiSummarizeProsCons(texts: string[]) {
  if (!texts.length) {
    return { pros: [], cons: [] };
  }

  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = [
    "Summarise the following customer review snippets into concise pros and cons.",
    "Return JSON in the exact format: {\"pros\": string[], \"cons\": string[]}.",
    "Keep each entry under 12 words. Avoid duplicates.",
    "",
    texts.join("\n---\n"),
  ].join("\n");

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  const text = result.response.text();
  try {
    const parsed = JSON.parse(text ?? "{}");
    return {
      pros: Array.isArray(parsed.pros) ? parsed.pros : [],
      cons: Array.isArray(parsed.cons) ? parsed.cons : [],
    };
  } catch (error) {
    console.error("Failed to parse Gemini pros/cons response", error, text);
    return { pros: [], cons: [] };
  }
}

/**
 * Evaluate offers and recommend the best value pick.
 */
export async function geminiBestOfferReasoning(context: {
  item: {
    title: string;
    brand?: string | null;
  };
  offers: Array<{
    store: string;
    totalCents: number;
    rating?: number;
    inStock: boolean;
    url?: string;
  }>;
  stats?: {
    mean90: number;
    min90: number;
    stdev90: number;
  };
}) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: PRICE_RESEARCH_SYSTEM_PROMPT,
  });

  const prompt = [
    "Evaluate the following offers and recommend the best overall value.",
    "Explain reasoning in <= 3 bullet points. Mention price (converted dollars) and rating.",
    JSON.stringify(context, null, 2),
  ].join("\n\n");

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  return result.response.text();
}

/**
 * Produce a natural-language verdict for the item (buy now, average, wait).
 */
export async function geminiDealVerdict(input: {
  itemTitle: string;
  verdict: "buy_now" | "average" | "wait_for_event";
  currentPriceCents: number;
  stats: {
    mean90: number;
    min90: number;
    stdev90: number;
  };
  fakeSale: boolean;
}) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: PRICE_RESEARCH_SYSTEM_PROMPT,
  });

  const prompt = [
    "Create a short explanation (max 3 sentences) for the following deal verdict.",
    JSON.stringify(input, null, 2),
  ].join("\n\n");

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });

  return result.response.text();
}

/**
 * Legacy voice command helpers (kept for compatibility while the new price
 * tracker is being built). They lightly wrap the new models but keep the same
 * API surface so existing code continues to compile.
 */
const LEGACY_SYSTEM_INSTRUCTION = `You are a voice-controlled product management assistant.
Return structured commands describing whether the user wants to save or remove products by number.`;

export const createVoiceCommandModel = () => {
  const client = getGeminiClient();
  return client.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: LEGACY_SYSTEM_INSTRUCTION,
    tools: [
      {
        functionDeclarations: [
          {
            name: "executeProductCommand",
            description:
              "Execute a save or remove command for one or more products",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                action: { type: SchemaType.STRING },
                productNumbers: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.NUMBER },
                },
                confidence: { type: SchemaType.NUMBER },
              },
              required: ["action", "productNumbers", "confidence"],
            },
          },
        ],
      },
    ],
  });
};

type LegacyCommand = {
  action: "save" | "remove";
  productNumbers: number[];
  confidence: number;
  transcript: string;
};

export const processVoiceCommand = async (
  audioBlob: Blob
): Promise<LegacyCommand> => {
  const model = createVoiceCommandModel();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type,
              data: base64,
            },
          },
        ],
      },
    ],
  });

  const response = result.response;
  const functionCall = response.functionCalls()?.[0];
  if (!functionCall || functionCall.name !== "executeProductCommand") {
    throw new Error("Could not extract product command from voice input");
  }
  const args = functionCall.args as {
    action: string;
    productNumbers: number[];
    confidence: number;
  };

  return {
    action: args.action === "remove" ? "remove" : "save",
    productNumbers: args.productNumbers ?? [],
    confidence: args.confidence ?? 0,
    transcript: response.text() ?? "",
  };
};

export const processTextCommand = async (
  text: string
): Promise<LegacyCommand> => {
  const model = createVoiceCommandModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text }] }],
  });
  const response = result.response;
  const functionCall = response.functionCalls()?.[0];
  if (!functionCall || functionCall.name !== "executeProductCommand") {
    throw new Error("Could not extract product command from text input");
  }

  const args = functionCall.args as {
    action: string;
    productNumbers: number[];
    confidence: number;
  };

  return {
    action: args.action === "remove" ? "remove" : "save",
    productNumbers: args.productNumbers ?? [],
    confidence: args.confidence ?? 0,
    transcript: text,
  };
};
