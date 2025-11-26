// Basic structure for Playwright scraping logic
import { chromium, Browser, Page } from "playwright";
import { ScrapeRequest, ScrapeResponse, PageHistory } from "./types";
import { analyzeContentAndDecideNextAction } from "./llm";
import { sendProgress } from "./server";

export async function scrapeWebsite(
  request: ScrapeRequest,
  scrapeId: string
): Promise<ScrapeResponse> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  let currentStep = 0;
  let pageHistory: PageHistory[] = [];

  try {
    sendProgress(scrapeId, "Launching browser...");
    browser = await chromium.launch();
    const context = await browser.newContext();
    page = await context.newPage();

    sendProgress(scrapeId, `Navigating to ${request.url}...`);
    await page.goto(request.url, { waitUntil: "domcontentloaded" });

    while (currentStep < request.maxSteps) {
      currentStep++;
      sendProgress(scrapeId, `Step ${currentStep}/${request.maxSteps}`);

      // Get page content/structure
      const pageContent = await page.content();
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

        // Enhanced regex for finding email addresses - handles more formats and variations
        const emailRegex =
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
        const emailMatches = textContent.match(emailRegex) || [];

        // Look for email addresses in href attributes of mailto: links
        const mailtoLinks = Array.from(
          document.querySelectorAll('a[href^="mailto:"]')
        );
        const mailtoEmails = mailtoLinks
          .map((link) => {
            const href = link.getAttribute("href") || "";
            const match = href.match(/mailto:([^?&]+)/);
            return match ? match[1] : null;
          })
          .filter((email) => email !== null) as string[]; // Filter out nulls and cast to string[]

        // Combine and remove duplicates
        const emails = Array.from(new Set([...emailMatches, ...mailtoEmails]));

        // Look for contact information in specific elements
        const contactInfoElements = document.querySelectorAll(
          ".contact, .contact-info, .footer, footer"
        );
        let contactText = "";
        contactInfoElements.forEach((el) => {
          contactText += el.textContent + " ";
        });

        return {
          url: document.URL,
          title: document.title,
          links,
          buttons,
          textContent,
          emails,
          contactText,
        };
      });

      // Before passing pageStructure to other functions, ensure emails is string[]
      const safePageStructure = {
        ...pageStructure,
        emails: pageStructure.emails.filter(
          (email): email is string => email !== null
        ),
      };

      // Add current page to history
      pageHistory.push({
        url: safePageStructure.url,
        title: safePageStructure.title,
        textContent: safePageStructure.textContent,
        emails: safePageStructure.emails,
        timestamp: new Date().toISOString(),
        clickedElement:
          pageHistory.length > 0
            ? pageHistory[pageHistory.length - 1].nextActionElementId
            : null,
        nextActionElementId: null, // Will be updated after LLM analysis
      });

      sendProgress(scrapeId, "Analyzing page content with LLM...");
      const analysisResult = await analyzeContentAndDecideNextAction(
        safePageStructure,
        request.targetSchema,
        request.query,
        pageHistory
      );

      // Update the last history entry with the next action
      if (pageHistory.length > 0) {
        pageHistory[pageHistory.length - 1].nextActionElementId =
          analysisResult.nextActionElementId;
      }

      if (analysisResult.isDataFound && analysisResult.data) {
        sendProgress(scrapeId, "Information found successfully!");
        return {
          isError: false,
          message: "Information extracted successfully.",
          data: analysisResult.data,
          history: pageHistory, // Include history in the response
        };
      }

      if (
        !analysisResult.nextActionElementId ||
        currentStep >= request.maxSteps
      ) {
        const message =
          currentStep >= request.maxSteps
            ? `Max steps (${request.maxSteps}) reached without finding the information.`
            : "LLM could not determine a next step or information not found.";
        sendProgress(scrapeId, message);
        return {
          isError: true,
          message: message,
          history: pageHistory, // Include history even in error case
        };
      }

      // Check if we're trying to visit a page we've already been to
      if (analysisResult.nextActionElementId) {
        let nextUrl = "";
        if (analysisResult.nextActionElementId.startsWith("http")) {
          nextUrl = analysisResult.nextActionElementId;
        } else if (analysisResult.nextActionElementId.startsWith("/")) {
          nextUrl = new URL(
            analysisResult.nextActionElementId,
            pageStructure.url
          ).toString();
        } else {
          // For links and buttons, get the target URL if possible
          const linkMatch = analysisResult.nextActionElementId.startsWith(
            "link-"
          )
            ? pageStructure.links[
                parseInt(analysisResult.nextActionElementId.split("-")[1], 10)
              ]
            : null;
          if (linkMatch?.href) {
            nextUrl = new URL(linkMatch.href, pageStructure.url).toString();
          }
        }

        // Check if we've already visited this URL
        if (nextUrl && pageHistory.some((h) => h.url === nextUrl)) {
          sendProgress(scrapeId, `Already visited ${nextUrl}, skipping...`);
          continue;
        }
      }

      // Perform the next action
      sendProgress(
        scrapeId,
        `Navigating to ${analysisResult.nextActionElementId}...`
      );

      // Handle different types of navigation
      if (analysisResult.nextActionElementId.startsWith("link-")) {
        const index = parseInt(
          analysisResult.nextActionElementId.split("-")[1],
          10
        );
        const link = pageStructure.links[index];
        if (link?.href) {
          const elementSelector = `a[href="${link.href}"]:has-text("${link.text}")`;
          try {
            await page.click(elementSelector, { timeout: 5000 });
            await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
          } catch (clickError) {
            sendProgress(scrapeId, `Failed to click link: ${elementSelector}`);
            return {
              isError: true,
              message: `Failed to click element suggested by LLM: ${analysisResult.nextActionElementId}`,
              history: pageHistory, // Include history even in error case
            };
          }
        } else {
          return {
            isError: true,
            message: `LLM suggested clicking an invalid link element: ${analysisResult.nextActionElementId}`,
            history: pageHistory, // Include history even in error case
          };
        }
      } else if (analysisResult.nextActionElementId.startsWith("button-")) {
        const index = parseInt(
          analysisResult.nextActionElementId.split("-")[1],
          10
        );
        const button = pageStructure.buttons[index];
        if (button) {
          const elementSelector = `button:has-text("${button.text}") >> nth=${index}`; // Example selector - might need refinement
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
              history: pageHistory, // Include history even in error case
            };
          }
        } else {
          console.warn(
            `Could not find button for ${analysisResult.nextActionElementId}`
          );
          return {
            isError: true,
            message: `LLM suggested clicking an invalid button element: ${analysisResult.nextActionElementId}`,
            history: pageHistory, // Include history even in error case
          };
        }
      } else if (analysisResult.nextActionElementId.startsWith("/")) {
        const newUrl = new URL(
          analysisResult.nextActionElementId,
          pageStructure.url
        ).toString();
        sendProgress(scrapeId, `Navigating to path: ${newUrl}`);
        try {
          await page.goto(newUrl, {
            waitUntil: "domcontentloaded",
            timeout: 10000,
          });
        } catch (navError) {
          return {
            isError: true,
            message: `Failed to navigate to path: ${analysisResult.nextActionElementId}`,
            history: pageHistory, // Include history even in error case
          };
        }
      } else if (analysisResult.nextActionElementId.startsWith("http")) {
        sendProgress(
          scrapeId,
          `Navigating to URL: ${analysisResult.nextActionElementId}`
        );
        try {
          await page.goto(analysisResult.nextActionElementId, {
            waitUntil: "domcontentloaded",
            timeout: 10000,
          });
        } catch (navError) {
          return {
            isError: true,
            message: `Failed to navigate to URL: ${analysisResult.nextActionElementId}`,
            history: pageHistory, // Include history even in error case
          };
        }
      } else {
        return {
          isError: true,
          message: `LLM suggested clicking an unknown element type: ${analysisResult.nextActionElementId}`,
          history: pageHistory, // Include history even in error case
        };
      }

      await page.waitForTimeout(1000);
    }

    return {
      isError: true,
      message: `Max steps (${request.maxSteps}) reached without finding the information.`,
      history: pageHistory, // Include history even in error case
    };
  } catch (error: any) {
    console.error("Error during scraping process:", error);
    return {
      isError: true,
      message: `Scraping failed: ${error.message}`,
      history: pageHistory, // Include history even in error case
    };
  } finally {
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
      sendProgress(scrapeId, "Browser closed.");
    }
  }
}
