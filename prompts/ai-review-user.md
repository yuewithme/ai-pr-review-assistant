请根据下面的标准化 PR Review 上下文，生成 PR Review 分析结果。

你必须返回完全符合 `outputSchema` 的 JSON。

```json
{
  "task": "github_pr_review_analysis",
  "language": "zh-CN",
  "inputContract": {
    "primaryEvidence": "changedFiles.patch",
    "contextOnly": "contextFiles",
    "hintsOnly": "ruleFindings",
    "fieldMeaning": "fieldGuide",
    "truncationInfo": "contextPolicy"
  },
  "analysisGoals": [
    "生成 PR 变更总结",
    "识别潜在风险代码",
    "生成可复制的 Review 建议",
    "生成文件级变更摘要",
    "生成测试建议",
    "给出总体审查结论"
  ],
  "outputRules": [
    "全部使用中文",
    "只输出严格 JSON",
    "不要输出 Markdown",
    "不要编造不存在的信息",
    "每个风险必须绑定 changedFiles 中存在的 filePath",
    "没有明确代码依据时不要输出 high 风险",
    "如果无法判断行号，position 写“未提供”",
    "confidence 必须是 0 到 1 的数字",
    "如果没有明显风险，risks 返回空数组",
    "Review 建议要像真实 code review 评论",
    "JSON 字符串不要包含未转义的反斜杠；如果需要描述正则表达式，请优先用自然语言描述"
  ],
  "outputSchema": {
    "basicInfo": {
      "title": "string",
      "author": "string",
      "sourceBranch": "string",
      "targetBranch": "string",
      "changedFileCount": 0,
      "additions": 0,
      "deletions": 0,
      "mainModules": ["string"]
    },
    "summary": {
      "overall": "string",
      "mainChanges": ["string"],
      "fileSummaries": [
        {
          "filePath": "string",
          "summary": "string"
        }
      ]
    },
    "risks": [
      {
        "level": "high | medium | low",
        "type": "logic | boundary | permission | security | performance | compatibility | test-missing | maintainability | dependency | config",
        "filePath": "string",
        "position": "string",
        "description": "string",
        "evidence": "string",
        "impact": "string",
        "suggestion": "string",
        "confidence": 0.0
      }
    ],
    "reviewSuggestions": [
      {
        "filePath": "string",
        "type": "bug-risk | test | refactor | security | requirement-confirmation | maintainability",
        "comment": "string"
      }
    ],
    "testSuggestions": {
      "scenarios": ["string"],
      "edgeCases": ["string"],
      "hasTestMissingRisk": false
    },
    "conclusion": {
      "decision": "建议通过 | 建议修改后通过 | 建议重点人工复查",
      "reason": "string"
    }
  },
  "input": "{{AI_REVIEW_CONTEXT_JSON}}"
}
```

