import { test, expect } from "@playwright/test";
import { scrapeWebsite } from "../src/scraper";
import { ScrapeRequest } from "../src/types";

test.describe("Maravian Contact Info", () => {
  test("should find company contact email", async () => {
    const request: ScrapeRequest = {
      url: "https://maravian.com",
      maxSteps: 5,
      query: "Find the main contact email address for the company, preferably a business email rather than a personal one",
      targetSchema: {
        type: "object",
        properties: {
          contact_email: { type: "string" },
        },
        required: ["contact_email"],
      },
    };

    const result = await scrapeWebsite(request);

    // Check if we got a successful result
    expect(result.isError).toBe(false);
    expect(result.data).toBeDefined();

    // Verify the data structure
    const data = result.data as { contact_email: string };
    expect(data.contact_email).toBeDefined();

    // Verify the data type
    expect(typeof data.contact_email).toBe("string");

    // Verify email format
    expect(data.contact_email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);

    console.log("Company Contact Email:", data.contact_email);
  });
});
