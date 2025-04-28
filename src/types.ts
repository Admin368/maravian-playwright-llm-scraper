// Defines the core data structures used in the application

// Represents the user's request to the /scrape endpoint
export interface ScrapeRequest {
  url: string; // The starting URL to scrape
  targetSchema: TargetSchema; // Description of the desired data structure
  maxSteps: number; // Maximum navigation/interaction steps
}

// Represents the desired data structure/schema provided by the user
// This is intentionally kept flexible (object) as the user defines it.
export type TargetSchema = object; // Could be a JSON schema object or a textual description

// Represents the final response from the /scrape endpoint
export interface ScrapeResponse {
  isError: boolean;
  message: string;
  data?: any; // Should ideally match the TargetSchema structure if successful
}

// --- Data structures for interaction between scraper and LLM ---

// Represents extracted, simplified structure of the current page for the LLM
export interface ExtractedPageStructure {
  url: string;
  title: string;
  links: { id: string; text?: string; href?: string | null }[];
  buttons: { id: string; text?: string }[];
  // Potentially add other elements like forms, inputs, relevant text snippets
}

// Represents the analysis result from the LLM
export interface LLMAnalysisResult {
  isDataFound: boolean;
  data: object | null; // The data extracted by the LLM, matching targetSchema
  nextActionElementId: string | null; // ID of the element to interact with next (e.g., "link-1", "button-0")
}
