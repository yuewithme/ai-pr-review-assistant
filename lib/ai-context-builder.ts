import type { RuleFinding, RuleFindingLevel, RuleFindingType } from "../types/analysis.ts";
import type { AiReviewContext, AiReviewChangedFile } from "../types/ai-context.ts";
import type { ChangedFile, ContextFile, PrInfo } from "../types/github.ts";

const DEFAULT_MAX_PATCH_CHARS_PER_FILE = 4_000;
const DEFAULT_MAX_CONTEXT_CHARS_PER_FILE = 2_000;
const DEFAULT_MAX_TOTAL_CHARS = 20_000;

type BuildAiReviewContextInput = {
  prInfo: PrInfo;
  changedFiles: ChangedFile[];
  contextFiles: ContextFile[];
  ruleFindings: RuleFinding[];
};

type BuildAiReviewContextOptions = {
  maxPatchCharsPerFile?: number;
  maxContextCharsPerFile?: number;
  maxTotalChars?: number;
};

type ContextBudget = {
  usedChars: number;
  maxTotalChars: number;
  truncated: boolean;
  truncatedItems: string[];
};

export function buildAiReviewContext(
  input: BuildAiReviewContextInput,
  options: BuildAiReviewContextOptions = {},
): AiReviewContext {
  const maxPatchCharsPerFile =
    options.maxPatchCharsPerFile ?? DEFAULT_MAX_PATCH_CHARS_PER_FILE;
  const maxContextCharsPerFile =
    options.maxContextCharsPerFile ?? DEFAULT_MAX_CONTEXT_CHARS_PER_FILE;
  const maxTotalChars = options.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS;
  const budget: ContextBudget = {
    usedChars: 0,
    maxTotalChars,
    truncated: false,
    truncatedItems: [],
  };

  const changedFiles = sortChangedFiles(input.changedFiles, input.ruleFindings).map(
    (file) =>
      mapChangedFile(
        file,
        input.ruleFindings,
        maxPatchCharsPerFile,
        budget,
      ),
  );
  const contextFiles = input.contextFiles.map((file) => ({
    path: file.path,
    content: takeBudgetedText(
      file.content,
      maxContextCharsPerFile,
      `contextFiles.${file.path}`,
      budget,
    ),
  }));

  return {
    fieldGuide: buildFieldGuide(),
    prInfo: {
      title: input.prInfo.title,
      description: input.prInfo.description,
      sourceBranch: input.prInfo.sourceBranch,
      targetBranch: input.prInfo.targetBranch,
      state: input.prInfo.state,
      url: input.prInfo.url,
    },
    changedFiles,
    contextFiles,
    ruleFindings: input.ruleFindings,
    contextPolicy: {
      maxPatchCharsPerFile,
      maxContextCharsPerFile,
      maxTotalChars,
      truncated: budget.truncated,
      truncatedItems: budget.truncatedItems,
    },
  };
}

function buildFieldGuide() {
  return {
    "prInfo.title": "PR title. Use it to infer author intent, not as code evidence.",
    "prInfo.description": "PR description. Helpful context, but it may be incomplete or outdated.",
    "prInfo.sourceBranch": "Branch where the proposed changes come from.",
    "prInfo.targetBranch": "Branch receiving the changes. Use it to understand merge target.",
    "changedFiles.filePath": "Changed file path. Every risk must reference one of these paths.",
    "changedFiles.patch": "Primary code evidence for review. Use it before claiming behavior or risk.",
    "changedFiles.changes": "Total changed lines. Useful for spotting broad or high-review-cost changes.",
    contextFiles: "Limited repository context. Use only as background, not as changed code.",
    ruleFindings: "Rule precheck hints. They guide attention but are not final risk conclusions.",
    contextPolicy: "Shows truncation and context budget decisions applied before AI analysis.",
  };
}

function mapChangedFile(
  file: ChangedFile,
  ruleFindings: RuleFinding[],
  maxPatchCharsPerFile: number,
  budget: ContextBudget,
): AiReviewChangedFile {
  return {
    filePath: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: takeBudgetedText(
      file.patch,
      maxPatchCharsPerFile,
      `changedFiles.${file.filename}.patch`,
      budget,
    ),
    ruleFindingTypes: ruleFindings
      .filter((finding) => finding.filePath === file.filename)
      .map((finding) => finding.type),
  };
}

function sortChangedFiles(
  changedFiles: ChangedFile[],
  ruleFindings: RuleFinding[],
): ChangedFile[] {
  return [...changedFiles].sort((left, right) => {
    const scoreDiff =
      scoreChangedFile(right, ruleFindings) - scoreChangedFile(left, ruleFindings);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return left.filename.localeCompare(right.filename);
  });
}

function scoreChangedFile(file: ChangedFile, ruleFindings: RuleFinding[]): number {
  const fileFindings = ruleFindings.filter(
    (finding) => finding.filePath === file.filename,
  );
  const ruleScore = fileFindings.reduce(
    (score, finding) => score + scoreFinding(finding.level, finding.type),
    0,
  );
  const changeScore = Math.min(file.changes, 500) / 10;

  return ruleScore + changeScore;
}

function scoreFinding(level: RuleFindingLevel, type: RuleFindingType): number {
  const levelScore = level === "high" ? 100 : level === "medium" ? 60 : 25;
  const typeScore =
    type === "security" || type === "permission"
      ? 40
      : type === "dependency"
        ? 25
        : 10;

  return levelScore + typeScore;
}

function takeBudgetedText(
  text: string,
  perItemLimit: number,
  label: string,
  budget: ContextBudget,
): string {
  const itemLimited = truncateText(text, perItemLimit, label, budget);
  const remainingBudget = budget.maxTotalChars - budget.usedChars;

  if (itemLimited.length <= remainingBudget) {
    budget.usedChars += itemLimited.length;
    return itemLimited;
  }

  budget.truncated = true;
  budget.truncatedItems.push(label);

  if (remainingBudget <= 0) {
    return "[truncated: context budget exhausted]";
  }

  const suffix = `\n...[truncated ${itemLimited.length - remainingBudget} chars: total context budget]`;
  const visibleChars = Math.max(0, remainingBudget - suffix.length);
  const result = `${itemLimited.slice(0, visibleChars)}${suffix}`;
  budget.usedChars += result.length;

  return result;
}

function truncateText(
  text: string,
  maxChars: number,
  label: string,
  budget: ContextBudget,
): string {
  if (text.length <= maxChars) {
    return text;
  }

  budget.truncated = true;
  budget.truncatedItems.push(label);

  return `${text.slice(0, maxChars)}\n...[truncated ${text.length - maxChars} chars: per-item limit]`;
}

