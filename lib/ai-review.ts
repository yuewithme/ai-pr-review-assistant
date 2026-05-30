import { buildAiReviewContext } from "./ai-context-builder.ts";
import { mockAnalysisResult } from "./mock-analysis.ts";
import type {
  AnalysisRisk,
  FileSummary,
  ReviewSuggestion,
  RuleFinding,
  RuleFindingLevel,
  RuleFindingType,
} from "../types/analysis.ts";
import type { AiReviewContext } from "../types/ai-context.ts";
import type { ChangedFile, ContextFile, FetchedPrData, PrInfo } from "../types/github.ts";

const DEEPSEEK_MODEL = "deepseek-v4-pro";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

const SYSTEM_PROMPT = `You are an experienced senior code reviewer. Analyze a GitHub Pull Request using only the provided PR metadata, changed files, diff patches, limited context files, and rule precheck findings.

Return strict JSON only. Do not wrap the JSON in markdown. Do not include explanations outside JSON.

Rules:
1. The output must match this JSON shape exactly:
{
  "summary": "string",
  "risks": [
    {
      "type": "permission | dependency | security | test-missing | large-change | maintainability | type-safety",
      "level": "low | medium | high",
      "filePath": "string",
      "message": "string",
      "suggestion": "string",
      "confidence": 0.0
    }
  ],
  "reviewSuggestions": [
    {
      "filePath": "string",
      "message": "string"
    }
  ],
  "fileSummaries": [
    {
      "filePath": "string",
      "status": "string",
      "additions": 0,
      "deletions": 0,
      "changes": 0,
      "summary": "string"
    }
  ]
}

2. Every risk must be tied to a concrete filePath from the changed files.
3. Do not output a high risk unless the diff or rule finding provides clear code evidence.
4. Every risk must include confidence from 0 to 1.
5. Review suggestions should read like real code review comments: specific, actionable, and tied to the changed code.
6. Rule precheck findings are hints for analysis, not final conclusions.
7. If evidence is weak, prefer medium or low risk, or ask a review-style suggestion instead of claiming a risk.
8. File summaries must be generated from the changed files.
9. Use concise language.`;

type AnalyzePullRequestInput = {
  prInfo: PrInfo;
  changedFiles: ChangedFile[];
  contextFiles: ContextFile[];
  ruleFindings: RuleFinding[];
};

type AnalyzePullRequestOutput = {
  summary: string;
  risks: AnalysisRisk[];
  reviewSuggestions: ReviewSuggestion[];
  fileSummaries: FileSummary[];
};

type AiJsonResponse = {
  summary?: unknown;
  risks?: unknown;
  reviewSuggestions?: unknown;
  fileSummaries?: unknown;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export async function analyzePullRequest(
  input: AnalyzePullRequestInput,
): Promise<AnalyzePullRequestOutput> {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return fallbackAnalysis(input);
  }

  try {
    const aiContext = buildAiReviewContext(input);
    const aiContent = await callAiApi(aiContext, apiKey);
    const parsed = parseStrictJson(aiContent);

    return normalizeAiResult(parsed, input);
  } catch {
    return fallbackAnalysis(input);
  }
}

async function callAiApi(
  context: AiReviewContext,
  apiKey: string,
): Promise<string> {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildUserPrompt(context),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("AI request failed.");
  }

  const body = (await response.json()) as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AI response did not include content.");
  }

  return content;
}

function buildUserPrompt(context: AiReviewContext): string {
  return `PR Info:
${JSON.stringify(context.prInfo, null, 2)}

Rule Precheck Findings:
${JSON.stringify(context.ruleFindings, null, 2)}

Limited Context Files:
${JSON.stringify(context.contextFiles, null, 2)}

Changed Files And Patches:
${JSON.stringify(context.changedFiles, null, 2)}

Field Guide:
${JSON.stringify(context.fieldGuide, null, 2)}

Context Policy:
${JSON.stringify(context.contextPolicy, null, 2)}

Analyze this PR and return strict JSON only.`;
}

function parseStrictJson(content: string): AiJsonResponse {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  return JSON.parse(withoutFence) as AiJsonResponse;
}

