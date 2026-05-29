import { fetchPrData, GitHubApiError } from "../../../../lib/github.ts";
import { parseGitHubPrUrl, PrUrlParseError } from "../../../../lib/parser.ts";
import { errorResponse, successResponse } from "../../../../lib/response.ts";

type FetchPrRequestBody = {
  prUrl?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  let body: FetchPrRequestBody;

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

    return successResponse(prData);
  } catch (error) {
    if (error instanceof PrUrlParseError) {
      return errorResponse(error.code, error.message);
    }

    if (error instanceof GitHubApiError) {
      return errorResponse(error.code, error.message, error.status);
    }

    return errorResponse("INTERNAL_ERROR", "Failed to fetch PR data.", 500);
  }
}
