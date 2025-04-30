// Defines the core data structures used in the application

// Represents the user's request to the /scrape endpoint
export interface ScrapeRequest {
  url: string; // The starting URL to scrape
  targetSchema: TargetSchema; // Description of the desired data structure
  maxSteps: number; // Maximum navigation/interaction steps
  query: string; // Natural language description of what data to extract
}

// Represents the desired data structure/schema provided by the user
// This is intentionally kept flexible (object) as the user defines it.
export interface TargetSchema {
  type: string;
  properties: {
    [key: string]: {
      type: string;
      items?: {
        type: string;
        properties?: {
          [key: string]: {
            type: string;
          };
        };
        required?: string[];
      };
      properties?: {
        [key: string]: {
          type: string;
        };
      };
      required?: string[];
    };
  };
  required?: string[];
}

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
  links: Array<{
    id: string;
    text: string | null | undefined;
    href: string | null;
  }>;
  buttons: Array<{
    id: string;
    text: string | null | undefined;
  }>;
  textContent: string;
  emails: string[];
}

// Represents the analysis result from the LLM
export interface LLMAnalysisResult {
  isDataFound: boolean;
  data: Record<string, any> | null;
  nextActionElementId: string | null;
}
