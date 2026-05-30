import assert from "node:assert/strict";
import test from "node:test";

import { analyzePullRequest } from "../lib/ai-review.ts";
import type { RuleFinding } from "../types/analysis.ts";
import type { ChangedFile, ContextFile, PrInfo } from "../types/github.ts";

const prInfo: PrInfo = {
  owner: "owner",
  repo: "repo",
  pullNumber: 123,
  title: "Update auth",
  description: "Change auth middleware",
  author: "octocat",
  sourceBranch: "feature/auth",
  targetBranch: "main",
  url: "https://github.com/owner/repo/pull/123",
  state: "open",
};

const changedFiles: ChangedFile[] = [
  {
    filename: "src/auth/middleware.ts",
    status: "modified",
    additions: 10,
    deletions: 2,
    changes: 12,
    patch: "+ if (token) return true",
  },
];

const contextFiles: ContextFile[] = [];

const ruleFindings: RuleFinding[] = [
  {
    type: "permission",
    level: "medium",
    filePath: "src/auth/middleware.ts",
    message: "Permission-sensitive path changed; use this as an AI analysis reference, not a final risk conclusion.",
  },
];

test("analyzePullRequest returns structured AI JSON with stable metadata", async () => {
  process.env.DEEPSEEK_API_KEY = "test-key";
  let requestBody = "";
  let requestUrl = "";

  globalThis.fetch = async (url, init) => {
    requestUrl = String(url);
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-key");
    requestBody = String(init?.body);

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Auth middleware behavior changed.",
                risks: [
                  {
                    type: "permission",
                    level: "medium",
                    filePath: "src/auth/middleware.ts",
                    message: "Auth decision logic changed.",
                    suggestion: "Please add tests for missing and invalid tokens.",
                    confidence: 0.82,
                  },
                ],
                reviewSuggestions: [
                  {
                    filePath: "src/auth/middleware.ts",
                    message: "Could you add a regression test for invalid token handling?",
                  },
                ],
                fileSummaries: [
                  {
                    filePath: "src/auth/middleware.ts",
                    status: "modified",
                    additions: 10,
                    deletions: 2,
                    changes: 12,
                    summary: "Updates auth middleware token handling.",
                  },
                ],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await analyzePullRequest({
    prInfo,
    changedFiles,
    contextFiles,
    ruleFindings,
  });

  assert.equal(result.summary, "Auth middleware behavior changed.");
  assert.equal(result.risks[0].confidence, 0.82);
  assert.equal(result.risks[0].filePath, "src/auth/middleware.ts");
  assert.equal(requestUrl, "https://api.deepseek.com/chat/completions");
  assert.match(requestBody, /Return strict JSON only/);
  assert.match(requestBody, /deepseek-v4-flash/);
});

test("analyzePullRequest falls back when AI JSON cannot be parsed", async () => {
  process.env.DEEPSEEK_API_KEY = "test-key";

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "not json" } }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const result = await analyzePullRequest({
    prInfo,
    changedFiles,
    contextFiles,
    ruleFindings,
  });

  assert.match(result.summary, /Mock analysis reviewed/);
  assert.equal(result.risks[0].confidence, 0.6);
});

test("analyzePullRequest truncates long patches before sending to AI", async () => {
  process.env.DEEPSEEK_API_KEY = "test-key";
  const longPatch = `+${"x".repeat(20_000)}`;
  let requestBody = "";

  globalThis.fetch = async (_url, init) => {
    requestBody = String(init?.body);

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: "Large file reviewed.",
                risks: [],
                reviewSuggestions: [],
                fileSummaries: [
                  {
                    filePath: "src/large.ts",
                    status: "modified",
                    additions: 1,
                    deletions: 0,
                    changes: 1,
                    summary: "Large patch was summarized.",
                  },
                ],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  await analyzePullRequest({
    prInfo,
    changedFiles: [
      {
        filename: "src/large.ts",
        status: "modified",
        additions: 1,
        deletions: 0,
        changes: 1,
        patch: longPatch,
      },
    ],
    contextFiles,
    ruleFindings: [],
  });

  assert.ok(requestBody.length < 15_000);
  assert.doesNotMatch(requestBody, /truncated|内容截断|Context Policy/i);
});
