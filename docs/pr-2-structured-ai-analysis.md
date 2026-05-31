# PR #2 Structured AI Analysis

分析对象：

```text
https://github.com/yuewithme/ai-pr-review-assistant/pull/2
```

分析方式：

```text
标准化 AiReviewContext
  -> 中文 System Prompt
  -> JSON payload User Prompt
  -> DeepSeek V4 Flash
  -> 结构化中文 JSON 分析结果
```

说明：

- 本次分析使用真实 DeepSeek V4 Flash 返回结果。
- 输出目标是结构化 JSON，不是 Markdown 报告。
- 结果可继续交给后续 `report-renderer` 展开成HTML 报告或前端报告页。
- 本文档不包含任何 API Key。

## 输入概况

```json
{
  "sourcePr": "https://github.com/yuewithme/ai-pr-review-assistant/pull/2",
  "changedFileCount": 21,
  "ruleFindingCount": 12,
  "contextStrategy": {
    "mode": "silent-budgeted-context",
    "note": "Context budget decisions are internal and should not appear in the final report."
  }
}
```

## 结构化分析结果

```json
{
  "basicInfo": {
    "title": "Add GitHub PR fetch API",
    "author": "yuewithme",
    "sourceBranch": "feature/github-pr-fetch-api",
    "targetBranch": "feature/pr-url-parse-api",
    "changedFileCount": 21,
    "additions": 2199,
    "deletions": 1,
    "mainModules": [
      "GitHub API 客户端",
      "AI 分析管道",
      "规则检查器",
      "路由",
      "类型定义",
      "测试套件"
    ]
  },
  "summary": {
    "overall": "该 PR 添加了 GitHub PR 获取 API、AI 驱动的 PR Review 分析管道、规则预检查功能及相关路由，并提供了大量单元测试。",
    "mainChanges": [
      "添加 GitHub REST API 客户端，支持获取 PR 元数据和变更文件",
      "实现 AI 驱动的 PR Review 分析管道，包括上下文构建、DeepSeek API 调用和结果解析",
      "添加规则预检查功能，自动检测安全、依赖、大文件变更等",
      "添加 POST /api/pr/fetch 和 POST /api/pr/analyze 路由",
      "为所有模块添加了全面的单元测试"
    ],
    "fileSummaries": [
      {
        "filePath": "docs/pr-2-real-ai-test-report.md",
        "summary": "记录真实 AI 测试报告，包含解析结果、规则预检和 AI 分析输出"
      },
      {
        "filePath": "lib/rule-checker.ts",
        "summary": "实现规则检查逻辑，通过文件路径和补丁内容正则扫描，预检权限、安全、依赖等风险"
      },
      {
        "filePath": "tests/rule-checker.test.ts",
        "summary": "测试 rule-checker 的各种规则触发场景和消息格式"
      },
      {
        "filePath": ".env.example",
        "summary": "环境变量示例文件，包含 DeepSeek API 密钥占位符"
      },
      {
        "filePath": "lib/ai-review.ts",
        "summary": "核心 AI 分析逻辑，构建 prompt、调用 DeepSeek API、解析结果并回退到 mock 分析"
      },
      {
        "filePath": "tests/pr-analyze-route.test.ts",
        "summary": "测试 POST /api/pr/analyze 路由的 mock 和错误场景"
      },
      {
        "filePath": "lib/github.ts",
        "summary": "GitHub API 客户端，负责获取 PR 详情、文件列表和有限上下文文件"
      },
      {
        "filePath": "lib/ai-context-builder.ts",
        "summary": "构建提供给 AI 的结构化上下文数据"
      },
      {
        "filePath": "tests/ai-review.test.ts",
        "summary": "ai-review 模块的单元测试"
      },
      {
        "filePath": "tests/github-fetch.test.ts",
        "summary": "GitHub fetch 功能的单元测试"
      },
      {
        "filePath": "tests/ai-context-builder.test.ts",
        "summary": "ai-context-builder 的单元测试"
      },
      {
        "filePath": "lib/mock-analysis.ts",
        "summary": "提供模拟分析结果，用于无 API 密钥时的回退方案"
      },
      {
        "filePath": "tests/pr-fetch-route.test.ts",
        "summary": "POST /api/pr/fetch 路由的测试"
      },
      {
        "filePath": "tests/mock-analysis.test.ts",
        "summary": "mock-analysis 的单元测试"
      },
      {
        "filePath": "app/api/pr/analyze/route.ts",
        "summary": "/api/pr/analyze 的路由处理器"
      },
      {
        "filePath": "types/analysis.ts",
        "summary": "分析相关类型定义"
      },
      {
        "filePath": "app/api/pr/fetch/route.ts",
        "summary": "/api/pr/fetch 的路由处理器"
      },
      {
        "filePath": "types/ai-context.ts",
        "summary": "AI 上下文数据类型定义"
      },
      {
        "filePath": "types/github.ts",
        "summary": "扩展了 GitHub 相关类型，添加了额外字段"
      },
      {
        "filePath": "docs/data-mapping.md",
        "summary": "数据映射文档"
      },
      {
        "filePath": ".gitignore",
        "summary": "修改了 .gitignore 文件"
      }
    ]
  },
  "risks": [
    {
      "level": "low",
      "type": "security",
      "filePath": ".env.example",
      "description": "环境变量示例文件包含 DEEPSEEK_API_KEY 占位符，需确保真实密钥不会提交到版本控制。",
      "evidence": "文件内容仅有一行：DEEPSEEK_API_KEY=your_deepseek_api_key",
      "impact": "如果误将真实密钥写入此文件并提交，可能导致密钥泄露。",
      "suggestion": "确认 .env.example 已在 .gitignore 中且不会包含实际凭据，敏感密钥应存储在安全保管库。",
      "confidence": 0.4
    },
    {
      "level": "medium",
      "type": "maintainability",
      "filePath": "lib/rule-checker.ts",
      "description": "规则检查中的 any 检测正则表达式可能误匹配单词内包含 any 的字符串，例如 company，导致误报。",
      "evidence": "代码中使用单词边界匹配 any 来检测 any 类型。",
      "impact": "可能产生不准确的 type-safety 规则预检结果，误导后续 AI 分析。",
      "suggestion": "使用更精确的匹配逻辑，例如只匹配 TypeScript 类型声明中的 any，或结合 AST 分析。",
      "confidence": 0.7
    },
    {
      "level": "medium",
      "type": "maintainability",
      "filePath": "lib/ai-review.ts",
      "description": "文件长度 357 行，超过 300 行的审查阈值，可能影响可读性和维护性。",
      "evidence": "changedFiles 显示该文件增加了 357 行。",
      "impact": "后续修改可能增加认知负担，且难以单独测试各部分逻辑。",
      "suggestion": "建议人工复查，考虑将 prompt 构建、API 调用、结果解析拆分为独立模块。",
      "confidence": 0.6
    },
    {
      "level": "medium",
      "type": "compatibility",
      "filePath": "lib/github.ts",
      "description": "GitHub API 文件列表可能分页，当前代码未见分页处理逻辑，可能导致文件数超过默认分页大小时遗漏文件。",
      "evidence": "可见 fetchPullRequestFiles 函数返回 ChangedFile 数组，未发现分页参数或循环逻辑。",
      "impact": "对于文件数较多的 PR，分析可能不完整，导致漏检风险。",
      "suggestion": "请人工确认是否已处理分页，如有必要，增加分页循环以获取所有变更文件。",
      "confidence": 0.5
    },
    {
      "level": "low",
      "type": "test-missing",
      "filePath": "tests/pr-analyze-route.test.ts",
      "description": "测试中使用 globalThis.fetch 直接 mock，可能污染全局状态，影响其他测试的执行。",
      "evidence": "测试代码直接给 globalThis.fetch 赋值箭头函数，未在测试后清理。",
      "impact": "可能导致其他测试因 mock 残留而意外失败或成功。",
      "suggestion": "建议使用 afterEach 钩子恢复原始 fetch，或采用模块级 mock、依赖注入方式避免全局污染。",
      "confidence": 0.4
    }
  ],
  "reviewSuggestions": [
    {
      "filePath": "lib/rule-checker.ts",
      "type": "maintainability",
      "comment": "建议改进检测 TypeScript any 的正则表达式，避免单词边界误判。可以只匹配类型声明场景中的 any，或直接结合 TypeScript AST 做更准确的检测。"
    },
    {
      "filePath": "lib/github.ts",
      "type": "requirement-confirmation",
      "comment": "请确认是否已处理 GitHub API 的分页。如果文件数超过默认每页数量，需要循环请求并合并结果，否则会丢失文件。"
    },
    {
      "filePath": "tests/pr-analyze-route.test.ts",
      "type": "test",
      "comment": "建议在测试结束后恢复原始 fetch，避免 globalThis.fetch 泄漏影响其他测试。"
    },
    {
      "filePath": "lib/ai-review.ts",
      "type": "refactor",
      "comment": "考虑将大型 prompt 模板和 JSON 解析逻辑提取到独立模块，以提高可读性和可测试性。"
    }
  ],
  "testSuggestions": {
    "scenarios": [
      "验证 GitHub API 返回多页文件列表时，能正确获取所有变更文件",
      "模拟 DEEPSEEK_API_KEY 未设置时，回退到 mock 分析",
      "模拟 AI API 调用超时或返回非预期 JSON，验证错误处理与回退逻辑"
    ],
    "edgeCases": [
      "PR 包含超过默认分页大小的文件数量，触发 GitHub API 分页",
      "文件补丁包含多字节字符或特殊正则符号，确保解析不异常",
      "规则检查器自身被检测出 console.log 或 any，验证不会递归生成无限发现"
    ],
    "hasTestMissingRisk": true
  },
  "conclusion": {
    "decision": "建议重点人工复查",
    "reason": "关键文件 lib/ai-review.ts 和 lib/github.ts 涉及较多核心逻辑变更，存在分页缺失与大文件可维护性风险。建议重点核实 GitHub API 分页处理、AI 调用错误处理和模块划分。"
  }
}
```

## 运行观察

第一次调用时，模型返回内容中包含未正确转义的正则反斜杠，导致 `JSON.parse` 失败。补充规则后重新调用成功：

```text
JSON 字符串中不要包含正则字面量或反斜杠；如果需要描述正则，请用自然语言描述，确保 JSON.parse 可以直接解析。
```

这说明后续正式实现提示词时，需要把“严格 JSON 可解析性”作为硬性约束。
