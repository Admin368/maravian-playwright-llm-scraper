import express from "express";
import dotenv from "dotenv";
import { ScrapeRequest, ScrapeResponse } from "./types";
import { scrapeWebsite } from "./scraper";
import path from "path";

dotenv.config();

const app = express();
const port = process.env.PORT || 6061;

// Serve static files from the static directory
app.use(express.static(path.join(__dirname, "static")));

app.use(express.json());

// Root route serves the welcome page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "index.html"));
});

// API endpoint for scraping
const scrapeHandler: express.RequestHandler = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  const scrapeRequest: ScrapeRequest = req.body;

  // Basic validation
  if (
    !scrapeRequest.url ||
    !scrapeRequest.targetSchema ||
    !scrapeRequest.maxSteps
  ) {
    res.status(400).json({
      isError: true,
      message: "Missing required fields: url, targetSchema, maxSteps",
    });
    return;
  }

  if (
    typeof scrapeRequest.maxSteps !== "number" ||
    scrapeRequest.maxSteps <= 0
  ) {
    res.status(400).json({
      isError: true,
      message: "maxSteps must be a positive number",
    });
    return;
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
};

app.post("/scrape", scrapeHandler);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
