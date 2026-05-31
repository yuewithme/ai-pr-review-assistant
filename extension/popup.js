const DEFAULT_BACKEND_URL = "http://localhost:3000";
const MAX_RECENT_REPORTS = 5;

const backendUrlInput = document.getElementById("backendUrlInput");
const prUrlInput = document.getElementById("prUrlInput");
const analyzeButton = document.getElementById("analyzeButton");
const statusText = document.getElementById("statusText");
const reopenButton = document.getElementById("reopenButton");
const downloadButton = document.getElementById("downloadButton");
const copyButton = document.getElementById("copyButton");
const historyList = document.getElementById("historyList");

let currentReport = null;

document.addEventListener("DOMContentLoaded", async () => {
  await restoreSettings();
  await autofillCurrentPrUrl();
  await renderHistory();

  analyzeButton.addEventListener("click", analyzeCurrentPr);
  reopenButton.addEventListener("click", reopenCurrentReport);
  downloadButton.addEventListener("click", downloadCurrentReport);
  copyButton.addEventListener("click", copyCurrentReviewSuggestions);
  backendUrlInput.addEventListener("change", saveBackendUrl);
});

async function restoreSettings() {
  const { lastBackendUrl } = await chrome.storage.local.get(["lastBackendUrl"]);
  backendUrlInput.value = lastBackendUrl || DEFAULT_BACKEND_URL;
}

async function saveBackendUrl() {
  await chrome.storage.local.set({
    lastBackendUrl: normalizeBackendUrl(backendUrlInput.value),
  });
}

async function autofillCurrentPrUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const prUrl = normalizeGitHubPrUrl(tab?.url || "");

  if (prUrl) {
    prUrlInput.value = prUrl;
    setStatus("已识别当前 GitHub PR 页面");
    return;
  }

  prUrlInput.value = "";
  setStatus("当前页面不是 GitHub PR，请手动粘贴链接");
}

async function analyzeCurrentPr() {
  const prUrl = normalizeGitHubPrUrl(prUrlInput.value.trim());

  if (!prUrl) {
    setStatus("请输入有效的 GitHub PR 链接", "error");
    return;
  }

  const backendUrl = normalizeBackendUrl(backendUrlInput.value);
  await chrome.storage.local.set({ lastBackendUrl: backendUrl });
  setBusy(true);
  resetSteps();
  setStep("parse");

  try {
    setStatus("解析 PR 链接");
    await waitForUi();
    setStep("fetch");
    setStatus("获取 PR 变更");
    await waitForUi();
    setStep("analyze");
    setStatus("AI 分析中");
    const response = await fetch(`${backendUrl}/api/pr/report-html`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prUrl }),
    });

    const body = await response.json();

    if (!response.ok || !body.success) {
      throw new Error(body?.error?.message || "生成报告失败");
    }

    setStep("report");
    setStatus("生成 HTML 报告");

    currentReport = {
      analysisId: body.data.analysisId,
      prUrl: body.data.prUrl,
      title: extractHtmlTitle(body.data.html),
      html: body.data.html,
      createdAt: new Date().toISOString(),
    };

    await saveSessionReport(currentReport);
    await saveRecentReport(currentReport);
    await openReport(currentReport.analysisId);
    await renderHistory();

    setStep("done");
    setStatus("报告已打开");
    setActionButtons(true);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "生成报告失败", "error");
    markActiveStepError();
  } finally {
    setBusy(false);
  }
}

async function reopenCurrentReport() {
  if (!currentReport) {
    return;
  }

  await openReport(currentReport.analysisId);
}

async function downloadCurrentReport() {
  if (!currentReport) {
    return;
  }

  const blob = new Blob([currentReport.html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  await chrome.downloads.download({
    url,
    filename: `${safeFilename(currentReport.title)}.html`,
    saveAs: true,
  });
}

async function copyCurrentReviewSuggestions() {
  if (!currentReport) {
    return;
  }

  const reviewText = extractReviewSuggestions(currentReport.html);
  await navigator.clipboard.writeText(reviewText);
  setStatus("Review 建议已复制");
}

async function openReport(analysisId) {
  const url = chrome.runtime.getURL(`report-viewer.html?analysisId=${encodeURIComponent(analysisId)}`);
  await chrome.tabs.create({ url });
}

async function saveSessionReport(report) {
  await chrome.storage.session.set({
    [`report:${report.analysisId}`]: {
      html: report.html,
      title: report.title,
      prUrl: report.prUrl,
      createdAt: report.createdAt,
    },
  });
}

async function saveRecentReport(report) {
  const { recentReports = [] } = await chrome.storage.local.get(["recentReports"]);
  const nextReports = [
    {
      analysisId: report.analysisId,
      prUrl: report.prUrl,
      title: report.title,
      createdAt: report.createdAt,
    },
    ...recentReports.filter((item) => item.analysisId !== report.analysisId),
  ].slice(0, MAX_RECENT_REPORTS);

  await chrome.storage.local.set({ recentReports: nextReports });
}

async function renderHistory() {
  const { recentReports = [] } = await chrome.storage.local.get(["recentReports"]);

  if (recentReports.length === 0) {
    historyList.textContent = "暂无";
    return;
  }

  historyList.textContent = "";

  for (const report of recentReports) {
    const item = document.createElement("button");
    item.className = "history-item";
    item.type = "button";
    item.innerHTML = `<strong>${escapeHtml(report.title)}</strong><span>${escapeHtml(report.prUrl)}</span>`;
    item.addEventListener("click", async () => {
      currentReport = {
        ...report,
        html: "",
      };
      await openReport(report.analysisId);
    });
    historyList.append(item);
  }
}

function normalizeGitHubPrUrl(value) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);

    if (
      url.hostname !== "github.com" ||
      parts.length < 4 ||
      parts[2] !== "pull" ||
      !/^\d+$/.test(parts[3])
    ) {
      return "";
    }

    return `https://github.com/${parts[0]}/${parts[1]}/pull/${parts[3]}`;
  } catch {
    return "";
  }
}

function normalizeBackendUrl(value) {
  return (value || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, "");
}

function setBusy(isBusy) {
  analyzeButton.disabled = isBusy;
  prUrlInput.disabled = isBusy;
  backendUrlInput.disabled = isBusy;
}

function setActionButtons(enabled) {
  reopenButton.disabled = !enabled;
  downloadButton.disabled = !enabled;
  copyButton.disabled = !enabled;
}

function setStatus(message, level = "normal") {
  statusText.textContent = message;
  statusText.className = level;
}

function setStep(step) {
  for (const item of document.querySelectorAll("#steps li")) {
    const isCurrent = item.dataset.step === step;
    item.classList.toggle("active", isCurrent);

    if (isCurrent) {
      break;
    }

    item.classList.add("done");
  }
}

function resetSteps() {
  for (const item of document.querySelectorAll("#steps li")) {
    item.classList.remove("active", "done", "error");
  }
}

function markActiveStepError() {
  const active = document.querySelector("#steps li.active");

  if (active) {
    active.classList.add("error");
  }
}

function extractHtmlTitle(html) {
  const match = html.match(/<title>(.*?)<\/title>/i);

  return match?.[1]?.replace(/^PR Review 报告 - /, "") || "PR Review 报告";
}

function extractReviewSuggestions(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const section = [...doc.querySelectorAll("section")].find((item) =>
    item.querySelector("h2")?.textContent?.includes("Review 建议"),
  );

  if (!section) {
    return "";
  }

  return [...section.querySelectorAll(".comment")]
    .map((item) => item.textContent?.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
}

function safeFilename(value) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || "pr-review-report";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function waitForUi() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}
