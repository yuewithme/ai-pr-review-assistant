const DEFAULT_BACKEND_URL = "http://localhost:3000";
const MAX_RECENT_REPORTS = 5;
const CURRENT_TASK_KEY = "currentTask";

chrome.runtime.onInstalled.addListener(async () => {
  const { lastBackendUrl } = await chrome.storage.local.get(["lastBackendUrl"]);

  if (!lastBackendUrl) {
    await chrome.storage.local.set({
      lastBackendUrl: DEFAULT_BACKEND_URL,
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "START_ANALYSIS") {
    return false;
  }

  runAnalysis(message.payload)
    .then((report) => {
      sendResponse({ success: true, data: report });
    })
    .catch((error) => {
      const messageText = error instanceof Error ? error.message : "生成报告失败";
      sendResponse({ success: false, error: messageText });
    });

  return true;
});

async function runAnalysis(payload) {
  const prUrl = payload?.prUrl;
  const backendUrl = normalizeBackendUrl(payload?.backendUrl);

  if (!prUrl) {
    throw new Error("缺少 GitHub PR 链接");
  }

  await chrome.storage.local.set({ lastBackendUrl: backendUrl });
  await saveCurrentTask({
    status: "running",
    step: "parse",
    message: "解析 PR 链接",
    prUrl,
    backendUrl,
    startedAt: new Date().toISOString(),
  });

  try {
    await waitForUi();
    await updateCurrentTask({ step: "fetch", message: "获取 PR 变更" });
    await waitForUi();
    await updateCurrentTask({ step: "analyze", message: "AI 分析中" });

    const response = await fetch(`${backendUrl}/api/pr/report-html`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prUrl }),
    });
    const body = await readJsonResponse(response);

    if (!response.ok || !body.success) {
      throw new Error(body?.error?.message || "生成报告失败");
    }

    await updateCurrentTask({ step: "report", message: "生成 HTML 报告" });

    const report = {
      analysisId: body.data.analysisId,
      prUrl: body.data.prUrl,
      title: extractHtmlTitle(body.data.html),
      html: body.data.html,
      createdAt: new Date().toISOString(),
    };

    await saveSessionReport(report);
    await saveRecentReport(report);
    await openReport(report.analysisId);
    await saveCurrentTask({
      status: "completed",
      step: "done",
      message: "报告已打开",
      prUrl: report.prUrl,
      backendUrl,
      analysisId: report.analysisId,
      title: report.title,
      completedAt: report.createdAt,
    });

    return {
      analysisId: report.analysisId,
      prUrl: report.prUrl,
      title: report.title,
      createdAt: report.createdAt,
    };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "生成报告失败";
    await updateCurrentTask({
      status: "failed",
      message: messageText,
    });
    throw error;
  }
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    throw new Error("后端返回不是有效 JSON");
  }
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

async function saveCurrentTask(task) {
  await chrome.storage.session.set({
    [CURRENT_TASK_KEY]: task,
  });
}

async function updateCurrentTask(patch) {
  const { [CURRENT_TASK_KEY]: currentTask = {} } = await chrome.storage.session.get([
    CURRENT_TASK_KEY,
  ]);

  await saveCurrentTask({
    ...currentTask,
    ...patch,
  });
}

function normalizeBackendUrl(value) {
  return (value || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, "");
}

function extractHtmlTitle(html) {
  const match = html.match(/<title>(.*?)<\/title>/i);

  return match?.[1]?.replace(/^PR Review 报告 - /, "") || "PR Review 报告";
}

function waitForUi() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}
