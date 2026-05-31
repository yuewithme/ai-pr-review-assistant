请把下面的 PR 分析结果转换为展示页面使用的数据结构。

输出 JSON 结构必须符合：

{
  "pageTitle": "string",
  "hero": {
    "title": "string",
    "subtitle": "string",
    "decision": "建议通过 | 建议修改后通过 | 建议重点人工复查",
    "decisionReason": "string"
  },
  "overviewCards": [
    {
      "label": "string",
      "value": "string",
      "description": "string"
    }
  ],
  "changeSummary": {
    "overall": "string",
    "mainChanges": ["string"],
    "mainModules": ["string"]
  },
  "riskOverview": {
    "high": 0,
    "medium": 0,
    "low": 0,
    "summary": "string"
  },
  "riskSections": [
    {
      "level": "high | medium | low",
      "type": "string",
      "filePath": "string",
      "title": "string",
      "description": "string",
      "evidence": "string",
      "impact": "string",
      "suggestion": "string",
      "confidence": 0,
      "requiresHumanCheck": false
    }
  ],
  "reviewComments": [
    {
      "filePath": "string",
      "type": "string",
      "comment": "string"
    }
  ],
  "fileSummaries": [
    {
      "filePath": "string",
      "summary": "string"
    }
  ],
  "testPlan": {
    "scenarios": ["string"],
    "edgeCases": ["string"],
    "hasTestMissingRisk": false
  },
  "openQuestions": [
    {
      "filePath": "string",
      "question": "string",
      "reason": "string"
    }
  ],
  "limitations": [
    {
      "type": "string",
      "filePath": "string",
      "message": "string"
    }
  ]
}

转换要求：

1. `pageTitle` 使用 PR 标题生成。
2. `hero.subtitle` 用一句话说明本次 PR 的核心改动。
3. `overviewCards` 至少包含作者、源分支、目标分支、修改文件数、新增行数、删除行数。
4. `riskOverview` 必须根据 `risks` 真实统计，不要估算。
5. `riskSections.title` 用一句短标题概括风险，不要改变原始风险含义。
6. 如果原始风险没有 `requiresHumanCheck`，根据描述、证据和建议中是否出现“人工确认”“人工复查”“上下文不足”推断。
7. 如果原始结果没有 `openQuestions` 或 `limitations`，返回空数组。
8. 不要新增原始分析结果中不存在的风险。

输入：

{
  "analysisResult": {{ANALYSIS_RESULT_JSON}}
}

