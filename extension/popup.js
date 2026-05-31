const DEFAULT_BACKEND_URL = "http://localhost:3000";
const CURRENT_TASK_KEY = "currentTask";

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
  await restoreCurrentTask();
  await renderHistory();

  analyzeButton.addEventListener("click", analyzeCurrentPr);
  reopenButton.addEventListener("click", reopenCurrentReport);
  downloadButton.addEventListener("click", downloadCurrentReport);
  copyButton.addEventListener("click", copyCurrentReviewSuggestions);
  backendUrlInput.addEventListener("change", saveBackendUrl);

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    const taskChange = changes[CURRENT_TASK_KEY];

    if (areaName !== "session" || !taskChange?.newValue) {
      return;
    }

    await applyTaskState(taskChange.newValue);
    await renderHistory();
  });
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
  setActionButtons(false);
  resetSteps();
  setStep("parse");
  setStatus("解析 PR 链接");

  try {
    const result = await chrome.runtime.sendMessage({
      type: "START_ANALYSIS",
      payload: { prUrl, backendUrl },
    });

    if (!result?.success) {
      throw new Error(result?.error || "生成报告失败");
    }

    await restoreCurrentTask();
    await renderHistory();
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成报告失败";
    setStatus(message, "error");
    markActiveStepError();
    setBusy(false);
  }
}

async function restoreCurrentTask() {
  const { [CURRENT_TASK_KEY]: task } = await chrome.storage.session.get([
    CURRENT_TASK_KEY,
  ]);

  if (!task) {
    return;
  }

  await applyTaskState(task);
}

async function applyTaskState(task) {
  resetSteps();
  prUrlInput.value = task.prUrl || prUrlInput.value;
  backendUrlInput.value = task.backendUrl || backendUrlInput.value;
  setStep(task.step || "parse");
  setStatus(task.message || "恢复上次分析状态", task.status === "failed" ? "error" : "normal");

  if (task.status === "running") {
    setBusy(true);
    setActionButtons(false);
    return;
  }

  if (task.status === "failed") {
    setBusy(false);
    setActionButtons(false);
    markActiveStepError();
    return;
  }

  if (task.status === "completed" && task.analysisId) {
    currentReport = await loadSessionReport(task.analysisId);
    setBusy(false);
    setStep("done");
    setStatus(task.message || "报告已生成");
    setActionButtons(Boolean(currentReport));
  }
}

async function reopenCurrentReport() {
  if (!currentReport) {
    return;
  }

  await openReport(currentReport.analysisId);
}

async function loadSessionReport(analysisId) {
  const key = `report:${analysisId}`;
  const record = await chrome.storage.session.get([key]);
  const report = record[key];

  if (!report?.html) {
    return null;
  }

  return {
    analysisId,
    prUrl: report.prUrl,
    title: report.title,
    html: report.html,
    createdAt: report.createdAt,
  };
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
      currentReport = await loadSessionReport(report.analysisId);
      await openReport(report.analysisId);
      setActionButtons(Boolean(currentReport));
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
  analyzeButton.textContent = isBusy ? "分析进行中" : "开始分析";
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
