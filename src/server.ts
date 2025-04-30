import express, {
  Request,
  Response,
  Application,
  RequestHandler,
} from "express";
import dotenv from "dotenv";
import rateLimit from 'express-rate-limit'; // Import rate-limiting middleware
import { ScrapeRequest, ScrapeResponse } from "./types";
import { LoginRequest, RegisterRequest, CreateApiTokenRequest } from "./types/auth";
import { scrapeWebsite } from "./scraper";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireAdmin, registerUser, loginUser, generateApiToken } from "./auth";

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 6061;
const prisma = new PrismaClient();

// Apply rate limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter); // Apply the rate limiting middleware to all requests

// Serve static files from the static directory
app.use(express.static(path.join(__dirname, "static")));
app.use(express.json());

// Root route serves the welcome page
app.get("/", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "static", "index.html"));
});

// Auth routes
app.post("/auth/register", async (req: Request<{}, {}, RegisterRequest>, res: Response) => {
  try {
    const { email, password, name } = req.body;
    const user = await registerUser(email, password, name);
    res.status(201).json({ 
      message: "Registration successful. Please wait for admin approval.",
      user
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/auth/login", async (req: Request<{}, {}, LoginRequest>, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

// API Token management
app.post("/auth/token", authenticateToken, async (req: Request<{}, {}, CreateApiTokenRequest>, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const { name, expiresAt } = req.body;
    const token = await generateApiToken(req.user.id, name, expiresAt);
    res.status(201).json(token);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// User management routes (admin only)
app.get("/admin/users", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      isApproved: true,
      createdAt: true,
    }
  });
  res.json(users);
});

app.patch("/admin/users/:id/approve", authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { isApproved: true }
    });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: "Failed to approve user" });
  }
});

// Protected scraping endpoint
const scrapeHandler: RequestHandler = async (
  req: Request,
  res: Response,
  next: Function
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
    if (!req.user) {
      throw new Error("Authentication required");
    }

    // Store the request in the database with user ID
    const dbRequest = await prisma.scrapeRequest.create({
      data: {
        url: scrapeRequest.url,
        maxSteps: scrapeRequest.maxSteps,
        targetSchema: JSON.stringify(scrapeRequest.targetSchema),
        userId: req.user.id
      },
    });

    const result = await scrapeWebsite(scrapeRequest);

    // Store the result in the database
    await prisma.scrapeResult.create({
      data: {
        requestId: dbRequest.id,
        isError: result.isError,
        message: result.message,
        data: result.data ? JSON.stringify(result.data) : null,
      },
    });

    res.status(result.isError ? 500 : 200).json(result);
  } catch (error) {
    console.error("Unhandled error in /scrape:", error);
    res.status(500).json({
      isError: true,
      message: "An unexpected server error occurred.",
    });
  }
};

// Protected scrape endpoint
app.post("/scrape", authenticateToken, scrapeHandler);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

// Shutdown handler
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});
