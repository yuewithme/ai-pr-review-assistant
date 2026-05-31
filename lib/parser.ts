import type { ParsedPrUrl } from "../types/github.ts";

export class PrUrlParseError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "PrUrlParseError";
    this.code = code;
  }
}

export function parseGitHubPrUrl(prUrl: string): ParsedPrUrl {
  let url: URL;

  try {
    url = new URL(prUrl);
  } catch {
    throw new PrUrlParseError("INVALID_URL", "PR URL must be a valid URL.");
  }

  if (url.hostname !== "github.com") {
    throw new PrUrlParseError(
      "INVALID_GITHUB_DOMAIN",
      "PR URL must use the github.com domain.",
    );
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const [owner, repo, pullSegment, pullNumberSegment] = pathParts;

  if (!owner || !repo) {
    throw new PrUrlParseError(
      "INVALID_REPOSITORY_PATH",
      "PR URL must include owner and repo path segments.",
    );
  }

  if (pullSegment !== "pull") {
    throw new PrUrlParseError(
      "INVALID_PULL_REQUEST_PATH",
      "PR URL must include a /pull/ path segment.",
    );
  }

  if (!pullNumberSegment || !/^\d+$/.test(pullNumberSegment)) {
    throw new PrUrlParseError(
      "INVALID_PULL_NUMBER",
      "PR pull number must be numeric.",
    );
  }

  const pullNumber = Number(pullNumberSegment);

  return {
    owner,
    repo,
    pullNumber,
    normalizedUrl: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
  };
}

