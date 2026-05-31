import { analyzePullRequest } from "../../../../lib/ai-review.ts";
import { fetchPrData, GitHubApiError } from "../../../../lib/github.ts";
import { mockAnalysisResult } from "../../../../lib/mock-analysis.ts";
import { parseGitHubPrUrl, PrUrlParseError } from "../../../../lib/parser.ts";
import { renderPrReviewHtmlReport } from "../../../../lib/report-html.ts";
import { errorResponse, successResponse } from "../../../../lib/response.ts";
import { checkRules } from "../../../../lib/rule-checker.ts";
import type { ReportHtmlResult } from "../../../../types/report.ts";

type ReportHtmlRequestBody = {
  prUrl?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  let body: ReportHtmlRequestBody;

  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON.");
  }

  if (typeof body.prUrl !== "string" || body.prUrl.trim() === "") {
    return errorResponse("INVALID_PR_URL", "Request body must include prUrl.");
  }

  try {
    const parsedPrUrl = parseGitHubPrUrl(body.prUrl);
    const prData = await fetchPrData(parsedPrUrl);
    const ruleFindings = checkRules(prData.files);
    const analysisDetails = await analyzePullRequest({
      prInfo: prData.pr,
      changedFiles: prData.files,
      contextFiles: prData.contextFiles,
      ruleFindings,
    });
    const fallbackMetadata = mockAnalysisResult(prData, ruleFindings);
    const analysisResult = {
      analysisId: fallbackMetadata.analysisId,
      status: fallbackMetadata.status,
      prInfo: prData.pr,
      ...analysisDetails,
      ruleFindings,
    };
    const html = renderPrReviewHtmlReport(analysisResult);

    const result: ReportHtmlResult = {
      analysisId: analysisResult.analysisId,
      prUrl: prData.pr.url,
      html,
    };

    return successResponse(result);
  } catch (error) {
    if (error instanceof PrUrlParseError) {
      return errorResponse(error.code, error.message);
    }

    if (error instanceof GitHubApiError) {
      return errorResponse(error.code, error.message, error.status);
    }

    return errorResponse("INTERNAL_ERROR", "Failed to generate PR report HTML.", 500);
  }
}
