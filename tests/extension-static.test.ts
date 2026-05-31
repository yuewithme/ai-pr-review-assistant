import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("extension manifest declares MV3 popup permissions and report pages", async () => {
  const manifest = JSON.parse(
    await readFile("extension/manifest.json", "utf-8"),
  ) as {
    manifest_version: number;
    action?: { default_popup?: string };
    permissions?: string[];
    host_permissions?: string[];
  };

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.action?.default_popup, "popup.html");
  assert.ok(manifest.permissions?.includes("storage"));
  assert.ok(manifest.permissions?.includes("tabs"));
  assert.ok(manifest.permissions?.includes("downloads"));
  assert.ok(manifest.host_permissions?.includes("https://github.com/*"));
  assert.ok(manifest.host_permissions?.includes("http://localhost:3000/*"));
});

test("extension popup recognizes GitHub PR URLs and calls report-html endpoint", async () => {
  const popup = await readFile("extension/popup.js", "utf-8");

  assert.match(popup, /normalizeGitHubPrUrl/);
  assert.match(popup, /github\.com/);
  assert.match(popup, /\/api\/pr\/report-html/);
  assert.match(popup, /chrome\.storage\.local/);
  assert.match(popup, /chrome\.storage\.session/);
  assert.match(popup, /chrome\.downloads\.download/);
  assert.match(popup, /chrome\.tabs\.create/);
});

