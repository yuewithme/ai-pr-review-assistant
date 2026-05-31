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
                    evidence: "patch 中新增了 token 存在时直接返回 true 的判断。",
                    codeSnippet: "+ if (token) return true",
                    suggestion: "请补充 token 缺失、无效 token 和有效 token 的回归测试，确认鉴权分支符合预期。",
                    confidence: 0.82,
                  },
                ],
                reviewSuggestions: [
                  {
                    filePath: "src/auth/middleware.ts",
                    message: "Could you add a regression test for invalid token handling?",
                    suggestedCode:
                      "test('rejects invalid token', async () => {\n  expect(checkAuth('bad-token')).toBe(false);\n});",
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
  assert.equal(result.risks[0].evidence, "patch 中新增了 token 存在时直接返回 true 的判断。");
  assert.equal(result.risks[0].codeSnippet, "+ if (token) return true");
  assert.match(result.reviewSuggestions[0].suggestedCode || "", /rejects invalid token/);
  assert.equal(requestUrl, "https://api.deepseek.com/chat/completions");
  assert.match(requestBody, /只返回严格 JSON/);
  assert.match(requestBody, /所有解释性内容必须使用中文/);
  assert.match(requestBody, /不要原样照抄成风险描述/);
  assert.match(requestBody, /codeSnippet/);
  assert.match(requestBody, /suggestedCode/);
  assert.match(requestBody, /两者不能写成同一句话/);
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

  assert.match(result.summary, /模拟分析已覆盖/);
  assert.equal(result.risks[0].confidence, 0.6);
  assert.match(result.risks[0].message, /规则预检测/);
  assert.match(result.risks[0].evidence, /来源于规则预检测/);
  assert.match(result.risks[0].suggestion, /打开该文件的 PR diff/);
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
