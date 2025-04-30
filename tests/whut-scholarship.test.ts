import { test, expect } from "@playwright/test";
import { scrapeWebsite } from "../src/scraper";
import { ScrapeRequest } from "../src/types";

test.describe("WHUT Scholarship Information", () => {
  test("should find scholarship application details", async () => {
    const request: ScrapeRequest = {
      url: "http://sie.whut.edu.cn/english/sch/ch/",
      maxSteps: 5,
      query: "Find information about 2025 scholarship application including application link, deadline, required materials, contact email and available courses. Focus on finding the application link and deadline as they are required.",
      targetSchema: {
        type: "object",
        properties: {
          application_link: { type: "string" },
          application_deadline: { type: "string" },
          require_materials: {
            type: "array",
            items: { type: "string" }
          },
          contact_email: { type: "string" },
          courses_available: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["application_link", "application_deadline"]
      }
    };

    const result = await scrapeWebsite(request, "whut-scholarship");

    // Check if we got a successful result
    expect(result.isError).toBe(false);
    expect(result.data).toBeDefined();

    // Verify the required fields are present
    const data = result.data as {
      application_link: string;
      application_deadline: string;
      require_materials?: string[];
      contact_email?: string;
      courses_available?: string[];
    };

    expect(data.application_link).toBeDefined();
    expect(data.application_deadline).toBeDefined();
    
    // Log the results for verification
    console.log("Scraped scholarship data:", data);

    // Optional fields validation
    if (data.require_materials) {
      expect(Array.isArray(data.require_materials)).toBe(true);
    }
    if (data.courses_available) {
      expect(Array.isArray(data.courses_available)).toBe(true);
    }
    if (data.contact_email) {
      expect(typeof data.contact_email).toBe("string");
    }
  });
});