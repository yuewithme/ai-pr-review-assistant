import assert from "node:assert/strict";
import test from "node:test";

import { fetchPrData, GitHubApiError } from "../lib/github.ts";
import type { ParsedPrUrl } from "../types/github.ts";

const parsedPrUrl: ParsedPrUrl = {
  owner: "owner",
  repo: "repo",
  pullNumber: 123,
  normalizedUrl: "https://github.com/owner/repo/pull/123",
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("fetchPrData maps PR metadata, changed files, and available context files", async () => {
  const requestedUrls: string[] = [];

  globalThis.fetch = async (url, init) => {
    requestedUrls.push(String(url));

    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer test-token",
    );

    if (String(url).endsWith("/pulls/123")) {
      return jsonResponse({
        title: "Add parser",
        body: "Parse GitHub PR links",
        user: { login: "octocat" },
        head: { ref: "feature/parser" },
        base: { ref: "main" },
        html_url: "https://github.com/owner/repo/pull/123",
        state: "open",
      });
    }

    if (String(url).endsWith("/pulls/123/files")) {
      return jsonResponse([
        {
          filename: "lib/parser.ts",
          status: "modified",
          additions: 10,
          deletions: 2,
          changes: 12,
          patch: "@@ -1 +1 @@",
        },
      ]);
    }

    if (String(url).includes("/contents/README.md")) {
      return jsonResponse({
        path: "README.md",
        content: Buffer.from("# Project").toString("base64"),
        encoding: "base64",
      });
    }

    return jsonResponse(
      { message: "Not Found" },
      {
        status: 404,
      },
    );
  };

  process.env.GITHUB_TOKEN = "test-token";

  const data = await fetchPrData(parsedPrUrl);

  assert.equal(data.pr.title, "Add parser");
  assert.equal(data.pr.author, "octocat");
  assert.equal(data.files[0].filename, "lib/parser.ts");
  assert.equal(data.files[0].patch, "@@ -1 +1 @@");
  assert.deepEqual(data.contextFiles, [
    {
      path: "README.md",
      content: "# Project",
    },
  ]);
  assert.ok(requestedUrls.some((url) => url.includes("/contents/package.json")));
});

test("fetchPrData throws a structured rate limit error", async () => {
  globalThis.fetch = async () =>
    jsonResponse(
      { message: "API rate limit exceeded" },
      {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "0",
        },
      },
    );

  await assert.rejects(() => fetchPrData(parsedPrUrl), {
    name: "GitHubApiError",
    code: "GITHUB_RATE_LIMITED",
  });
});

test("fetchPrData throws when no changed file patch is available", async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/pulls/123")) {
      return jsonResponse({
        title: "Binary update",
        body: "",
        user: { login: "octocat" },
        head: { ref: "feature/binary" },
        base: { ref: "main" },
        html_url: "https://github.com/owner/repo/pull/123",
        state: "open",
      });
    }

    return jsonResponse([
      {
        filename: "asset.png",
        status: "modified",
        additions: 0,
        deletions: 0,
        changes: 0,
      },
    ]);
  };

  await assert.rejects(() => fetchPrData(parsedPrUrl), {
    name: "GitHubApiError",
    code: "PATCH_NOT_AVAILABLE",
  });
});

test("GitHubApiError exposes code, message, and status", () => {
  const error = new GitHubApiError("REPOSITORY_NOT_FOUND", "Missing repo.", 404);

  assert.equal(error.code, "REPOSITORY_NOT_FOUND");
  assert.equal(error.message, "Missing repo.");
  assert.equal(error.status, 404);
});

