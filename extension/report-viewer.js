const params = new URLSearchParams(location.search);
const analysisId = params.get("analysisId");
const frame = document.getElementById("reportFrame");

loadReport();

async function loadReport() {
  if (!analysisId) {
    renderEmpty("缺少 analysisId，无法打开报告。");
    return;
  }

  const report = await loadStoredReport(analysisId);

  if (!report?.html) {
    renderEmpty("这份历史报告的 HTML 已过期，请重新分析 PR。");
    return;
  }

  document.title = report.title || "PR Review Report";
  frame.srcdoc = report.html;
}

async function loadStoredReport(analysisId) {
  const key = `report:${analysisId}`;
  const sessionRecord = await chrome.storage.session.get([key]);
  const sessionReport = sessionRecord[key];

  if (sessionReport?.html) {
    return sessionReport;
  }

  const { recentReports = [] } = await chrome.storage.local.get(["recentReports"]);
  return recentReports.find((report) => report.analysisId === analysisId && report.html) || null;
}

function renderEmpty(message) {
  frame.remove();
  const container = document.createElement("main");
  container.className = "empty";
  container.textContent = message;
  document.body.append(container);
}

