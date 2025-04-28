import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { ScrapeRequest, ScrapeResponse } from "./types";
import { scrapeWebsite } from "./scraper";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Simple root route
app.get("/", (req: Request, res: Response) => {
  res.send("Playwright LLM Scraper API is running!");
});

// API endpoint for scraping
app.post("/scrape", async (req: Request, res: Response<ScrapeResponse>) => {
  const scrapeRequest: ScrapeRequest = req.body;

  // Basic validation
  if (
    !scrapeRequest.url ||
    !scrapeRequest.targetSchema ||
    !scrapeRequest.maxSteps
  ) {
    return res.status(400).json({
      isError: true,
      message: "Missing required fields: url, targetSchema, maxSteps",
    });
  }

  if (
    typeof scrapeRequest.maxSteps !== "number" ||
    scrapeRequest.maxSteps <= 0
  ) {
    return res.status(400).json({
      isError: true,
      message: "maxSteps must be a positive number",
    });
  }

  console.log(`Received scrape request for URL: ${scrapeRequest.url}`);

  try {
    const result = await scrapeWebsite(scrapeRequest);
    res.status(result.isError ? 500 : 200).json(result);
  } catch (error) {
    console.error("Unhandled error in /scrape:", error);
    res.status(500).json({
      isError: true,
      message: "An unexpected server error occurred.",
    });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
