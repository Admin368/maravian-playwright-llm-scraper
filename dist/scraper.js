"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeWebsite = scrapeWebsite;
// Basic structure for Playwright scraping logic
const playwright_1 = require("playwright");
const llm_1 = require("./llm");
const server_1 = require("./server");
async function scrapeWebsite(request, scrapeId) {
    let browser = null;
    let page = null;
    let currentStep = 0;
    let pageHistory = [];
    try {
        (0, server_1.sendProgress)(scrapeId, "Launching browser...");
        browser = await playwright_1.chromium.launch();
        const context = await browser.newContext();
        page = await context.newPage();
        (0, server_1.sendProgress)(scrapeId, `Navigating to ${request.url}...`);
        await page.goto(request.url, { waitUntil: "domcontentloaded" });
        while (currentStep < request.maxSteps) {
            currentStep++;
            (0, server_1.sendProgress)(scrapeId, `Step ${currentStep}/${request.maxSteps}`);
            // Get page content/structure
            const pageContent = await page.content();
            const pageStructure = await page.evaluate(() => {
                // Extract links and interactive elements
                const links = Array.from(document.querySelectorAll("a[href]")).map((a, index) => ({
                    id: `link-${index}`,
                    text: a.textContent?.trim(),
                    href: a.getAttribute("href"),
                }));
                const buttons = Array.from(document.querySelectorAll("button")).map((btn, index) => ({
                    id: `button-${index}`,
                    text: btn.textContent?.trim(),
                }));
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
            // Add current page to history
            pageHistory.push({
                url: pageStructure.url,
                title: pageStructure.title,
                textContent: pageStructure.textContent,
                emails: pageStructure.emails,
                timestamp: new Date().toISOString(),
                clickedElement: pageHistory.length > 0 ? pageHistory[pageHistory.length - 1].nextActionElementId : null,
                nextActionElementId: null // Will be updated after LLM analysis
            });
            (0, server_1.sendProgress)(scrapeId, "Analyzing page content with LLM...");
            const analysisResult = await (0, llm_1.analyzeContentAndDecideNextAction)(pageStructure, request.targetSchema, request.query, pageHistory);
            // Update the last history entry with the next action
            if (pageHistory.length > 0) {
                pageHistory[pageHistory.length - 1].nextActionElementId = analysisResult.nextActionElementId;
            }
            if (analysisResult.isDataFound && analysisResult.data) {
                (0, server_1.sendProgress)(scrapeId, "Information found successfully!");
                return {
                    isError: false,
                    message: "Information extracted successfully.",
                    data: analysisResult.data,
                    history: pageHistory // Include history in the response
                };
            }
            if (!analysisResult.nextActionElementId || currentStep >= request.maxSteps) {
                const message = currentStep >= request.maxSteps
                    ? `Max steps (${request.maxSteps}) reached without finding the information.`
                    : "LLM could not determine a next step or information not found.";
                (0, server_1.sendProgress)(scrapeId, message);
                return {
                    isError: true,
                    message: message,
                    history: pageHistory // Include history even in error case
                };
            }
            // Check if we're trying to visit a page we've already been to
            if (analysisResult.nextActionElementId) {
                let nextUrl = "";
                if (analysisResult.nextActionElementId.startsWith("http")) {
                    nextUrl = analysisResult.nextActionElementId;
                }
                else if (analysisResult.nextActionElementId.startsWith("/")) {
                    nextUrl = new URL(analysisResult.nextActionElementId, pageStructure.url).toString();
                }
                else {
                    // For links and buttons, get the target URL if possible
                    const linkMatch = analysisResult.nextActionElementId.startsWith("link-")
                        ? pageStructure.links[parseInt(analysisResult.nextActionElementId.split("-")[1], 10)]
                        : null;
                    if (linkMatch?.href) {
                        nextUrl = new URL(linkMatch.href, pageStructure.url).toString();
                    }
                }
                // Check if we've already visited this URL
                if (nextUrl && pageHistory.some(h => h.url === nextUrl)) {
                    (0, server_1.sendProgress)(scrapeId, `Already visited ${nextUrl}, skipping...`);
                    continue;
                }
            }
            // Perform the next action
            (0, server_1.sendProgress)(scrapeId, `Navigating to ${analysisResult.nextActionElementId}...`);
            // Handle different types of navigation
            if (analysisResult.nextActionElementId.startsWith("link-")) {
                const index = parseInt(analysisResult.nextActionElementId.split("-")[1], 10);
                const link = pageStructure.links[index];
                if (link?.href) {
                    const elementSelector = `a[href="${link.href}"]:has-text("${link.text}")`;
                    try {
                        await page.click(elementSelector, { timeout: 5000 });
                        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
                    }
                    catch (clickError) {
                        (0, server_1.sendProgress)(scrapeId, `Failed to click link: ${elementSelector}`);
                        return {
                            isError: true,
                            message: `Failed to click element suggested by LLM: ${analysisResult.nextActionElementId}`,
                            history: pageHistory // Include history even in error case
                        };
                    }
                }
                else {
                    return {
                        isError: true,
                        message: `LLM suggested clicking an invalid link element: ${analysisResult.nextActionElementId}`,
                        history: pageHistory // Include history even in error case
                    };
                }
            }
            else if (analysisResult.nextActionElementId.startsWith("button-")) {
                const index = parseInt(analysisResult.nextActionElementId.split("-")[1], 10);
                const button = pageStructure.buttons[index];
                if (button) {
                    const elementSelector = `button:has-text("${button.text}") >> nth=${index}`; // Example selector - might need refinement
                    console.log(`Attempting to click button: ${elementSelector}`);
                    try {
                        await page.click(elementSelector, { timeout: 5000 });
                        await page.waitForLoadState("domcontentloaded", { timeout: 10000 }); // Wait for potential content change
                    }
                    catch (clickError) {
                        console.error(`Failed to click button selector: ${elementSelector}`, clickError);
                        return {
                            isError: true,
                            message: `Failed to click element suggested by LLM: ${analysisResult.nextActionElementId}`,
                            history: pageHistory // Include history even in error case
                        };
                    }
                }
                else {
                    console.warn(`Could not find button for ${analysisResult.nextActionElementId}`);
                    return {
                        isError: true,
                        message: `LLM suggested clicking an invalid button element: ${analysisResult.nextActionElementId}`,
                        history: pageHistory // Include history even in error case
                    };
                }
            }
            else if (analysisResult.nextActionElementId.startsWith("/")) {
                const newUrl = new URL(analysisResult.nextActionElementId, pageStructure.url).toString();
                (0, server_1.sendProgress)(scrapeId, `Navigating to path: ${newUrl}`);
                try {
                    await page.goto(newUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
                }
                catch (navError) {
                    return {
                        isError: true,
                        message: `Failed to navigate to path: ${analysisResult.nextActionElementId}`,
                        history: pageHistory // Include history even in error case
                    };
                }
            }
            else if (analysisResult.nextActionElementId.startsWith("http")) {
                (0, server_1.sendProgress)(scrapeId, `Navigating to URL: ${analysisResult.nextActionElementId}`);
                try {
                    await page.goto(analysisResult.nextActionElementId, {
                        waitUntil: "domcontentloaded",
                        timeout: 10000,
                    });
                }
                catch (navError) {
                    return {
                        isError: true,
                        message: `Failed to navigate to URL: ${analysisResult.nextActionElementId}`,
                        history: pageHistory // Include history even in error case
                    };
                }
            }
            else {
                return {
                    isError: true,
                    message: `LLM suggested clicking an unknown element type: ${analysisResult.nextActionElementId}`,
                    history: pageHistory // Include history even in error case
                };
            }
            await page.waitForTimeout(1000);
        }
        return {
            isError: true,
            message: `Max steps (${request.maxSteps}) reached without finding the information.`,
            history: pageHistory // Include history even in error case
        };
    }
    catch (error) {
        console.error("Error during scraping process:", error);
        return {
            isError: true,
            message: `Scraping failed: ${error.message}`,
            history: pageHistory // Include history even in error case
        };
    }
    finally {
        if (page) {
            await page.close();
        }
        if (browser) {
            await browser.close();
            (0, server_1.sendProgress)(scrapeId, "Browser closed.");
        }
    }
}
