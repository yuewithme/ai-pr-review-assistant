import assert from "node:assert/strict";
import test from "node:test";

import { parseGitHubPrUrl } from "../lib/parser.ts";

test("parses a valid GitHub pull request URL", () => {
  const parsed = parseGitHubPrUrl("https://github.com/owner/repo/pull/123");

  assert.deepEqual(parsed, {
    owner: "owner",
    repo: "repo",
    pullNumber: 123,
    normalizedUrl: "https://github.com/owner/repo/pull/123",
  });
});

test("rejects non-GitHub domains", () => {
  assert.throws(
    () => parseGitHubPrUrl("https://example.com/owner/repo/pull/123"),
    {
      code: "INVALID_GITHUB_DOMAIN",
    },
  );
});

test("rejects URLs without pull path", () => {
  assert.throws(() => parseGitHubPrUrl("https://github.com/owner/repo/issues/123"), {
    code: "INVALID_PULL_REQUEST_PATH",
  });
});

test("rejects non-numeric pull numbers", () => {
  assert.throws(() => parseGitHubPrUrl("https://github.com/owner/repo/pull/abc"), {
    code: "INVALID_PULL_NUMBER",
  });
});

