// Placeholder for LLM interaction logic
import OpenAI from "openai";
import dotenv from "dotenv";
import {
  TargetSchema,
  LLMAnalysisResult,
  ExtractedPageStructure,
} from "./types";
import { getOpenAIConfig } from "./config";

dotenv.config();

// Initialize OpenAI with proxy configuration
const openai = new OpenAI(getOpenAIConfig());

export async function analyzeContentAndDecideNextAction(
  pageStructure: ExtractedPageStructure,
  targetSchema: TargetSchema
): Promise<LLMAnalysisResult> {
  console.log("LLM analyzing content...");

  // Prepare the prompt for the LLM
  const prompt = `
You are an AI assistant that MUST return ONLY valid JSON matching the specified structure - no other text.
Your task is to find information matching a schema and determine navigation actions.

INPUT SCHEMA:
${JSON.stringify(targetSchema, null, 2)}

RULES:
1. Data extraction:
   - Match schema types exactly
   - For email fields: Check 'emails' array
   - For text fields: Search page content
   - For arrays: Find lists/tables
   - For nested objects: Get all required props
   - Prefer business emails over personal

2. Navigation priority:
   - Direct paths (/contact, /about)
   - Relevant anchor text
   - Nav menu items
   - Generic promising links

PAGE INFO:
URL: ${pageStructure.url}
Title: ${pageStructure.title}

Emails: ${pageStructure.emails.join(", ")}

Links:
${pageStructure.links
    .map((l) => `${l.id}: "${l.text}" (${l.href})`)
    .join("\n")}

Buttons:
${pageStructure.buttons
    .map((b) => `${b.id}: "${b.text}"`)
    .join("\n")}

Content:
${pageStructure.textContent}

REQUIRED: Return ONLY a JSON object with this structure, no other text:
{
  "isDataFound": boolean,    // true if ALL required data found
  "data": object | null,     // complete data or null
  "nextActionElementId": string | null  // link-N/button-N/path or null
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4", // Using GPT-4 for better accuracy
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1, // Very low temperature for consistent results
    });

    const llmResponseContent = response.choices[0]?.message?.content;
    if (!llmResponseContent) {
      throw new Error("LLM returned empty content.");
    }

    console.log("LLM Raw Response:", llmResponseContent);

    // Parse the LLM response
    const parsedResult: LLMAnalysisResult = JSON.parse(llmResponseContent);

    // Enhanced validation
    if (
      typeof parsedResult.isDataFound !== "boolean" ||
      (parsedResult.isDataFound && !parsedResult.data) ||
      (!parsedResult.isDataFound &&
        typeof parsedResult.nextActionElementId !== "string" &&
        parsedResult.nextActionElementId !== null)
    ) {
      console.error("LLM response format is invalid:", parsedResult);
      return {
        isDataFound: false,
        data: null,
        nextActionElementId: parsedResult.nextActionElementId,
      };
    }

    return parsedResult;
  } catch (error: any) {
    console.error("Error interacting with LLM:", error);
    return {
      isDataFound: false,
      data: null,
      nextActionElementId: null,
    };
  }
}
