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
  const risks = ruleFindings.map(createRiskFromRuleFinding);

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

function createRiskFromRuleFinding(finding: RuleFinding): AnalysisRisk {
  return {
    type: finding.type,
    level: finding.level,
    filePath: finding.filePath,
    message: `规则预检测提示该文件存在 ${finding.type} 相关关注点，需要结合实际 diff 复核。`,
    suggestion: "请将该规则命中作为审查线索，确认实际代码影响后再判断是否属于确定风险。",
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
  }));

  if (riskSuggestions.length > 0) {
    return riskSuggestions;
  }

  return files.slice(0, 3).map((file) => ({
    filePath: file.filename,
    message: `请确认 ${file.filename} 的 diff 与本次 PR 目标一致。`,
  }));
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
