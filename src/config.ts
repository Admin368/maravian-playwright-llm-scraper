import { HttpsProxyAgent } from "https-proxy-agent";
import OpenAI from "openai";

export const getOpenAIConfig = () => {
  const proxy = "http://192.168.1.168:7890";
  const agent = new HttpsProxyAgent(proxy);

  return {
    apiKey: process.env.OPENAI_API_KEY,
    httpAgent: agent,
  };
};
