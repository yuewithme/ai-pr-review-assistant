请根据下面的标准化 PR Review 上下文，生成 PR Review 分析结果。

你必须返回完全符合 `outputSchema` 的 JSON。

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
    "生成测试建议"
  ],
  "outputRules": [
    "全部使用中文",
    "解释性内容必须使用中文；文件路径、代码标识符、函数名、变量名、包名、分支名、PR 标题、risk type 枚举值、status 枚举值和常见技术名词可以保留英文",
    "如果输入的 ruleFindings 或上下文是英文，需要转写为中文说明，不要原样复制英文句子到报告字段",
    "只输出严格 JSON",
    "不要输出 Markdown",
    "不要编造不存在的信息",
    "每个风险必须绑定 changedFiles 中存在的 filePath",
    "没有明确代码依据时不要输出 high 风险",
    "如果无法判断行号，position 写“未提供”",
    "confidence 必须是 0 到 1 的数字",
    "如果没有明显风险，risks 返回空数组",
    "risk.evidenceSource 必须说明证据来源",
    "如果风险需要人工确认，requiresHumanCheck 必须为 true",
    "如果判断主要来自 ruleFindings，风险等级最高只能为 low 或 medium，并在 evidence 中说明来源于规则预检测",
    "不要对正则表达式、框架行为、API 行为做未验证推断；证据不足时写当前上下文不足，需要人工确认",
    "被截断文件的问题优先放入 openQuestions 或 limitations",
    "mainModules 优先使用目录、文件路径或模块边界，不要只写抽象业务名称",
    "Review 建议要像真实 code review 评论",
    "Review 建议不能是空泛提醒；必须点名具体代码、具体风险或具体测试缺口，并给出下一步动作",
    "风险的问题描述和依据不能重复；description 写问题，evidence 写证据来源和判断依据",
    "每条风险尽量写清触发条件、具体证据、影响路径、验证方式；缺少明确影响路径时不要提高风险等级",
    "evidence 必须指向具体 patch 片段、文件路径、规则命中或上下文字段，不要只复述 description",
    "codeSnippet 优先摘录 changedFiles.patch 中最相关的新增或修改代码；没有明确代码时返回空字符串",
    "suggestion 必须详细到 reviewer 或作者知道下一步怎么改、补什么测试、确认什么边界；不要只写建议复核、建议检查、建议优化",
    "risk.suggestedCode 用于在风险详情的建议字段展示修改后代码；有明确改法时必须给出精简代码片段，只能人工确认时返回空字符串",
    "reviewSuggestions.currentCode 和 reviewSuggestions.suggestedCode 用于展示修改前后对比；有明确改法或测试补充时必须同时给出，只能人工确认时返回空字符串",
    "currentCode、codeSnippet 和 suggestedCode 必须能互相对应，优先基于 patch 中已有代码改写，不要编造不存在的 API",
    "测试类 Review 建议必须尽量包含测试场景、输入条件、期望输出或断言目标",
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
        "codeSnippet": "string",
        "evidenceSource": "patch | ruleFinding | metadata | context | mixed",
        "impact": "string",
        "suggestion": "string",
        "suggestedCode": "string",
        "confidence": 0.0,
        "requiresHumanCheck": false
      }
    ],
    "reviewSuggestions": [
      {
        "filePath": "string",
        "type": "bug-risk | test | refactor | security | requirement-confirmation | maintainability",
        "comment": "string",
        "currentCode": "string",
        "suggestedCode": "string"
      }
    ],
    "openQuestions": [
      {
        "filePath": "string",
        "question": "string",
        "reason": "string"
      }
    ],
    "limitations": [
      {
        "type": "truncated-context | insufficient-evidence | missing-line-number | other",
        "filePath": "string",
        "message": "string"
      }
    ],
    "testSuggestions": {
      "scenarios": ["string"],
      "edgeCases": ["string"],
      "hasTestMissingRisk": false
    }
  },
  "input": {{AI_REVIEW_CONTEXT_JSON}}
}
