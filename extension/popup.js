const CURRENT_TASK_KEY = "currentTask";

const prUrlInput = document.getElementById("prUrlInput");
const analyzeButton = document.getElementById("analyzeButton");
const statusText = document.getElementById("statusText");
const reopenButton = document.getElementById("reopenButton");
const downloadButton = document.getElementById("downloadButton");
const copyButton = document.getElementById("copyButton");
const historyList = document.getElementById("historyList");

let currentReport = null;

document.addEventListener("DOMContentLoaded", async () => {
  await autofillCurrentPrUrl();
  await restoreCurrentTask({ preserveInput: true });
  await renderHistory();

  analyzeButton.addEventListener("click", analyzeCurrentPr);
  reopenButton.addEventListener("click", reopenCurrentReport);
  downloadButton.addEventListener("click", downloadCurrentReport);
  copyButton.addEventListener("click", copyCurrentReviewSuggestions);

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    const taskChange = changes[CURRENT_TASK_KEY];

    if (areaName !== "session" || !taskChange?.newValue) {
      return;
    }

    await applyTaskState(taskChange.newValue);
    await renderHistory();
  });
});

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

  setBusy(true);
  setActionButtons(false);
  resetSteps();
  setStep("parse");
  setStatus("解析 PR 链接");

  try {
    const result = await chrome.runtime.sendMessage({
      type: "START_ANALYSIS",
      payload: { prUrl },
    });

    if (!result?.success) {
      throw new Error(result?.error || "生成报告失败");
    }

    await restoreCurrentTask({ preserveInput: true });
    await renderHistory();
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成报告失败";
    setStatus(message, "error");
    markActiveStepError();
    setBusy(false);
  }
}

async function restoreCurrentTask(options = {}) {
  const { [CURRENT_TASK_KEY]: task } = await chrome.storage.session.get([
    CURRENT_TASK_KEY,
  ]);

  if (!task) {
    return;
  }

  await applyTaskState(task, options);
}

async function applyTaskState(task, options = {}) {
  resetSteps();
  if (!options.preserveInput) {
    const taskPrUrl = task.prUrl || "";

    if (taskPrUrl) {
      prUrlInput.value = taskPrUrl;
    }
  }
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
  return loadStoredReport(analysisId);
}

async function loadStoredReport(analysisId) {
  const key = `report:${analysisId}`;
  const record = await chrome.storage.session.get([key]);
  const report = record[key];

  if (report?.html) {
    return {
      analysisId,
      prUrl: report.prUrl,
      title: report.title,
      html: report.html,
      createdAt: report.createdAt,
    };
  }

  const { recentReports = [] } = await chrome.storage.local.get(["recentReports"]);
  const localReport = recentReports.find((item) => item.analysisId === analysisId && item.html);

  return localReport || null;
}

async function downloadCurrentReport() {
  if (!currentReport) {
    return;
  }

  await downloadReport(currentReport);
}

async function downloadReport(report) {
  const blob = new Blob([report.html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  await chrome.downloads.download({
    url,
    filename: `${safeFilename(report.title)}.html`,
    saveAs: true,
  });

  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    const item = document.createElement("article");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-meta">
        <strong>${escapeHtml(report.title)}</strong>
        <span>${escapeHtml(report.prUrl)}</span>
      </div>
      <div class="history-actions">
        <button type="button" data-action="open">打开</button>
        <button type="button" data-action="download">下载</button>
      </div>`;

    item.querySelector('[data-action="open"]').addEventListener("click", async () => {
      currentReport = await loadSessionReport(report.analysisId);
      await openReport(report.analysisId);
      setActionButtons(Boolean(currentReport));
    });

    item.querySelector('[data-action="download"]').addEventListener("click", async () => {
      const selectedReport = await loadSessionReport(report.analysisId);

      if (!selectedReport) {
        setStatus("这份历史报告已过期，请重新分析 PR", "error");
        return;
      }

      await downloadReport(selectedReport);
      setStatus(`已下载 ${selectedReport.title}`);
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

function setBusy(isBusy) {
  analyzeButton.disabled = isBusy;
  analyzeButton.textContent = isBusy ? "分析进行中" : "开始分析";
  prUrlInput.disabled = isBusy;
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
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "pr-review-report";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
