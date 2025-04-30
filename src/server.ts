import express from "express";
import dotenv from "dotenv";
import { ScrapeRequest, ScrapeResponse } from "./types";
import { scrapeWebsite } from "./scraper";
import { determineSchema } from "./llm";
import path from "path";

dotenv.config();

const app = express();
const port = process.env.PORT || 6061;

// Enable CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Serve static files from the static directory
app.use(express.static(path.join(__dirname, "static")));

app.use(express.json());

// Root route serves the welcome page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "index.html"));
});

// Schema generation endpoint
app.post("/schema", async (req, res) => {
  try {
    const { query } = req.body;
    const schema = await determineSchema(query);
    res.json({ schema });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate schema" });
  }
});

// SSE endpoint for progress updates
app.get("/scrape/progress/:id", (req, res) => {
  const scrapeId = req.params.id;
  
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.flushHeaders(); // Immediately send headers
  
  // Send initial message to establish connection
  res.write("data: " + JSON.stringify({ message: "Connection established" }) + "\n\n");
  
  // Store the connection in our global connections map
  progressConnections.set(scrapeId, res);

  // Remove the connection when client disconnects
  req.on("close", () => {
    progressConnections.delete(scrapeId);
  });
});

// Store SSE connections
const progressConnections = new Map<string, express.Response>();

// Function to send progress updates
export function sendProgress(scrapeId: string, message: string) {
  const connection = progressConnections.get(scrapeId);
  if (connection) {
    connection.write(`data: ${JSON.stringify({ message })}\n\n`);
  }
}

// API endpoint for scraping
const scrapeHandler: express.RequestHandler = async (
  req: express.Request,
  res: express.Response
): Promise<void> => {
  const scrapeRequest: ScrapeRequest = req.body;
  const scrapeId = Date.now().toString(); // Simple ID generation

  // Basic validation
  if (
    !scrapeRequest.url ||
    !scrapeRequest.targetSchema ||
    !scrapeRequest.maxSteps ||
    !scrapeRequest.query
  ) {
    res.status(400).json({
      isError: true,
      message: "Missing required fields: url, targetSchema, maxSteps, query",
      scrapeId,
    });
    return;
  }

  if (typeof scrapeRequest.maxSteps !== "number" || scrapeRequest.maxSteps <= 0) {
    res.status(400).json({
      isError: true,
      message: "maxSteps must be a positive number",
      scrapeId,
    });
    return;
  }

  if (typeof scrapeRequest.query !== "string" || scrapeRequest.query.trim() === "") {
    res.status(400).json({
      isError: true,
      message: "query must be a non-empty string",
      scrapeId,
    });
    return;
  }

  console.log(`Received scrape request for URL: ${scrapeRequest.url}`);
  console.log(`Query: ${scrapeRequest.query}`);

  // Return the scrapeId immediately
  res.json({
    isError: false,
    message: "Scraping started",
    scrapeId,
  });

  try {
    // Start the scraping process
    const result = await scrapeWebsite(scrapeRequest, scrapeId);
    
    // Send final result
    sendProgress(scrapeId, JSON.stringify({
      isComplete: true,
      ...result
    }));
  } catch (error) {
    console.error("Unhandled error in /scrape:", error);
    sendProgress(scrapeId, JSON.stringify({
      isComplete: true,
      isError: true,
      message: "An unexpected server error occurred.",
    }));
  } finally {
    // Close the connection after completion
    const connection = progressConnections.get(scrapeId);
    if (connection) {
      connection.end();
      progressConnections.delete(scrapeId);
    }
  }
};

app.post("/scrape", scrapeHandler);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
