import { test, expect } from "@playwright/test";
import { scrapeWebsite } from "../src/scraper";
import { ScrapeRequest } from "../src/types";

test.describe("Scraper", () => {
  test("should handle basic scraping request", async () => {
    const request: ScrapeRequest = {
      url: "https://example.com",
      maxSteps: 3,
      targetSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
        },
      },
    };

    const result = await scrapeWebsite(request);
    expect(result).toBeDefined();
    expect(result.isError).toBeDefined();
  });

  test("should handle invalid URLs", async () => {
    const request: ScrapeRequest = {
      url: "https://invalid-url-that-does-not-exist.com",
      maxSteps: 3,
      targetSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
        },
      },
    };

    const result = await scrapeWebsite(request);
    expect(result.isError).toBe(true);
    expect(result.message).toContain("Scraping failed");
  });

  test("should respect maxSteps limit", async () => {
    const request: ScrapeRequest = {
      url: "https://example.com",
      maxSteps: 1,
      targetSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
        },
      },
    };

    const result = await scrapeWebsite(request);
    expect(result).toBeDefined();
    // Either it found the data in one step or hit the max steps limit
    expect(result.isError || result.data).toBeTruthy();
  });

  // Add more test cases based on your scraper's functionality
});
