export interface PICOData {
  p: string;
  i: string;
  c: string;
  o: string;
}

export interface KeywordSuggestion {
  original: string;
  synonyms: string[];
  meshTerms: string[];
}

export interface SearchResult {
  id: string;
  title: string;
  authors: string;
  source: string;
  pubdate: string;
  doi: string;
  url: string;
  abstract?: string;
  aiSummary?: string;
  isVerified?: boolean;
}

export interface SearchFilters {
  years: number; // e.g. 5 or 10
  types: string[]; // e.g. ["Systematic Review", "RCT"]
  language: "English" | "Chinese" | "Both";
}
