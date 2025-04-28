// Basic structure for Playwright scraping logic
import { chromium, Browser, Page } from "playwright";
import { ScrapeRequest, ScrapeResponse } from "./types";
import { analyzeContentAndDecideNextAction } from "./llm";

export async function scrapeWebsite(
  request: ScrapeRequest
): Promise<ScrapeResponse> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let currentStep = 0;

  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();

    console.log(`Navigating to ${request.url}...`);
    await page.goto(request.url, { waitUntil: "domcontentloaded" }); // Start with initial URL

    while (currentStep < request.maxSteps) {
      currentStep++;
      console.log(`Step ${currentStep}/${request.maxSteps}`);

      // 1. Get page content/structure (simplified for now)
      const pageContent = await page.content(); // Consider getting more structured data
      const pageStructure = await page.evaluate(() => {
        // Extract links and interactive elements
        const links = Array.from(document.querySelectorAll("a[href]")).map(
          (a, index) => ({
            id: `link-${index}`,
            text: a.textContent?.trim(),
            href: a.getAttribute("href"),
          })
        );
        const buttons = Array.from(document.querySelectorAll("button")).map(
          (btn, index) => ({
            id: `button-${index}`,
            text: btn.textContent?.trim(),
          })
        );

        // Extract text content from the page
        const textContent = document.body.innerText;

        // Extract email addresses from the page
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emailMatches = textContent.match(emailRegex) || [];
        const emails = Array.from(new Set(emailMatches)); // Remove duplicates

        return {
          url: document.URL,
          title: document.title,
          links,
          buttons,
          textContent,
          emails,
        };
      });

      console.log("Sending content to LLM for analysis...");
      // 2. Feed to LLM for analysis
      const analysisResult = await analyzeContentAndDecideNextAction(
        pageStructure, // Send structured data instead of raw HTML
        request.targetSchema
      );

      if (analysisResult.isDataFound && analysisResult.data) {
        console.log("LLM found the requested information.");
        return {
          isError: false,
          message: "Information extracted successfully.",
          data: analysisResult.data,
        };
      }

      if (
        !analysisResult.nextActionElementId ||
        currentStep >= request.maxSteps
      ) {
        console.log("LLM decided no further action or max steps reached.");
        const message =
          currentStep >= request.maxSteps
            ? `Max steps (${request.maxSteps}) reached without finding the information.`
            : "LLM could not determine a next step or information not found.";
        return {
          isError: true,
          message: message,
        };
      }

      // 3. Perform the next action (Clicking)
      console.log(
        `LLM suggested clicking element ID: ${analysisResult.nextActionElementId}`
      );
      const selector = `[data-llm-id="${analysisResult.nextActionElementId}"]`; // We need a way to map LLM ID back to selector

      // *** We need to add unique IDs to elements for the LLM to reference ***
      // For now, let's assume the LLM gives back an ID we assigned during extraction (like link-0, button-1)
      let elementSelector = "";
      if (analysisResult.nextActionElementId.startsWith("link-")) {
        const index = parseInt(
          analysisResult.nextActionElementId.split("-")[1],
          10
        );
        const link = pageStructure.links[index];
        if (link?.href) {
          // Attempt to find a unique selector for the link
          elementSelector = `a[href="${link.href}"]:has-text("${link.text}")`; // Example selector - might need refinement
          console.log(`Attempting to click link: ${elementSelector}`);
          try {
            await page.click(elementSelector, { timeout: 5000 });
            await page.waitForLoadState("domcontentloaded", { timeout: 10000 }); // Wait for navigation
          } catch (clickError) {
            console.error(
              `Failed to click link selector: ${elementSelector}`,
              clickError
            );
            return {
              isError: true,
              message: `Failed to click element suggested by LLM: ${analysisResult.nextActionElementId}`,
            };
          }
        } else {
          console.warn(
            `Could not find href for ${analysisResult.nextActionElementId}`
          );
          return {
            isError: true,
            message: `LLM suggested clicking an invalid link element: ${analysisResult.nextActionElementId}`,
          };
        }
      } else if (analysisResult.nextActionElementId.startsWith("button-")) {
        const index = parseInt(
          analysisResult.nextActionElementId.split("-")[1],
          10
        );
        const button = pageStructure.buttons[index];
        if (button) {
          elementSelector = `button:has-text("${button.text}") >> nth=${index}`; // Example selector - might need refinement
          console.log(`Attempting to click button: ${elementSelector}`);
          try {
            await page.click(elementSelector, { timeout: 5000 });
            await page.waitForLoadState("domcontentloaded", { timeout: 10000 }); // Wait for potential content change
          } catch (clickError) {
            console.error(
              `Failed to click button selector: ${elementSelector}`,
              clickError
            );
            return {
              isError: true,
              message: `Failed to click element suggested by LLM: ${analysisResult.nextActionElementId}`,
            };
          }
        } else {
          console.warn(
            `Could not find button for ${analysisResult.nextActionElementId}`
          );
          return {
            isError: true,
            message: `LLM suggested clicking an invalid button element: ${analysisResult.nextActionElementId}`,
          };
        }
      } else if (analysisResult.nextActionElementId.startsWith("/")) {
        // Handle direct paths
        const newUrl = new URL(
          analysisResult.nextActionElementId,
          pageStructure.url
        ).toString();
        console.log(`Navigating to path: ${newUrl}`);
        try {
          await page.goto(newUrl, {
            waitUntil: "domcontentloaded",
            timeout: 10000,
          });
        } catch (navError) {
          console.error(`Failed to navigate to: ${newUrl}`, navError);
          return {
            isError: true,
            message: `Failed to navigate to path: ${analysisResult.nextActionElementId}`,
          };
        }
      } else if (analysisResult.nextActionElementId.startsWith("http")) {
        // Handle absolute URLs
        console.log(`Navigating to URL: ${analysisResult.nextActionElementId}`);
        try {
          await page.goto(analysisResult.nextActionElementId, {
            waitUntil: "domcontentloaded",
            timeout: 10000,
          });
        } catch (navError) {
          console.error(
            `Failed to navigate to: ${analysisResult.nextActionElementId}`,
            navError
          );
          return {
            isError: true,
            message: `Failed to navigate to URL: ${analysisResult.nextActionElementId}`,
          };
        }
      } else {
        console.warn(
          `LLM suggested clicking unknown element type: ${analysisResult.nextActionElementId}`
        );
        return {
          isError: true,
          message: `LLM suggested clicking an unknown element type: ${analysisResult.nextActionElementId}`,
        };
      }

      // Add delay or wait for specific network activity if needed
      await page.waitForTimeout(1000); // Simple delay
    }

    // If loop finishes without returning, max steps were reached.
    return {
      isError: true,
      message: `Max steps (${request.maxSteps}) reached without finding the information.`,
    };
  } catch (error: any) {
    console.error("Error during scraping process:", error);
    return {
      isError: true,
      message: `Scraping failed: ${error.message}`,
    };
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
      console.log("Browser closed.");
    }
  }
}
