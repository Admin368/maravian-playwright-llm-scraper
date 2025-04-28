import { HttpsProxyAgent } from "https-proxy-agent";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Validate required environment variables
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

export const getOpenAIConfig = () => {
  const config = {
    apiKey: process.env.OPENAI_API_KEY,
  } as const;

  // Add proxy configuration if enabled
  if (process.env.USE_PROXY === "true" && process.env.PROXY_URL) {
    const agent = new HttpsProxyAgent(process.env.PROXY_URL);
    return {
      ...config,
      httpAgent: agent,
    };
  }

  return config;
};
