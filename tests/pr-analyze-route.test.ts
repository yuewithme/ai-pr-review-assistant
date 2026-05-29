import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../app/api/pr/analyze/route.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("POST /api/pr/analyze returns a complete mock analysis result", async () => {
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/pulls/123")) {
      return jsonResponse({
        title: "Add login flow",
        body: "Adds login middleware",
        user: { login: "octocat" },
        head: { ref: "feature/login" },
        base: { ref: "main" },
        html_url: "https://github.com/owner/repo/pull/123",
        state: "open",
      });
    }

    if (String(url).endsWith("/pulls/123/files")) {
      return jsonResponse([
        {
          filename: "src/auth/login.ts",
          status: "modified",
          additions: 20,
          deletions: 5,
          changes: 25,
          patch: "+ console.log('debug')",
        },
      ]);
    }

    return jsonResponse({ message: "Not Found" }, { status: 404 });
  };

  const request = new Request("http://localhost/api/pr/analyze", {
    method: "POST",
    body: JSON.stringify({
      prUrl: "https://github.com/owner/repo/pull/123",
    }),
  });

  const response = await POST(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, "completed");
  assert.equal(body.data.prInfo.title, "Add login flow");
  assert.ok(body.data.analysisId);
  assert.ok(body.data.summary);
  assert.equal(body.data.fileSummaries.length, 1);
  assert.ok(body.data.ruleFindings.length >= 1);
  assert.ok(body.data.risks.length >= 1);
  assert.ok(body.data.reviewSuggestions.length >= 1);
});

test("POST /api/pr/analyze returns parser errors", async () => {
  const request = new Request("http://localhost/api/pr/analyze", {
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

