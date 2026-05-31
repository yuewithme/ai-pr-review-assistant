import assert from "node:assert/strict";
import test from "node:test";

import { buildAiReviewContext } from "../lib/ai-context-builder.ts";
import type { RuleFinding } from "../types/analysis.ts";
import type { ChangedFile, ContextFile, PrInfo } from "../types/github.ts";

const prInfo: PrInfo = {
  owner: "owner",
  repo: "repo",
  pullNumber: 123,
  title: "Update auth flow",
  description: "Changes login behavior",
  author: "octocat",
  sourceBranch: "feature/auth",
  targetBranch: "main",
  url: "https://github.com/owner/repo/pull/123",
  state: "open",
};

function file(overrides: Partial<ChangedFile>): ChangedFile {
  return {
    filename: "src/app.ts",
    status: "modified",
    additions: 1,
    deletions: 0,
    changes: 1,
    patch: "+ const value = 1",
    ...overrides,
  };
}

test("buildAiReviewContext filters fields and explains how AI should use them", () => {
  const context = buildAiReviewContext({
    prInfo,
    changedFiles: [file({ filename: "src/app.ts" })],
    contextFiles: [],
    ruleFindings: [],
  });

  assert.deepEqual(Object.keys(context.prInfo), [
    "title",
    "description",
    "sourceBranch",
    "targetBranch",
    "state",
    "url",
  ]);
  assert.equal(context.fieldGuide["changedFiles.patch"], "Primary code evidence for review. Use it before claiming behavior or risk.");
  assert.match(context.fieldGuide.ruleFindings, /hints/i);
  assert.equal(context.contextPolicy.truncated, false);
});

test("buildAiReviewContext sorts rule-hit and large files before low-risk files", () => {
  const ruleFindings: RuleFinding[] = [
    {
      type: "permission",
      level: "medium",
      filePath: "src/auth/session.ts",
      message: "Permission-sensitive path changed.",
    },
  ];

  const context = buildAiReviewContext({
    prInfo,
    changedFiles: [
      file({ filename: "src/plain.ts", changes: 5 }),
      file({ filename: "src/large.ts", changes: 350 }),
      file({ filename: "src/auth/session.ts", changes: 10 }),
    ],
    contextFiles: [],
    ruleFindings,
  });

  assert.deepEqual(
    context.changedFiles.map((changedFile) => changedFile.filePath),
    ["src/auth/session.ts", "src/large.ts", "src/plain.ts"],
  );
  assert.deepEqual(context.changedFiles[0].ruleFindingTypes, ["permission"]);
});

test("buildAiReviewContext truncates long patches and context files", () => {
  const longPatch = `+${"x".repeat(10_000)}`;
  const contextFiles: ContextFile[] = [
    {
      path: "README.md",
      content: "r".repeat(5_000),
    },
  ];

  const context = buildAiReviewContext(
    {
      prInfo,
      changedFiles: [file({ filename: "src/large.ts", patch: longPatch })],
      contextFiles,
      ruleFindings: [],
    },
    {
      maxPatchCharsPerFile: 100,
      maxContextCharsPerFile: 80,
      maxTotalChars: 1_000,
    },
  );

  assert.equal(context.contextPolicy.truncated, true);
  assert.doesNotMatch(context.changedFiles[0].patch, /truncated|内容截断/i);
  assert.doesNotMatch(context.contextFiles[0].content, /truncated|内容截断/i);
  assert.equal(context.changedFiles[0].patch.length <= 100, true);
  assert.equal(context.contextFiles[0].content.length <= 80, true);
});

test("buildAiReviewContext preserves higher-risk diff hunks when trimming patches", () => {
  const longLowRiskHunk = [
    "@@ -1,4 +1,4 @@",
    `+${"x".repeat(300)}`,
  ].join("\n");
  const authHunk = [
    "@@ -20,4 +20,4 @@",
    "- return false;",
    "+ return token !== undefined;",
  ].join("\n");
  const patch = `${longLowRiskHunk}\n${authHunk}`;
  const ruleFindings: RuleFinding[] = [
    {
      type: "permission",
      level: "medium",
      filePath: "src/auth.ts",
      message: "Permission-sensitive path changed.",
    },
  ];

  const context = buildAiReviewContext(
    {
      prInfo,
      changedFiles: [file({ filename: "src/auth.ts", patch })],
      contextFiles: [],
      ruleFindings,
    },
    {
      maxPatchCharsPerFile: 120,
      maxTotalChars: 1_000,
    },
  );

  assert.match(context.changedFiles[0].patch, /token/);
  assert.doesNotMatch(context.changedFiles[0].patch, /truncated|内容截断/i);
});
