import type {
  AnalysisResult,
  AnalysisRisk,
  FileSummary,
  ReviewSuggestion,
  RuleFinding,
} from "../types/analysis.ts";
import type { ChangedFile, FetchedPrData } from "../types/github.ts";

export function mockAnalysisResult(
  prData: FetchedPrData,
  ruleFindings: RuleFinding[],
): AnalysisResult {
  const fileSummaries = prData.files.map(createFileSummary);
  const risks = ruleFindings.map((finding) =>
    createRiskFromRuleFinding(
      finding,
      prData.files.find((file) => file.filename === finding.filePath),
    ),
  );

  return {
    analysisId: createAnalysisId(prData.pr.url),
    status: "completed",
    prInfo: prData.pr,
    summary: createSummary(prData.files.length, fileSummaries),
    risks,
    reviewSuggestions: createReviewSuggestions(prData.files, risks),
    fileSummaries,
    ruleFindings,
  };
}

function createFileSummary(file: ChangedFile): FileSummary {
  return {
    filePath: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    summary: `${file.filename} 状态为 ${file.status}，新增 ${file.additions} 行，删除 ${file.deletions} 行。`,
  };
}

function createRiskFromRuleFinding(
  finding: RuleFinding,
  file?: ChangedFile,
): AnalysisRisk {
  return {
    type: finding.type,
    level: finding.level,
    filePath: finding.filePath,
    message: `规则预检测提示该文件存在 ${finding.type} 相关关注点，需要结合实际 diff 复核。`,
    evidence: `来源于规则预检测：${finding.type} 命中 ${finding.filePath}。请结合下方代码片段或 PR 文件变更确认实际影响。`,
    codeSnippet: extractRelevantPatchSnippet(file?.patch),
    suggestion:
      "请打开该文件的 PR diff，确认规则命中的代码是否真的影响功能、安全或维护成本；如果确认存在影响，再补充对应测试或把相关逻辑收敛到更明确的实现中。",
    confidence: 0.6,
  };
}

function createReviewSuggestions(
  files: ChangedFile[],
  risks: AnalysisRisk[],
): ReviewSuggestion[] {
  const riskSuggestions = risks.map((risk) => ({
    filePath: risk.filePath,
    message: `建议在合并前复核 ${risk.filePath} 中的 ${risk.type} 相关改动是否符合预期。`,
    suggestedCode: createSuggestedCode(risk),
  }));

  if (riskSuggestions.length > 0) {
    return riskSuggestions;
  }

  return files.slice(0, 3).map((file) => ({
    filePath: file.filename,
    message: `请确认 ${file.filename} 的 diff 与本次 PR 目标一致。`,
    suggestedCode: "",
  }));
}

function createSuggestedCode(risk: AnalysisRisk): string {
  const snippet = risk.codeSnippet?.trim();

  if (!snippet) {
    return "";
  }

  if (risk.type === "test-missing") {
    return `test("覆盖 ${risk.filePath} 的异常或边界场景", async () => {\n  // 基于本次 PR 的实际接口补充断言\n});`;
  }

  return `${snippet}\n// 请基于上方变更补充明确校验、错误处理或类型约束后再合并。`;
}

function createSummary(fileCount: number, fileSummaries: FileSummary[]): string {
  const totalAdditions = fileSummaries.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = fileSummaries.reduce((sum, file) => sum + file.deletions, 0);

  return `模拟分析已覆盖 ${fileCount} 个变更文件，共新增 ${totalAdditions} 行、删除 ${totalDeletions} 行。该结果用于在真实 AI 不可用时保持接口结构稳定。`;
}

function createAnalysisId(seed: string): string {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return `mock_${hash.toString(16)}`;
}

function extractRelevantPatchSnippet(patch?: string): string {
  if (!patch) {
    return "";
  }

  return patch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .slice(0, 8)
    .join("\n");
}
