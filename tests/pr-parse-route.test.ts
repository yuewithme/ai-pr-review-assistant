import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "../app/api/pr/parse/route.ts";

test("POST /api/pr/parse returns parsed PR URL data", async () => {
  const request = new Request("http://localhost/api/pr/parse", {
    method: "POST",
    body: JSON.stringify({
      prUrl: "https://github.com/owner/repo/pull/123",
    }),
  });

  const response = await POST(request);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    success: true,
    data: {
      owner: "owner",
      repo: "repo",
      pullNumber: 123,
      normalizedUrl: "https://github.com/owner/repo/pull/123",
    },
  });
});

test("POST /api/pr/parse rejects missing prUrl", async () => {
  const request = new Request("http://localhost/api/pr/parse", {
    method: "POST",
    body: JSON.stringify({}),
  });

  const response = await POST(request);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, {
    success: false,
    error: {
      code: "INVALID_PR_URL",
      message: "Request body must include prUrl.",
    },
  });
});

