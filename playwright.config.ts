import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

// Validate required environment variables
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
    ...(process.env.USE_PROXY === "true" && process.env.PROXY_URL
      ? {
          proxy: {
            server: process.env.PROXY_URL,
          },
        }
      : {}),
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
