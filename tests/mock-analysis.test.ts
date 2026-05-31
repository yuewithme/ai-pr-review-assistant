import assert from "node:assert/strict";
import test from "node:test";

import { mockAnalysisResult } from "../lib/mock-analysis.ts";
import type { RuleFinding } from "../types/analysis.ts";
import type { FetchedPrData } from "../types/github.ts";

const prData: FetchedPrData = {
  pr: {
    owner: "owner",
    repo: "repo",
    pullNumber: 123,
    title: "Add login flow",
    description: "Adds login middleware",
    author: "octocat",
    sourceBranch: "feature/login",
    targetBranch: "main",
    url: "https://github.com/owner/repo/pull/123",
    state: "open",
  },
  files: [
    {
      filename: "src/auth/login.ts",
      status: "modified",
      additions: 20,
      deletions: 5,
      changes: 25,
      patch: "@@ -1 +1 @@",
    },
  ],
  contextFiles: [],
};

const ruleFindings: RuleFinding[] = [
  {
    type: "permission",
    level: "medium",
    filePath: "src/auth/login.ts",
    message: "Permission-sensitive path changed; use this as an AI analysis reference, not a final risk conclusion.",
  },
];

test("mockAnalysisResult returns a stable analysis result from real changed files", () => {
  const result = mockAnalysisResult(prData, ruleFindings);

  assert.equal(result.status, "completed");
  assert.equal(result.prInfo.title, "Add login flow");
  assert.equal(result.ruleFindings, ruleFindings);
  assert.equal(result.fileSummaries.length, 1);
  assert.deepEqual(result.fileSummaries[0], {
    filePath: "src/auth/login.ts",
    status: "modified",
    additions: 20,
    deletions: 5,
    changes: 25,
    summary: "modified src/auth/login.ts with 20 additions and 5 deletions.",
  });
  assert.equal(result.risks.length, 1);
  assert.equal(result.risks[0].type, "permission");
  assert.equal(result.risks[0].confidence, 0.6);
});
