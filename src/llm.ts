// Placeholder for LLM interaction logic
import OpenAI from "openai";
import dotenv from "dotenv";
import {
  TargetSchema,
  LLMAnalysisResult,
  ExtractedPageStructure,
  PageHistory,
} from "./types";
import { getOpenAIConfig } from "./config";

dotenv.config();

// Initialize OpenAI with proxy configuration
const openai = new OpenAI(getOpenAIConfig());

export async function analyzeContentAndDecideNextAction(
  pageStructure: ExtractedPageStructure,
  targetSchema: TargetSchema,
  query: string,
  pageHistory: PageHistory[] = []
): Promise<LLMAnalysisResult> {
  console.log("LLM analyzing content...");

  // Create a summary of previously visited pages
  const historySummary = pageHistory.map((page, index) => `
Page ${index + 1}:
URL: ${page.url}
Title: ${page.title}
Accessed via: ${page.clickedElement || 'Initial page'}
Key information found:
${page.textContent.slice(0, 300)}...
Emails found: ${page.emails.join(', ')}
`).join('\n');

  // Prepare the prompt for the LLM
  const prompt = `
You are an AI assistant specialized in extracting structured information from websites.
Your task is to find information matching the specified schema and determine the best next action.

User Query:
${query}

Instructions:
1. Analyze the target schema to understand what information is needed:
${JSON.stringify(targetSchema, null, 2)}

2. Review the history of previously visited pages and their information:
${historySummary}

3. Now analyze the current page:
   - Check if combining information from previous pages and current page satisfies the query
   - Look for new relevant information in the current page
   - Avoid suggesting navigation to already visited pages
   - Make sure the extracted data matches both the schema AND the user's query intent

4. When suggesting navigation:
   - If it's a link or button, use ONLY the exact ID provided (e.g., "link-0", "button-1")
   - If it's a direct path, start with "/" (e.g., "/contact", "/about")
   - If it's an absolute URL, use the complete URL
   - DO NOT suggest navigation to URLs that appear in the page history

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
  "isDataFound": boolean,  // True if all required information matching the query is found
  "data": object | null,   // The extracted data matching the schema, or null
  "nextActionElementId": string | null,  // ID of link/button to click next, or null if data found
  "reasoning": string  // Brief explanation of why this decision was made
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const llmResponseContent = response.choices[0]?.message?.content;
    if (!llmResponseContent) {
      throw new Error("LLM returned empty content.");
    }

    console.log("LLM Raw Response:", llmResponseContent);

    // Try to extract JSON from the response if it's wrapped in markdown
    let jsonContent = llmResponseContent;
    const jsonMatch = llmResponseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    try {
      const parsedResult: LLMAnalysisResult = JSON.parse(jsonContent);

      // Enhanced validation
      if (typeof parsedResult.isDataFound !== "boolean") {
        throw new Error("Invalid response format: missing or invalid isDataFound property");
      }
      
      if (parsedResult.isDataFound && !parsedResult.data) {
        throw new Error("Invalid response format: isDataFound is true but no data provided");
      }

      if (!parsedResult.isDataFound && 
          typeof parsedResult.nextActionElementId !== "string" && 
          parsedResult.nextActionElementId !== null) {
        throw new Error("Invalid response format: missing or invalid nextActionElementId when no data found");
      }

      return parsedResult;
    } catch (parseError: any) {
      console.error("Failed to parse LLM response:", parseError);
      throw new Error(`Failed to parse LLM response: ${parseError.message}\nRaw response: ${llmResponseContent}`);
    }
  } catch (error: any) {
    console.error("Error interacting with LLM:", error);
    return {
      isError: true,
      message: `LLM Error: ${error.message}`,
      isDataFound: false,
      data: null,
      nextActionElementId: null,
    };
  }
}

export async function determineSchema(query: string): Promise<any> {
  const messages = [
    { 
      role: "system" as const,
      content: `You are a schema generator that converts natural language queries into JSON Schema objects.
Your task is to analyze the user's query and determine what data structure would be most appropriate to store the requested information.
Only respond with a valid JSON Schema object that defines the structure.
Keep the schema focused on the core information requested.` 
    },
    {
      role: "user" as const,
      content: `Given this search query: "${query}"
Generate a JSON Schema that would be appropriate for storing the information being requested.
The schema should be an object type with appropriate properties and required fields.`
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.3,
    });

    const schemaText = response.choices[0]?.message?.content;
    if (!schemaText) {
      throw new Error('No schema generated');
    }
    
    return JSON.parse(schemaText);
  } catch (error) {
    console.error("Error generating schema:", error);
    // Return a basic fallback schema if generation fails
    return {
      type: "object",
      properties: {
        result: { type: "string" }
      },
      required: ["result"]
    };
  }
}
