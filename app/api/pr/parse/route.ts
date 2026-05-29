import { parseGitHubPrUrl, PrUrlParseError } from "../../../../lib/parser.ts";
import { errorResponse, successResponse } from "../../../../lib/response.ts";

type ParsePrRequestBody = {
  prUrl?: unknown;
};

export async function POST(request: Request): Promise<Response> {
  let body: ParsePrRequestBody;

  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_JSON", "Request body must be valid JSON.");
  }

  if (typeof body.prUrl !== "string" || body.prUrl.trim() === "") {
    return errorResponse("INVALID_PR_URL", "Request body must include prUrl.");
  }

  try {
    const parsed = parseGitHubPrUrl(body.prUrl);
    return successResponse(parsed);
  } catch (error) {
    if (error instanceof PrUrlParseError) {
      return errorResponse(error.code, error.message);
    }

    return errorResponse("INTERNAL_ERROR", "Failed to parse PR URL.", 500);
  }
}

