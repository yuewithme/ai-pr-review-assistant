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

const DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

const SYSTEM_PROMPT = `你是一名资深代码审查专家。请只基于提供的 PR 元数据、变更文件、diff patch、有限上下文文件和规则预检测结果分析 GitHub Pull Request。

只返回严格 JSON。不要使用 markdown 代码块包裹 JSON。不要输出 JSON 以外的解释。

规则：
1. 输出必须严格符合以下 JSON 结构：
{
  "summary": "string",
  "risks": [
    {
      "type": "permission | dependency | security | test-missing | large-change | maintainability | type-safety",
      "level": "low | medium | high",
      "filePath": "string",
      "message": "string",
      "evidence": "string",
      "codeSnippet": "string",
      "suggestion": "string",
      "suggestedCode": "string",
      "confidence": 0.0
    }
  ],
  "reviewSuggestions": [
    {
      "filePath": "string",
      "message": "string",
      "currentCode": "string",
      "suggestedCode": "string"
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

2. 每条风险都必须绑定 changed files 中真实存在的 filePath。
3. 除非 diff 或规则预检测结果提供明确代码依据，否则不要输出 high 风险。
4. 每条风险都必须包含 0 到 1 之间的 confidence。
5. reviewSuggestions 要像真实 code review 评论：具体、可执行，并且和变更代码相关；不要输出“请确认是否符合预期”这类没有行动指向的空话。
6. rule precheck findings 只是分析线索，不是最终风险结论。
7. 如果证据较弱，优先输出 medium 或 low 风险；也可以用 review 建议提出人工确认，不要强行断言风险。
8. fileSummaries 必须基于 changed files 生成。
9. 除以下内容外，所有可见解释性文本必须使用中文：文件路径、代码标识符、函数名、变量名、包名、分支名、PR 标题、risk type 枚举值、status 枚举值、TypeScript、GitHub、API、JSON、diff、patch、token 等技术名词。
10. 如果输入中的 ruleFindings、patch 注释或上下文字段是英文，不要原样照抄成风险描述；请在保留必要技术名词的前提下转写为自然中文。
11. summary、risk.message、risk.suggestion、reviewSuggestions.message、fileSummaries.summary 必须是中文表达。
12. risk.message 说明“问题是什么”，risk.evidence 说明“从哪段 diff 或规则线索看出来”，两者不能写成同一句话。
13. 每条风险必须尽量写清四件事：触发条件、具体证据、可能影响路径、建议验证方式。缺少其中任一项时应降低 level 或 confidence。
14. risk.evidence 必须引用具体 patch 片段、文件路径、规则命中或上下文字段；不要只重复 risk.message。
15. risk.codeSnippet 必须优先摘录 changedFiles.patch 中最相关的新增或修改代码片段；如果没有明确代码片段，返回空字符串。
16. risk.suggestion 必须写给人看，包含具体改法、建议补充的测试或需要确认的边界，不能只写“建议优化”“建议检查”“建议复核”。
17. 如果 risk.suggestion 有明确代码改法，risk.suggestedCode 必须给出修改后代码；如果只能人工确认，返回空字符串。
18. reviewSuggestions.message 必须像可以直接贴到 GitHub 的 review comment：点名具体问题、说明为什么要改、给出下一步动作。不要输出泛泛的流程性建议。
19. 如果 reviewSuggestions.message 提出具体代码修改或测试补充，reviewSuggestions.currentCode 必须给出当前相关代码，reviewSuggestions.suggestedCode 必须给出可参考的修改后代码；如果只能人工确认，两个字段返回空字符串。
20. currentCode、codeSnippet 和 suggestedCode 要能形成“修改前 / 修改后”对比，优先基于 changedFiles.patch 中已有代码改写，不要编造不存在的 API。
21. 对测试建议要尽量写出测试场景、输入、期望输出或断言目标，避免只说“补充测试”。
22. 语言要简洁。`;

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
  return `PR 信息:
${JSON.stringify(context.prInfo, null, 2)}

规则预检测结果:
${JSON.stringify(context.ruleFindings, null, 2)}

有限上下文文件:
${JSON.stringify(context.contextFiles, null, 2)}

变更文件和 patch:
${JSON.stringify(context.changedFiles, null, 2)}

字段说明:
${JSON.stringify(context.fieldGuide, null, 2)}

请分析这个 PR，并只返回严格 JSON。所有解释性内容必须使用中文，必要技术名词、文件路径和代码标识符可以保留原文。`;
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
        evidence:
          typeof candidate.evidence === "string" && candidate.evidence.trim() !== ""
            ? candidate.evidence
            : candidate.message,
        codeSnippet:
          typeof candidate.codeSnippet === "string" ? candidate.codeSnippet : "",
        suggestion: candidate.suggestion,
        suggestedCode:
          typeof candidate.suggestedCode === "string" ? candidate.suggestedCode : "",
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
        currentCode:
          typeof candidate.currentCode === "string" ? candidate.currentCode : "",
        suggestedCode:
          typeof candidate.suggestedCode === "string" ? candidate.suggestedCode : "",
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
