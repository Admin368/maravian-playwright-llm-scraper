"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const scraper_1 = require("./scraper");
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Serve static files from the static directory
app.use(express_1.default.static(path_1.default.join(__dirname, "static")));
app.use(express_1.default.json());
// Root route serves the welcome page
app.get("/", (req, res) => {
    res.sendFile(path_1.default.join(__dirname, "static", "index.html"));
});
// API endpoint for scraping
const scrapeHandler = async (req, res) => {
    const scrapeRequest = req.body;
    // Basic validation
    if (!scrapeRequest.url ||
        !scrapeRequest.targetSchema ||
        !scrapeRequest.maxSteps) {
        res.status(400).json({
            isError: true,
            message: "Missing required fields: url, targetSchema, maxSteps",
        });
        return;
    }
    if (typeof scrapeRequest.maxSteps !== "number" ||
        scrapeRequest.maxSteps <= 0) {
        res.status(400).json({
            isError: true,
            message: "maxSteps must be a positive number",
        });
        return;
    }
    console.log(`Received scrape request for URL: ${scrapeRequest.url}`);
    try {
        const result = await (0, scraper_1.scrapeWebsite)(scrapeRequest);
        res.status(result.isError ? 500 : 200).json(result);
    }
    catch (error) {
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
