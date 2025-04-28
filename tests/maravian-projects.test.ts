import { test, expect } from "@playwright/test";
import { scrapeWebsite } from "../src/scraper";
import { ScrapeRequest } from "../src/types";

test.describe("Maravian Projects", () => {
  test("should find company projects", async () => {
    const request: ScrapeRequest = {
      url: "https://maravian.com",
      maxSteps: 5,
      targetSchema: {
        type: "object",
        properties: {
          projects: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
              },
              required: ["name", "description"],
            },
          },
        },
        required: ["projects"],
      },
    };

    const result = await scrapeWebsite(request);

    // Check if we got a successful result
    expect(result.isError).toBe(false);
    expect(result.data).toBeDefined();

    // Verify the data structure
    const data = result.data as {
      projects: Array<{ name: string; description: string }>;
    };
    expect(data.projects).toBeDefined();
    expect(Array.isArray(data.projects)).toBe(true);

    // Verify each project has the required fields
    data.projects.forEach((project) => {
      expect(typeof project.name).toBe("string");
      expect(typeof project.description).toBe("string");
      expect(project.name.length).toBeGreaterThan(0);
      expect(project.description.length).toBeGreaterThan(0);
    });

    console.log("Found Projects:", JSON.stringify(data.projects, null, 2));
  });
});
