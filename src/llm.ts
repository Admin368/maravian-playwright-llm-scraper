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
You are an AI assistant specialized in extracting structured information from websites.
Your task is to find information matching the specified schema and determine the best next action.

Instructions:
1. Analyze the target schema to understand what information is needed:
${JSON.stringify(targetSchema, null, 2)}

2. First check if the required information is already available:
   - Look for email addresses in the 'emails' array
   - Check if any email matches the required format and context
   - For contact emails, prefer business/company emails over personal ones

3. If information is not found, examine the page content:
   - Check the text content for relevant information
   - Look for links and buttons that might lead to the information
   - Use the element IDs provided (link-N or button-N) for navigation
   - For direct page navigation, use the path (e.g., "/contact")

4. When suggesting navigation:
   - If it's a link or button, use ONLY the exact ID provided (e.g., "link-0", "button-1")
   - If it's a direct path, start with "/" (e.g., "/contact", "/about")
   - If it's an absolute URL, use the complete URL

Current page information:
URL: ${pageStructure.url}
Title: ${pageStructure.title}

Found email addresses:
${pageStructure.emails.map((email) => `- ${email}`).join("\n")}

Available links:
${pageStructure.links
  .map((l) => `- ID: ${l.id}, Text: "${l.text}" (${l.href})`)
  .join("\n")}

Available buttons:
${pageStructure.buttons
  .map((b) => `- ID: ${b.id}, Text: "${b.text}"`)
  .join("\n")}

Page text content:
${pageStructure.textContent}

Respond in JSON format with this structure:
{
  "isDataFound": boolean,  // True if all required information is found
  "data": object | null,   // The extracted data matching the schema, or null
  "nextActionElementId": string | null  // ID of link/button to click next, or null if data found
}

If you find all required information, return it in the "data" field. If not, suggest the most promising link to follow using its exact ID or path.
`;

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
