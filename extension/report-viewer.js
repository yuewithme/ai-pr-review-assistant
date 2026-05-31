const params = new URLSearchParams(location.search);
const analysisId = params.get("analysisId");
const frame = document.getElementById("reportFrame");

loadReport();

async function loadReport() {
  if (!analysisId) {
    renderEmpty("缺少 analysisId，无法打开报告。");
    return;
  }

  const key = `report:${analysisId}`;
  const record = await chrome.storage.session.get([key]);
  const report = record[key];

  if (!report?.html) {
    renderEmpty("当前浏览器会话中没有找到这份报告，请重新分析 PR。");
    return;
  }

  document.title = report.title || "PR Review Report";
  frame.srcdoc = report.html;
}

function renderEmpty(message) {
  frame.remove();
  const container = document.createElement("main");
  container.className = "empty";
  container.textContent = message;
  document.body.append(container);
}

