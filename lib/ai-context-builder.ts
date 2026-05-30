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
  };
}

function mapChangedFile(
  file: ChangedFile,
  ruleFindings: RuleFinding[],
  maxPatchCharsPerFile: number,
  budget: ContextBudget,
): AiReviewChangedFile {
  const fileRuleFindings = ruleFindings.filter(
    (finding) => finding.filePath === file.filename,
  );

  return {
    filePath: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    patch: takeBudgetedPatch(
      file.patch,
      maxPatchCharsPerFile,
      `changedFiles.${file.filename}.patch`,
      fileRuleFindings,
      budget,
    ),
    ruleFindingTypes: fileRuleFindings.map((finding) => finding.type),
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
  const itemLimited = takeSilentText(text, perItemLimit, label, budget);
  const remainingBudget = budget.maxTotalChars - budget.usedChars;

  if (itemLimited.length <= remainingBudget) {
    budget.usedChars += itemLimited.length;
    return itemLimited;
  }

  markTruncated(label, budget);

  if (remainingBudget <= 0) {
    return "";
  }

  const result = itemLimited.slice(0, remainingBudget);
  budget.usedChars += result.length;

  return result;
}

function takeBudgetedPatch(
  text: string,
  maxChars: number,
  label: string,
  ruleFindings: RuleFinding[],
  budget: ContextBudget,
): string {
  const itemLimited = takePatchText(text, maxChars, label, ruleFindings, budget);
  const remainingBudget = budget.maxTotalChars - budget.usedChars;

  if (itemLimited.length <= remainingBudget) {
    budget.usedChars += itemLimited.length;
    return itemLimited;
  }

  markTruncated(label, budget);

  if (remainingBudget <= 0) {
    return "";
  }

  const result = takePatchText(
    itemLimited,
    remainingBudget,
    label,
    ruleFindings,
    budget,
  );
  budget.usedChars += result.length;

  return result;
}

function takeSilentText(
  text: string,
  maxChars: number,
  label: string,
  budget: ContextBudget,
): string {
  if (text.length <= maxChars) {
    return text;
  }

  markTruncated(label, budget);

  return text.slice(0, maxChars);
}

function takePatchText(
  patch: string,
  maxChars: number,
  label: string,
  ruleFindings: RuleFinding[],
  budget: ContextBudget,
): string {
  if (patch.length <= maxChars) {
    return patch;
  }

  markTruncated(label, budget);

  const hunks = splitPatchHunks(patch);

  if (hunks.length <= 1) {
    return patch.slice(0, maxChars);
  }

  const selectedHunks: string[] = [];
  let usedChars = 0;

  for (const hunk of scorePatchHunks(hunks, ruleFindings)) {
    if (usedChars >= maxChars) {
      break;
    }

    const separatorLength = selectedHunks.length > 0 ? 1 : 0;
    const remaining = maxChars - usedChars - separatorLength;

    if (remaining <= 0) {
      break;
    }

    const nextHunk = hunk.length <= remaining ? hunk : hunk.slice(0, remaining);

    selectedHunks.push(nextHunk);
    usedChars += separatorLength + nextHunk.length;
  }

  return selectedHunks.join("\n");
}

function splitPatchHunks(patch: string): string[] {
  const lines = patch.split("\n");
  const hunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.startsWith("@@ ") && current.length > 0) {
      hunks.push(current.join("\n"));
      current = [line];
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    hunks.push(current.join("\n"));
  }

  return hunks;
}

function scorePatchHunks(
  hunks: string[],
  ruleFindings: RuleFinding[],
): string[] {
  return hunks
    .map((hunk, index) => ({
      hunk,
      index,
      score: scorePatchHunk(hunk, ruleFindings),
    }))
    .sort((left, right) => {
      const scoreDiff = right.score - left.score;

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return left.index - right.index;
    })
    .map((item) => item.hunk);
}

function scorePatchHunk(hunk: string, ruleFindings: RuleFinding[]): number {
  const lowerHunk = hunk.toLowerCase();
  let score = 0;

  if (/[+-]/.test(hunk)) {
    score += 10;
  }

  for (const keyword of [
    "auth",
    "login",
    "permission",
    "token",
    "middleware",
    "secret",
    "password",
    "console.log",
    "todo",
    " any",
  ]) {
    if (lowerHunk.includes(keyword)) {
      score += 20;
    }
  }

  for (const finding of ruleFindings) {
    score += scoreFinding(finding.level, finding.type);
  }

  return score;
}

function markTruncated(label: string, budget: ContextBudget): void {
  budget.truncated = true;

  if (!budget.truncatedItems.includes(label)) {
    budget.truncatedItems.push(label);
  }
}
