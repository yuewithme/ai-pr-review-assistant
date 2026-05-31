import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../app/api/pr/report-html/route.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("POST /api/pr/report-html returns generated report HTML", async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/pulls/123")) {
      return jsonResponse({
        title: "Add report endpoint",
        body: "Adds HTML report generation",
        user: { login: "octocat" },
        head: { ref: "feature/report" },
        base: { ref: "main" },
        html_url: "https://github.com/owner/repo/pull/123",
        state: "open",
      });
    }

    if (String(url).endsWith("/pulls/123/files")) {
      return jsonResponse([
        {
          filename: "lib/report-html.ts",
          status: "added",
          additions: 20,
          deletions: 0,
          changes: 20,
          patch: "+ export function render() {}",
        },
      ]);
    }

    return jsonResponse({ message: "Not Found" }, { status: 404 });
  };

  const request = new Request("http://localhost/api/pr/report-html", {
    method: "POST",
    body: JSON.stringify({
      prUrl: "https://github.com/owner/repo/pull/123",
    }),
  });

  const response = await POST(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.prUrl, "https://github.com/owner/repo/pull/123");
  assert.ok(body.data.analysisId);
  assert.match(body.data.html, /^<!doctype html>/);
  assert.match(body.data.html, /Add report endpoint/);
  assert.match(body.data.html, /风险详情/);
  assert.match(body.data.html, /Review 建议/);
  assert.match(body.data.html, /文件级变更摘要/);
  assert.doesNotMatch(body.data.html, /内容截断|truncated|<dt>位置<\/dt>/i);
});

test("POST /api/pr/report-html returns parser errors", async () => {
  const request = new Request("http://localhost/api/pr/report-html", {
    method: "POST",
    body: JSON.stringify({
      prUrl: "https://example.com/owner/repo/pull/123",
    }),
  });

  const response = await POST(request);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "INVALID_GITHUB_DOMAIN");
});

