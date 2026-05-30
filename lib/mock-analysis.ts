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
    summary: `${file.status} ${file.filename} with ${file.additions} additions and ${file.deletions} deletions.`,
  };
}

function createRiskFromRuleFinding(finding: RuleFinding): AnalysisRisk {
  return {
    type: finding.type,
    level: finding.level,
    filePath: finding.filePath,
    message: `Mock risk based on rule precheck: ${finding.message}`,
    suggestion:
      "Use this rule finding as a review prompt and verify the actual code impact before treating it as a confirmed risk.",
    confidence: 0.6,
  };
}

function createReviewSuggestions(
  files: ChangedFile[],
  risks: AnalysisRisk[],
): ReviewSuggestion[] {
  const riskSuggestions = risks.map((risk) => ({
    filePath: risk.filePath,
    message: `Review ${risk.filePath} for ${risk.type} concerns before merging.`,
  }));

  if (riskSuggestions.length > 0) {
    return riskSuggestions;
  }

  return files.slice(0, 3).map((file) => ({
    filePath: file.filename,
    message: `Review ${file.filename} and confirm the diff matches the PR intent.`,
  }));
}

function createSummary(fileCount: number, fileSummaries: FileSummary[]): string {
  const changedFileText = fileCount === 1 ? "1 file" : `${fileCount} files`;
  const totalAdditions = fileSummaries.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = fileSummaries.reduce((sum, file) => sum + file.deletions, 0);

  return `Mock analysis reviewed ${changedFileText}, with ${totalAdditions} additions and ${totalDeletions} deletions. This is a stable placeholder for future AI analysis.`;
}

function createAnalysisId(seed: string): string {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return `mock_${hash.toString(16)}`;
}
