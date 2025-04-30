// Basic structure for Playwright scraping logic
import { chromium, Browser, Page } from "playwright";
import { ScrapeRequest, ScrapeResponse } from "./types";
import { analyzeContentAndDecideNextAction } from "./llm";

export async function scrapeWebsite(request: ScrapeRequest): Promise<ScrapeResponse> {
  const { url, maxSteps, targetSchema, prompt } = request;
  let browser: Browser | null = null;
  let page: Page | null = null;
  let currentStep = 0;

  try {
    // Initialize browser
    browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();

    try {
      await page.goto(url);
      let currentStep = 0;
      let result: any = null;
      
      while (currentStep < maxSteps) {
        // Get current page content
        const content = await page.content();
        const currentUrl = page.url();

        // Extract information using LLM
        const extractionResult = await extractInformation(content, targetSchema, prompt);
        
        if (extractionResult.success) {
          result = extractionResult.data;
          break;
        }

        // If data not found, ask LLM for next action
        const nextAction = await decideNextAction(content, targetSchema, currentUrl, prompt);
        
        if (!nextAction || !nextAction.action) {
          break;
        }

        // Perform the action
        try {
          await performAction(page, nextAction);
        } catch (error) {
          console.error('Error performing action:', error);
          break;
        }

        currentStep++;
      }

      if (result) {
        return {
          isError: false,
          message: 'Successfully extracted data',
          data: result
        };
      } else {
        return {
          isError: true,
          message: 'Unable to find requested information'
        };
      }

    } finally {
      await context.close();
      await browser.close();
    }
  } catch (error) {
    console.error('Scraping error:', error);
    return {
      isError: true,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

async function extractInformation(
  content: string, 
  schema: Record<string, any>,
  prompt?: string
): Promise<{ success: boolean; data?: any }> {
  // Include the custom prompt in the LLM request if provided
  const customInstructions = prompt ? 
    `\nAdditional instructions: ${prompt}` : 
    '';

  const llmPrompt = `
Extract information from this HTML content according to the following schema:
${JSON.stringify(schema, null, 2)}

${customInstructions}

HTML Content:
${content}

Respond with valid JSON matching the schema. If the required information is not found, respond with { "success": false }.`;

  try {
    // ...existing LLM call code...
    return { success: false }; // Default return if no other return path
  } catch (error) {
    console.error('Error extracting information:', error);
    return { success: false };
  }
}

async function decideNextAction(
  content: string, 
  schema: Record<string, any>, 
  currentUrl: string,
  prompt?: string
): Promise<{ action: string; selector?: string } | null> {
  // Include the custom prompt in the LLM request if provided
  const customInstructions = prompt ? 
    `\nAdditional context: ${prompt}` : 
    '';

  const llmPrompt = `
Analyze this HTML content and determine the next action to find information matching this schema:
${JSON.stringify(schema, null, 2)}

Current URL: ${currentUrl}
${customInstructions}

HTML Content:
${content}

Respond with an action in JSON format:
{
  "action": "click" | "none",
  "selector": "CSS selector to click" // Only if action is "click"
}

If no action is needed or possible, respond with { "action": "none" }.`;

  try {
    // ...existing LLM call code...
    return { action: 'none' }; // Default return if no other return path
  } catch (error) {
    console.error('Error deciding next action:', error);
    return null;
  }
}

async function performAction(page: Page, action: { action: string; selector?: string }) {
  if (action.action === 'click' && action.selector) {
    await page.click(action.selector);
    await page.waitForLoadState('networkidle');
  }
}
