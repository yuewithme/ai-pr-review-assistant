import type { PrInfo } from "./github.ts";

export type RuleFindingType =
  | "permission"
  | "dependency"
  | "security"
  | "test-missing"
  | "large-change"
  | "maintainability"
  | "type-safety";

export type RuleFindingLevel = "low" | "medium" | "high";

export type RuleFinding = {
  type: RuleFindingType;
  level: RuleFindingLevel;
  filePath: string;
  message: string;
};

export type AnalysisStatus = "completed";

export type AnalysisRisk = {
  type: RuleFindingType;
  level: RuleFindingLevel;
  filePath: string;
  message: string;
  evidence: string;
  codeSnippet?: string;
  suggestion: string;
  confidence: number;
};

export type ReviewSuggestion = {
  filePath: string;
  message: string;
};

export type FileSummary = {
  filePath: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  summary: string;
};

export type AnalysisResult = {
  analysisId: string;
  status: AnalysisStatus;
  prInfo: PrInfo;
  summary: string;
  risks: AnalysisRisk[];
  reviewSuggestions: ReviewSuggestion[];
  fileSummaries: FileSummary[];
  ruleFindings: RuleFinding[];
};
