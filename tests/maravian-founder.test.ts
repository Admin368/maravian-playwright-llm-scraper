import { test, expect } from "@playwright/test";
import { scrapeWebsite } from "../src/scraper";
import { ScrapeRequest } from "../src/types";

test.describe("Maravian Founder", () => {
  test("should find company founder name", async () => {
    const request: ScrapeRequest = {
      url: "https://maravian.com",
      maxSteps: 5,
      query: "Find the company founder's name from the website",
      targetSchema: {
        type: "object",
        properties: {
          founder: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
            required: ["name"],
          },
        },
        required: ["founder"],
      },
    };

    const result = await scrapeWebsite(request, "maravian-founder");

    // Check if we got a successful result
    expect(result.isError).toBe(false);
    expect(result.data).toBeDefined();

    // Verify the data structure
    const data = result.data as { founder: { name: string } };
    expect(data.founder).toBeDefined();
    expect(data.founder.name).toBeDefined();
    expect(typeof data.founder.name).toBe("string");
    expect(data.founder.name.length).toBeGreaterThan(0);

    console.log("Founder Name:", data.founder.name);
  });
});
