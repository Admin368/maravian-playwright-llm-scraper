// Placeholder for LLM interaction logic
import OpenAI from "openai";
import dotenv from "dotenv";
import {
  TargetSchema,
  LLMAnalysisResult,
  ExtractedPageStructure,
} from "./types";

dotenv.config();

// Ensure you have OPENAI_API_KEY in your .env file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Placeholder function - needs actual implementation
export async function analyzeContentAndDecideNextAction(
  pageStructure: ExtractedPageStructure,
  targetSchema: TargetSchema
): Promise<LLMAnalysisResult> {
  console.log("LLM analyzing content...");

  // Prepare the prompt for the LLM
  // This needs significant refinement based on the LLM's capabilities
  const prompt = `
You are an AI assistant helping to extract structured information from a web page.
The user wants to find information matching this schema:
${JSON.stringify(targetSchema, null, 2)}

Here is the current page structure and interactive elements:
URL: ${pageStructure.url}
Title: ${pageStructure.title}
Links:
${pageStructure.links
  .map((l) => `- ID: ${l.id}, Text: ${l.text}, Href: ${l.href}`)
  .join("\n")}
Buttons:
${pageStructure.buttons.map((b) => `- ID: ${b.id}, Text: ${b.text}`).join("\n")}

Based ONLY on the information presented above:
1. Does the current page structure contain the information needed to fulfill the user's target schema?
2. If yes, extract the information and format it exactly according to the schema.
3. If no, which single element (provide its ID, e.g., 'link-5' or 'button-2') is the MOST likely to lead to the required information if clicked? Choose only one.
4. If no relevant element can be identified, indicate that.

Respond in JSON format with the following structure:
{
  "isDataFound": boolean, // True if the data matching the schema was found on the current page
  "data": object | null, // The extracted data matching the schema, or null
  "nextActionElementId": string | null // The ID of the element to click next (e.g., "link-1", "button-0"), or null if data found or no action possible
}
`;

  try {
    // This is a placeholder call - the actual API call and model choice will vary
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Or your preferred model
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }, // Use JSON mode if available
      temperature: 0.2, // Lower temperature for more deterministic responses
    });

    const llmResponseContent = response.choices[0]?.message?.content;
    if (!llmResponseContent) {
      throw new Error("LLM returned empty content.");
    }

    console.log("LLM Raw Response:", llmResponseContent);

    // Parse the LLM response
    const parsedResult: LLMAnalysisResult = JSON.parse(llmResponseContent);

    // Basic validation of the parsed result (can be expanded)
    if (
      typeof parsedResult.isDataFound !== "boolean" ||
      (parsedResult.isDataFound && typeof parsedResult.data !== "object") ||
      (!parsedResult.isDataFound &&
        typeof parsedResult.nextActionElementId !== "string" &&
        parsedResult.nextActionElementId !== null)
    ) {
      console.error("LLM response format is invalid:", parsedResult);
      throw new Error("LLM response format is invalid.");
    }

    return parsedResult;
  } catch (error: any) {
    console.error("Error interacting with LLM:", error);
    // Return a default error state
    return {
      isDataFound: false,
      data: null,
      nextActionElementId: null, // Indicate failure to decide
    };
  }
}
