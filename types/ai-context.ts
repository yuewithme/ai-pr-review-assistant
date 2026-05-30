import type { RuleFinding, RuleFindingType } from "./analysis.ts";
import type { PrInfo } from "./github.ts";

export type AiReviewPrInfo = Pick<
  PrInfo,
  "title" | "description" | "sourceBranch" | "targetBranch" | "state" | "url"
>;

export type AiReviewChangedFile = {
  filePath: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch: string;
  ruleFindingTypes: RuleFindingType[];
};

export type AiReviewContextFile = {
  path: string;
  content: string;
};

export type AiReviewContextPolicy = {
  maxPatchCharsPerFile: number;
  maxContextCharsPerFile: number;
  maxTotalChars: number;
  truncated: boolean;
  truncatedItems: string[];
};

export type AiReviewFieldGuide = Record<string, string>;

export type AiReviewContext = {
  fieldGuide: AiReviewFieldGuide;
  prInfo: AiReviewPrInfo;
  changedFiles: AiReviewChangedFile[];
  contextFiles: AiReviewContextFile[];
  ruleFindings: RuleFinding[];
  contextPolicy: AiReviewContextPolicy;
};

