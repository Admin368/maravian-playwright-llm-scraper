"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenAIConfig = void 0;
const https_proxy_agent_1 = require("https-proxy-agent");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Validate required environment variables
if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is required");
}
const getOpenAIConfig = () => {
    const config = {
        apiKey: process.env.OPENAI_API_KEY,
    };
    // Add proxy configuration if enabled
    if (process.env.USE_PROXY === "true" && process.env.PROXY_URL) {
        const agent = new https_proxy_agent_1.HttpsProxyAgent(process.env.PROXY_URL);
        return {
            ...config,
            httpAgent: agent,
        };
    }
    return config;
};
exports.getOpenAIConfig = getOpenAIConfig;
