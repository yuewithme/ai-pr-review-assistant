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
  assert.ok(
    manifest.host_permissions?.includes(
      "https://ai-pr-review-assistant-vercel.vercel.app/*",
    ),
  );
  assert.ok(!manifest.host_permissions?.includes("http://localhost:3000/*"));
});

test("extension popup recognizes GitHub PR URLs and delegates analysis to background", async () => {
  const popup = await readFile("extension/popup.js", "utf-8");
  const popupHtml = await readFile("extension/popup.html", "utf-8");

  assert.match(popup, /normalizeGitHubPrUrl/);
  assert.match(popup, /github\.com/);
  assert.match(popup, /chrome\.runtime\.sendMessage/);
  assert.match(popup, /START_ANALYSIS/);
  assert.match(popup, /chrome\.storage\.session/);
  assert.match(popup, /CURRENT_TASK_KEY/);
  assert.match(popup, /restoreCurrentTask/);
  assert.match(popup, /applyTaskState/);
  assert.match(popup, /chrome\.storage\.onChanged/);
  assert.match(popup, /chrome\.downloads\.download/);
  assert.match(popup, /chrome\.tabs\.create/);
  assert.doesNotMatch(popup, /backendUrlInput/);
  assert.doesNotMatch(popupHtml, /后端地址/);
  assert.doesNotMatch(popupHtml, /backendUrlInput/);
});

test("extension popup does not restore old task URL over the current tab URL", async () => {
  const popup = await readFile("extension/popup.js", "utf-8");

  assert.match(popup, /restoreCurrentTask\(\{ preserveInput: true \}\)/);
  assert.match(popup, /async function applyTaskState\(task, options = \{\}\)/);
  assert.match(popup, /if \(!options\.preserveInput\)/);
  assert.doesNotMatch(popup, /prUrlInput\.value = task\.prUrl \|\| prUrlInput\.value/);
});

test("extension background owns long running report generation state", async () => {
  const background = await readFile("extension/background.js", "utf-8");

  assert.match(background, /https:\/\/ai-pr-review-assistant-vercel\.vercel\.app/);
  assert.match(background, /START_ANALYSIS/);
  assert.match(background, /runAnalysis/);
  assert.match(background, /\/api\/pr\/report-html/);
  assert.match(background, /CURRENT_TASK_KEY/);
  assert.match(background, /chrome\.storage\.session/);
  assert.match(background, /chrome\.storage\.local/);
  assert.match(background, /html: report\.html/);
  assert.match(background, /chrome\.tabs\.create/);
});

test("extension report viewer restores history reports from local storage", async () => {
  const reportViewer = await readFile("extension/report-viewer.js", "utf-8");
  const popup = await readFile("extension/popup.js", "utf-8");

  assert.match(reportViewer, /chrome\.storage\.session/);
  assert.match(reportViewer, /chrome\.storage\.local/);
  assert.match(reportViewer, /recentReports/);
  assert.match(reportViewer, /loadStoredReport/);
  assert.match(popup, /loadStoredReport/);
  assert.match(popup, /recentReports/);
});
