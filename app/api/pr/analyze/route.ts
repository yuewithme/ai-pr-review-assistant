import { fetchPrData, GitHubApiError } from "../../../../lib/github.ts";
import { mockAnalysisResult } from "../../../../lib/mock-analysis.ts";
import { parseGitHubPrUrl, PrUrlParseError } from "../../../../lib/parser.ts";
import { checkRules } from "../../../../lib/rule-checker.ts";
import { errorResponse, successResponse } from "../../../../lib/response.ts";

type AnalyzePrRequestBody = {
  prUrl?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  let body: AnalyzePrRequestBody;

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
    const analysis = mockAnalysisResult(prData, ruleFindings);

    return successResponse(analysis);
  } catch (error) {
    if (error instanceof PrUrlParseError) {
      return errorResponse(error.code, error.message);
    }

    if (error instanceof GitHubApiError) {
      return errorResponse(error.code, error.message, error.status);
    }

    return errorResponse("INTERNAL_ERROR", "Failed to analyze PR.", 500);
  }
}

