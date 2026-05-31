import assert from "node:assert/strict";
import test from "node:test";

import { renderPrReviewHtmlReport } from "../lib/report-html.ts";
import type { AnalysisResult } from "../types/analysis.ts";

const result: AnalysisResult = {
  analysisId: "analysis_1",
  status: "completed",
  prInfo: {
    owner: "owner",
    repo: "repo",
    pullNumber: 123,
    title: "Add parser",
    description: "Parse PR URLs",
    author: "octocat",
    sourceBranch: "feature/parser",
    targetBranch: "main",
    url: "https://github.com/owner/repo/pull/123",
    state: "open",
  },
  summary: "Adds parser support.",
  risks: [
    {
      type: "security",
      level: "low",
      filePath: ".env.example",
      message: "Environment example changed.",
      evidence: "patch 中新增了环境变量示例占位符。",
      codeSnippet: "+DEEPSEEK_API_KEY=your_deepseek_api_key",
      suggestion: "请确认示例文件只包含占位符，并在提交前检查不会把真实密钥写入版本控制。",
      suggestedCode: "DEEPSEEK_API_KEY=your_deepseek_api_key",
      confidence: 0.4,
    },
  ],
  reviewSuggestions: [
    {
      filePath: "lib/parser.ts",
      message: "Add parser edge case tests.",
      currentCode: "// missing invalid JSON test",
      suggestedCode: "test('rejects invalid JSON request body', async () => {\n  // assert 400 INVALID_JSON\n});",
    },
  ],
  fileSummaries: [
    {
      filePath: "lib/parser.ts",
      status: "modified",
      additions: 10,
      deletions: 2,
      changes: 12,
      summary: "Updates parser behavior.",
    },
  ],
  ruleFindings: [],
};

test("renderPrReviewHtmlReport returns the fixed HTML report shape", () => {
  const html = renderPrReviewHtmlReport(result);

  assert.match(html, /^<!doctype html>/);
  assert.match(html, /Add parser/);
  assert.match(html, /风险详情/);
  assert.match(html, /Review 建议/);
  assert.match(html, /代码修改对比/);
  assert.match(html, /修改前/);
  assert.match(html, /修改后/);
  assert.match(html, /missing invalid JSON test/);
  assert.match(html, /rejects invalid JSON request body/);
  assert.match(html, /DEEPSEEK_API_KEY=your_deepseek_api_key/);
  assert.match(html, /文件级变更摘要/);
  assert.doesNotMatch(html, /总体结论/);
  assert.match(html, /security \/ 安全/);
  assert.match(html, /patch 中新增了环境变量示例占位符/);
  assert.match(html, /\+DEEPSEEK_API_KEY=your_deepseek_api_key/);
  assert.match(html, /查看该文件在 PR 中的变更/);
  assert.match(html, /pull\/123\/files#diff-/);
  assert.doesNotMatch(html, /内容截断|truncated|<dt>位置<\/dt>/i);
});

test("renderPrReviewHtmlReport escapes user-controlled text", () => {
  const html = renderPrReviewHtmlReport({
    ...result,
    prInfo: {
      ...result.prInfo,
      title: "<script>alert(1)</script>",
    },
  });

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
});

