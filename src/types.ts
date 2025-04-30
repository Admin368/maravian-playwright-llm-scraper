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
  history?: PageHistory[];  // Add history to response
}

// Represents the history of pages visited during the scraping process
export interface PageHistory {
  url: string;
  title: string;
  textContent: string;
  emails: string[];
  timestamp: string;
  clickedElement: string | null;  // The element that was clicked to reach this page
  nextActionElementId: string | null;  // The next action suggested by LLM
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
  contactText: string; // Specialized text extracted from contact sections, footers, etc.
}

// Represents the analysis result from the LLM
export interface LLMAnalysisResult {
  isError?: boolean; // Indicates if the LLM found all required information
  message?: string; // Error message if isError is true
  isDataFound: boolean;
  data: Record<string, any> | null;
  nextActionElementId: string | null;
  reasoning?: string; // Explanation for the decision
}
