import { createHash } from "node:crypto";

import type {
  AnalysisResult,
  AnalysisRisk,
  FileSummary,
  ReviewSuggestion,
  RuleFindingType,
} from "../types/analysis.ts";
import type { PrInfo } from "../types/github.ts";

type SourceLinks = {
  prUrl: string;
  filesUrl: string;
  sourceBranchUrl: string;
  targetBranchUrl: string;
};

type ReportModel = AnalysisResult & {
  conclusion?: {
    decision: "建议通过" | "建议修改后通过" | "建议重点人工复查";
    reason: string;
  };
};

const TYPE_LABELS: Record<string, string> = {
  permission: "permission / 权限",
  dependency: "dependency / 依赖",
  security: "security / 安全",
  "test-missing": "test-missing / 测试缺失",
  "large-change": "large-change / 大变更",
  maintainability: "maintainability / 可维护性",
  "type-safety": "type-safety / 类型安全",
  compatibility: "compatibility / 兼容性",
  logic: "logic / 逻辑",
  boundary: "boundary / 边界条件",
  performance: "performance / 性能",
  config: "config / 配置",
};

const LEVEL_LABELS = {
  high: "高风险",
  medium: "中风险",
  low: "低风险",
} as const;

export function renderPrReviewHtmlReport(result: AnalysisResult): string {
  const sourceLinks = buildSourceLinks(result.prInfo);
  const conclusion = inferConclusion(result);
  const riskCounts = countRiskLevels(result.risks);
  const mainModules = inferMainModules(result.fileSummaries);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PR Review 报告 - ${escapeHtml(result.prInfo.title)}</title>
  <style>
    :root {
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #17202a;
      --muted: #667085;
      --line: #d9dee7;
      --accent: #1f7a5c;
      --accent-soft: #e6f4ef;
      --red: #b42318;
      --red-soft: #fee4e2;
      --amber: #b54708;
      --amber-soft: #fef0c7;
      --blue: #175cd3;
      --blue-soft: #dbeafe;
      --code: #f1f5f9;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
    .page { max-width: 1120px; margin: 0 auto; padding: 32px 20px 56px; }
    .hero { padding: 28px 0 20px; border-bottom: 1px solid var(--line); }
    .eyebrow { color: var(--accent); font-weight: 700; letter-spacing: .02em; }
    h1 { margin: 8px 0 10px; font-size: 34px; line-height: 1.2; }
    h2 { margin: 0 0 16px; font-size: 22px; }
    h3 { margin: 0 0 8px; font-size: 16px; }
    p { margin: 0; }
    .subtitle { color: var(--muted); max-width: 860px; font-size: 16px; }
    .decision { display: inline-flex; align-items: center; gap: 8px; margin-top: 18px; padding: 8px 12px; border-radius: 6px; background: var(--amber-soft); color: var(--amber); font-weight: 700; }
    section { margin-top: 28px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .metric, .panel, .risk, .comment { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
    .overview-source { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center; margin-bottom: 12px; padding: 16px 18px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
    .overview-source span { display: block; color: var(--muted); font-size: 12px; }
    .overview-source strong { display: block; margin-top: 4px; font-size: 18px; }
    .overview-links { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
    .button-link { display: inline-flex; align-items: center; min-height: 34px; padding: 6px 10px; border-radius: 6px; background: var(--accent); color: #fff; font-weight: 700; text-decoration: none; }
    .button-link.secondary { background: var(--accent-soft); color: var(--accent); }
    .metric { padding: 14px 16px; min-height: 108px; }
    .metric span { display: block; color: var(--muted); font-size: 12px; }
    .metric strong { display: block; margin-top: 5px; font-size: 20px; line-height: 1.25; word-break: break-word; }
    .metric p { margin-top: 6px; color: var(--muted); font-size: 13px; }
    a { color: inherit; }
    .panel { padding: 18px; }
    ul { margin: 8px 0 0 20px; padding: 0; }
    li { margin: 5px 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .chip { padding: 5px 9px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: #344054; font-size: 12px; }
    .risk-bar { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .risk-count { padding: 14px; border-radius: 8px; border: 1px solid var(--line); background: #fff; }
    .risk-count strong { display: block; font-size: 26px; }
    .risk-high { background: var(--red-soft); color: var(--red); }
    .risk-medium { background: var(--amber-soft); color: var(--amber); }
    .risk-low { background: var(--blue-soft); color: var(--blue); }
    .risk { margin-top: 12px; padding: 16px; }
    .risk header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
    .badge { display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .path { display: inline-block; margin-top: 6px; padding: 3px 7px; border-radius: 5px; background: var(--code); color: #344054; font-family: Consolas, "SFMono-Regular", monospace; font-size: 12px; word-break: break-all; text-decoration: none; }
    .path:hover { text-decoration: underline; }
    .risk dl { display: grid; grid-template-columns: 88px 1fr; gap: 8px 12px; margin: 14px 0 0; }
    .risk dt { color: var(--muted); }
    .risk dd { margin: 0; }
    .comment { padding: 14px 16px; margin-top: 10px; }
    .comment p { margin-top: 6px; }
    .file-list { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    .file-row { display: grid; grid-template-columns: minmax(220px, 32%) 1fr; gap: 14px; align-items: start; padding: 10px 14px; border-top: 1px solid var(--line); }
    .file-row:first-child { border-top: 0; }
    .file-row .path { margin-top: 0; max-width: 100%; }
    .file-row p { margin: 2px 0 0; color: #344054; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .footer { margin-top: 30px; color: var(--muted); font-size: 12px; }
    @media (max-width: 760px) {
      .grid, .risk-bar, .two-col { grid-template-columns: 1fr; }
      .overview-source { grid-template-columns: 1fr; }
      .overview-links { justify-content: flex-start; }
      h1 { font-size: 26px; }
      .risk header { display: block; }
      .badge { margin-top: 10px; }
      .risk dl { grid-template-columns: 1fr; }
      .file-row { grid-template-columns: 1fr; gap: 6px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <div class="eyebrow">AI PR Review 报告</div>
      <h1>${escapeHtml(result.prInfo.title)}</h1>
      <p class="subtitle">${escapeHtml(result.summary)}</p>
      <div class="decision">${escapeHtml(conclusion.decision)}</div>
    </header>

    <section>
      <h2>PR 概览</h2>
      <div class="overview-source">
        <div>
          <span>来源 PR</span>
          <strong>${escapeHtml(`${result.prInfo.owner}/${result.prInfo.repo} #${result.prInfo.pullNumber}`)}</strong>
        </div>
        <div class="overview-links">
          ${renderLink("打开 PR", sourceLinks.prUrl, "button-link")}
          ${renderLink("查看 Files", sourceLinks.filesUrl, "button-link secondary")}
        </div>
      </div>
      <div class="grid">
        ${renderMetric("作者", result.prInfo.author, "PR 提交者")}
        ${renderMetric("源分支", renderInlineLink(result.prInfo.sourceBranch, sourceLinks.sourceBranchUrl), "本次变更来源", true)}
        ${renderMetric("目标分支", renderInlineLink(result.prInfo.targetBranch, sourceLinks.targetBranchUrl), "本次变更合入目标", true)}
        ${renderMetric("修改文件", String(result.fileSummaries.length), "Changed files")}
        ${renderMetric("新增行数", String(sum(result.fileSummaries, "additions")), "Additions")}
        ${renderMetric("删除行数", String(sum(result.fileSummaries, "deletions")), "Deletions")}
      </div>
    </section>

    <section>
      <h2>变更总结</h2>
      <div class="panel">
        <h3>整体说明</h3>
        <p>${escapeHtml(result.summary)}</p>
        <h3 style="margin-top:16px;">主要变更点</h3>
        ${renderList(buildMainChanges(result))}
        <h3 style="margin-top:16px;">主要涉及模块</h3>
        <div class="chips">${mainModules.map((module) => `<span class="chip">${escapeHtml(module)}</span>`).join("") || "<span class=\"chip\">暂无</span>"}</div>
      </div>
    </section>

    <section>
      <h2>风险概览</h2>
      <div class="risk-bar">
        <div class="risk-count risk-high"><strong>${riskCounts.high}</strong><span>高风险</span></div>
        <div class="risk-count risk-medium"><strong>${riskCounts.medium}</strong><span>中风险</span></div>
        <div class="risk-count risk-low"><strong>${riskCounts.low}</strong><span>低风险</span></div>
      </div>
    </section>

    <section>
      <h2>风险详情</h2>
      ${result.risks.length > 0 ? result.risks.map((risk) => renderRisk(risk, sourceLinks.filesUrl)).join("") : renderEmptyPanel()}
    </section>

    <section>
      <h2>Review 建议</h2>
      ${result.reviewSuggestions.length > 0 ? result.reviewSuggestions.map((suggestion) => renderSuggestion(suggestion, sourceLinks.filesUrl)).join("") : renderEmptyPanel()}
    </section>

    <section>
      <h2>测试建议</h2>
      <div class="two-col">
        <div class="panel">
          <h3>建议补充场景</h3>
          ${renderList(buildTestScenarios(result))}
        </div>
        <div class="panel">
          <h3>重点边界条件</h3>
          ${renderList(buildEdgeCases(result))}
        </div>
      </div>
      <div class="panel" style="margin-top:12px;">
        <strong>测试缺失风险：</strong>${result.risks.some((risk) => risk.type === "test-missing") ? "存在" : "未发现明显测试缺失风险"}
      </div>
    </section>

    <section>
      <h2>文件级变更摘要</h2>
      <div class="file-list">
        ${result.fileSummaries.length > 0 ? result.fileSummaries.map((file) => renderFileSummary(file, sourceLinks.filesUrl)).join("") : "<div class=\"file-row\"><span>暂无</span><p>暂无</p></div>"}
      </div>
    </section>

    <section>
      <h2>总体结论</h2>
      <div class="panel">
        <h3>${escapeHtml(conclusion.decision)}</h3>
        <p>${escapeHtml(conclusion.reason)}</p>
      </div>
    </section>

    <p class="footer">本报告由 AI PR Review Assistant 生成，请结合人工审查判断。</p>
  </main>
</body>
</html>`;
}

function renderMetric(
  label: string,
  value: string,
  description: string,
  valueIsHtml = false,
): string {
  return `<article class="metric"><span>${escapeHtml(label)}</span><strong>${valueIsHtml ? value : escapeHtml(value)}</strong><p>${escapeHtml(description)}</p></article>`;
}

function renderRisk(risk: AnalysisRisk, filesUrl: string): string {
  const fileUrl = buildFileDiffUrl(filesUrl, risk.filePath);
  const levelClass = `risk-${risk.level}`;

  return `
      <article class="risk">
        <header>
          <div>
            <h3>${escapeHtml(risk.message)}</h3>
            ${renderLink(risk.filePath, fileUrl, "path")}
          </div>
          <span class="badge ${levelClass}">${escapeHtml(LEVEL_LABELS[risk.level])}</span>
        </header>
        <dl>
          <dt>类型</dt><dd>${escapeHtml(formatRiskType(risk.type))}</dd>
          <dt>问题</dt><dd>${escapeHtml(risk.message)}</dd>
          <dt>依据</dt><dd>${escapeHtml(risk.message)}</dd>
          <dt>影响</dt><dd>${escapeHtml(inferImpact(risk))}</dd>
          <dt>建议</dt><dd>${escapeHtml(risk.suggestion)}</dd>
          <dt>置信度</dt><dd>${escapeHtml(String(risk.confidence))}</dd>
        </dl>
      </article>`;
}

function renderSuggestion(
  suggestion: ReviewSuggestion,
  filesUrl: string,
): string {
  const type = inferSuggestionType(suggestion.message);

  return `
      <article class="comment">
        <h3>${escapeHtml(type)}</h3>
        ${renderLink(suggestion.filePath, buildFileDiffUrl(filesUrl, suggestion.filePath), "path")}
        <p>${escapeHtml(suggestion.message)}</p>
      </article>`;
}

function renderFileSummary(file: FileSummary, filesUrl: string): string {
  return `<div class="file-row">${renderLink(file.filePath, buildFileDiffUrl(filesUrl, file.filePath), "path")}<p>${escapeHtml(file.summary)}</p></div>`;
}

function renderList(items: string[]): string {
  if (items.length === 0) {
    return "<p>暂无</p>";
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderEmptyPanel(): string {
  return `<div class="panel"><p>暂无</p></div>`;
}

function buildSourceLinks(prInfo: PrInfo): SourceLinks {
  const repoBase = `https://github.com/${encodeURIComponent(prInfo.owner)}/${encodeURIComponent(prInfo.repo)}`;

  return {
    prUrl: prInfo.url,
    filesUrl: `${prInfo.url}/files`,
    sourceBranchUrl: `${repoBase}/tree/${encodeBranchPath(prInfo.sourceBranch)}`,
    targetBranchUrl: `${repoBase}/tree/${encodeBranchPath(prInfo.targetBranch)}`,
  };
}

function buildFileDiffUrl(filesUrl: string, filePath: string): string {
  const hash = createHash("sha256").update(filePath).digest("hex");

  return `${filesUrl}#diff-${hash}`;
}

function renderLink(label: string, href: string, className: string): string {
  return `<a class="${escapeHtml(className)}" href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function renderInlineLink(label: string, href: string): string {
  return `<a href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function countRiskLevels(risks: AnalysisRisk[]) {
  return risks.reduce(
    (counts, risk) => {
      counts[risk.level] += 1;
      return counts;
    },
    { high: 0, medium: 0, low: 0 },
  );
}

function inferConclusion(result: ReportModel) {
  if (result.conclusion) {
    return result.conclusion;
  }

  if (result.risks.some((risk) => risk.level === "high")) {
    return {
      decision: "建议重点人工复查" as const,
      reason: "本次 PR 存在高风险项，建议重点人工复查后再决定是否合并。",
    };
  }

  if (result.risks.some((risk) => risk.level === "medium")) {
    return {
      decision: "建议修改后通过" as const,
      reason: "本次 PR 存在中低风险建议，建议处理关键问题后再合并。",
    };
  }

  return {
    decision: "建议通过" as const,
    reason: "本次 PR 未发现明显高风险问题，可结合人工审查后通过。",
  };
}

function buildMainChanges(result: AnalysisResult): string[] {
  return result.fileSummaries.slice(0, 5).map((file) => file.summary);
}

function buildTestScenarios(result: AnalysisResult): string[] {
  const testFiles = result.fileSummaries.filter((file) =>
    /test|spec/i.test(file.filePath),
  );

  if (testFiles.length > 0) {
    return [
      "确认新增或修改的测试覆盖本次 PR 的核心路径。",
      "运行相关测试文件，确认现有行为没有回归。",
    ];
  }

  return ["根据本次变更补充核心路径测试。"];
}

function buildEdgeCases(result: AnalysisResult): string[] {
  const riskTypes = new Set(result.risks.map((risk) => risk.type));
  const cases: string[] = [];

  if (riskTypes.has("permission")) {
    cases.push("权限、登录态、无效 token 和越权访问场景。");
  }

  if (riskTypes.has("security")) {
    cases.push("敏感配置、密钥泄露和输入安全边界。");
  }

  if (riskTypes.has("dependency")) {
    cases.push("依赖安装、锁文件一致性和运行时兼容性。");
  }

  if (cases.length === 0) {
    cases.push("异常输入、空数据和边界参数。");
  }

  return cases;
}

function inferMainModules(fileSummaries: FileSummary[]): string[] {
  const modules = new Set<string>();

  for (const file of fileSummaries) {
    const [first, second] = file.filePath.split("/");
    modules.add(second ? `${first}/${second}` : first);
  }

  return [...modules].slice(0, 8);
}

function inferSuggestionType(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("test") || message.includes("测试")) {
    return "test";
  }

  if (lower.includes("security") || message.includes("安全")) {
    return "security";
  }

  if (lower.includes("refactor") || message.includes("拆分") || message.includes("重构")) {
    return "refactor";
  }

  return "maintainability";
}

function inferImpact(risk: AnalysisRisk): string {
  switch (risk.type) {
    case "security":
      return "可能影响安全性或敏感信息保护。";
    case "permission":
      return "可能影响鉴权、权限判断或访问控制。";
    case "dependency":
      return "可能影响依赖安装、构建或运行时兼容性。";
    case "test-missing":
      return "可能导致相关行为缺少回归保护。";
    case "large-change":
      return "可能增加审查成本和后续维护成本。";
    case "type-safety":
      return "可能降低类型约束，增加运行时错误概率。";
    case "maintainability":
    default:
      return "可能影响代码可读性、可维护性或后续修改成本。";
  }
}

function formatRiskType(type: RuleFindingType | string): string {
  return TYPE_LABELS[type] ?? `${type} / 未分类`;
}

function sum(files: FileSummary[], key: "additions" | "deletions"): number {
  return files.reduce((total, file) => total + file[key], 0);
}

function encodeBranchPath(branch: string): string {
  return branch.split("/").map(encodeURIComponent).join("/");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

