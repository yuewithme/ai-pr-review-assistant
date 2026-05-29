import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../app/api/pr/fetch/route.ts";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("POST /api/pr/fetch returns fetched PR data", async () => {
  globalThis.fetch = async (url) => {
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

    return jsonResponse({ message: "Not Found" }, { status: 404 });
  };

  const request = new Request("http://localhost/api/pr/fetch", {
    method: "POST",
    body: JSON.stringify({
      prUrl: "https://github.com/owner/repo/pull/123",
    }),
  });

  const response = await POST(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.pr.title, "Add parser");
  assert.equal(body.data.files[0].patch, "@@ -1 +1 @@");
});

test("POST /api/pr/fetch returns parser errors", async () => {
  const request = new Request("http://localhost/api/pr/fetch", {
    method: "POST",
    body: JSON.stringify({
      prUrl: "https://example.com/owner/repo/pull/123",
    }),
  });

  const response = await POST(request);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    success: false,
    error: {
      code: "INVALID_GITHUB_DOMAIN",
      message: "PR URL must use the github.com domain.",
    },
  });
});

