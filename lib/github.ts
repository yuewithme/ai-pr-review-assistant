import type {
  ChangedFile,
  ContextFile,
  FetchedPrData,
  ParsedPrUrl,
  PrInfo,
} from "../types/github.ts";

const GITHUB_API_BASE_URL = "https://api.github.com";
const CONTEXT_FILE_PATHS = [
  "README.md",
  "package.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
];

type GitHubPullRequestResponse = {
  title?: string;
  body?: string | null;
  user?: {
    login?: string;
  } | null;
  head?: {
    ref?: string;
    sha?: string;
  };
  base?: {
    ref?: string;
  };
  html_url?: string;
  state?: string;
};

type GitHubChangedFileResponse = {
  filename?: string;
  status?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
};

type GitHubRepositoryFileResponse = {
  path?: string;
  content?: string;
  encoding?: string;
};

export class GitHubApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "GitHubApiError";
    this.code = code;
    this.status = status;
  }
}

function buildGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ai-pr-review-assistant",
  };
  const token = process.env.GITHUB_TOKEN;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function fetchGitHubJson<T>(url: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: buildGitHubHeaders(),
    });
  } catch {
    throw new GitHubApiError(
      "GITHUB_NETWORK_ERROR",
      "Failed to connect to GitHub API.",
      503,
    );
  }

  const responseBody = await readJsonBody(response);

  if (!response.ok) {
    throw mapGitHubError(response, responseBody);
  }

  return responseBody as T;
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function mapGitHubError(response: Response, body: unknown): GitHubApiError {
  const message =
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
      ? body.message
      : "GitHub API request failed.";

  if (
    response.status === 403 &&
    response.headers.get("x-ratelimit-remaining") === "0"
  ) {
    return new GitHubApiError(
      "GITHUB_RATE_LIMITED",
      "GitHub API rate limit exceeded.",
      429,
    );
  }

  if (response.status === 404) {
    return new GitHubApiError(
      "GITHUB_RESOURCE_NOT_FOUND",
      "Repository or pull request was not found.",
      404,
    );
  }

  return new GitHubApiError("GITHUB_API_ERROR", message, response.status);
}

function buildApiUrl(path: string): string {
  return `${GITHUB_API_BASE_URL}${path}`;
}

export async function fetchPullRequest(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PrInfo> {
  const data = await fetchGitHubJson<GitHubPullRequestResponse>(
    buildApiUrl(`/repos/${owner}/${repo}/pulls/${pullNumber}`),
  );

  return {
    owner,
    repo,
    pullNumber,
    title: data.title ?? "",
    description: data.body ?? "",
    author: data.user?.login ?? "",
    sourceBranch: data.head?.ref ?? "",
    targetBranch: data.base?.ref ?? "",
    url: data.html_url ?? `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
    state: data.state ?? "",
  };
}

export async function fetchPullRequestFiles(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<ChangedFile[]> {
  const files = await fetchGitHubJson<GitHubChangedFileResponse[]>(
    buildApiUrl(`/repos/${owner}/${repo}/pulls/${pullNumber}/files`),
  );

  const changedFiles = files.map((file) => ({
    filename: file.filename ?? "",
    status: file.status ?? "",
    additions: file.additions ?? 0,
    deletions: file.deletions ?? 0,
    changes: file.changes ?? 0,
    patch: file.patch ?? "",
  }));

  if (
    changedFiles.length > 0 &&
    changedFiles.every((file) => file.patch.trim() === "")
  ) {
    throw new GitHubApiError(
      "PATCH_NOT_AVAILABLE",
      "GitHub did not return patch content for the changed files.",
      422,
    );
  }

  return changedFiles;
}

export async function fetchRepositoryFile(
  owner: string,
  repo: string,
  path: string,
  ref?: string,
): Promise<ContextFile | null> {
  const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const url = buildApiUrl(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${refQuery}`,
  );

  try {
    const data = await fetchGitHubJson<GitHubRepositoryFileResponse>(url);

    if (data.encoding !== "base64" || !data.content) {
      return null;
    }

    return {
      path: data.path ?? path,
      content: Buffer.from(data.content, "base64").toString("utf8"),
    };
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function fetchPrData(parsedPrUrl: ParsedPrUrl): Promise<FetchedPrData> {
  const pr = await fetchPullRequest(
    parsedPrUrl.owner,
    parsedPrUrl.repo,
    parsedPrUrl.pullNumber,
  );
  const files = await fetchPullRequestFiles(
    parsedPrUrl.owner,
    parsedPrUrl.repo,
    parsedPrUrl.pullNumber,
  );
  const contextFiles = await fetchContextFiles(parsedPrUrl, pr.sourceBranch);

  return {
    pr,
    files,
    contextFiles,
  };
}

async function fetchContextFiles(
  parsedPrUrl: ParsedPrUrl,
  ref?: string,
): Promise<ContextFile[]> {
  const contextFiles = await Promise.all(
    CONTEXT_FILE_PATHS.map((path) =>
      fetchRepositoryFile(parsedPrUrl.owner, parsedPrUrl.repo, path, ref),
    ),
  );

  return contextFiles.filter((file): file is ContextFile => file !== null);
}