function normalizeAiResult(
  result: AiJsonResponse,
  input: AnalyzePullRequestInput,
): AnalyzePullRequestOutput {
  const fallback = fallbackAnalysis(input);
  const changedFilePaths = new Set(input.changedFiles.map((file) => file.filename));

  return {
    summary: typeof result.summary === "string" ? result.summary : fallback.summary,
    risks: normalizeRisks(result.risks, changedFilePaths),
    reviewSuggestions: normalizeReviewSuggestions(
      result.reviewSuggestions,
      changedFilePaths,
      fallback.reviewSuggestions,
    ),
    fileSummaries: normalizeFileSummaries(
      result.fileSummaries,
      input.changedFiles,
      fallback.fileSummaries,
    ),
  };
}

function normalizeRisks(
  risks: unknown,
  changedFilePaths: Set<string>,
): AnalysisRisk[] {
  if (!Array.isArray(risks)) {
    return [];
  }

  return risks.flatMap((risk) => {
    if (typeof risk !== "object" || risk === null) {
      return [];
    }

    const candidate = risk as Partial<AnalysisRisk>;
    if (
      !isRuleFindingType(candidate.type) ||
      !isRuleFindingLevel(candidate.level) ||
      typeof candidate.filePath !== "string" ||
      !changedFilePaths.has(candidate.filePath) ||
      typeof candidate.message !== "string" ||
      typeof candidate.suggestion !== "string"
    ) {
      return [];
    }

    return [
      {
        type: candidate.type,
        level: candidate.level,
        filePath: candidate.filePath,
        message: candidate.message,
        suggestion: candidate.suggestion,
        confidence: clampConfidence(candidate.confidence),
      },
    ];
  });
}

function normalizeReviewSuggestions(
  suggestions: unknown,
  changedFilePaths: Set<string>,
  fallback: ReviewSuggestion[],
): ReviewSuggestion[] {
  if (!Array.isArray(suggestions)) {
    return fallback;
  }

  const normalized = suggestions.flatMap((suggestion) => {
    if (typeof suggestion !== "object" || suggestion === null) {
      return [];
    }

    const candidate = suggestion as Partial<ReviewSuggestion>;
    if (
      typeof candidate.filePath !== "string" ||
      !changedFilePaths.has(candidate.filePath) ||
      typeof candidate.message !== "string"
    ) {
      return [];
    }

    return [
      {
        filePath: candidate.filePath,
        message: candidate.message,
      },
    ];
  });

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeFileSummaries(
  summaries: unknown,
  changedFiles: ChangedFile[],
  fallback: FileSummary[],
): FileSummary[] {
  if (!Array.isArray(summaries)) {
    return fallback;
  }

  const fileByPath = new Map(changedFiles.map((file) => [file.filename, file]));
  const normalized = summaries.flatMap((summary) => {
    if (typeof summary !== "object" || summary === null) {
      return [];
    }

    const candidate = summary as Partial<FileSummary>;
    if (typeof candidate.filePath !== "string" || !fileByPath.has(candidate.filePath)) {
      return [];
    }

    const sourceFile = fileByPath.get(candidate.filePath)!;

    return [
      {
        filePath: candidate.filePath,
        status: sourceFile.status,
        additions: sourceFile.additions,
        deletions: sourceFile.deletions,
        changes: sourceFile.changes,
        summary:
          typeof candidate.summary === "string"
            ? candidate.summary
            : `${sourceFile.status} ${sourceFile.filename}.`,
      },
    ];
  });

  return normalized.length > 0 ? normalized : fallback;
}

function fallbackAnalysis(input: AnalyzePullRequestInput): AnalyzePullRequestOutput {
  const fallbackInput: FetchedPrData = {
    pr: input.prInfo,
    files: input.changedFiles,
    contextFiles: input.contextFiles,
  };
  const fallback = mockAnalysisResult(fallbackInput, input.ruleFindings);

  return {
    summary: fallback.summary,
    risks: fallback.risks,
    reviewSuggestions: fallback.reviewSuggestions,
    fileSummaries: fallback.fileSummaries,
  };
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, value));
}

function isRuleFindingType(value: unknown): value is RuleFindingType {
  return (
    value === "permission" ||
    value === "dependency" ||
    value === "security" ||
    value === "test-missing" ||
    value === "large-change" ||
    value === "maintainability" ||
    value === "type-safety"
  );
}

function isRuleFindingLevel(value: unknown): value is RuleFindingLevel {
  return value === "low" || value === "medium" || value === "high";
}
