请根据输入数据生成统一格式的 PR Review HTML 报告。

输入数据：

{
  "analysisResult": {{ANALYSIS_RESULT_JSON}},
  "sourceLinks": {
    "prUrl": "string",
    "filesUrl": "string",
    "sourceBranchUrl": "string",
    "targetBranchUrl": "string"
  },
  "fileLinks": {
    "path/to/file.ts": "https://github.com/owner/repo/pull/123/files#diff-..."
  },
  "displayConfig": {
    "title": "AI PR Review 报告",
    "language": "zh-CN"
  }
}

HTML 结构必须固定为以下顺序：

1. 顶部 Hero
   - 左上角小标题：AI PR Review 报告
   - H1：PR 标题
   - 副标题：整体总结
   - 结论 badge：建议通过 / 建议修改后通过 / 建议重点人工复查

2. PR 概览
   - 先展示一个 `overview-source` 区块：
     - 来源 PR 名称或 URL
     - “打开 PR”按钮，链接到 `sourceLinks.prUrl`
     - “查看 Files”按钮，链接到 `sourceLinks.filesUrl`
   - 再展示 6 个概览卡片：
     - 作者
     - 源分支，优先链接到 `sourceLinks.sourceBranchUrl`
     - 目标分支，优先链接到 `sourceLinks.targetBranchUrl`
     - 修改文件
     - 新增行数
     - 删除行数

3. 变更总结
   - 白色面板
   - 整体说明
   - 主要变更点列表
   - 主要涉及模块 chips

4. 风险概览
   - 三个风险统计卡片：高风险、中风险、低风险

5. 风险详情
   - 每条风险一个 `.risk` 卡片
   - 卡片头部：
     - 风险标题
     - 文件名链接：使用 `fileLinks[filePath]`
     - 风险等级 badge
   - 风险详情只允许展示这些字段：
     - 类型
     - 问题
     - 依据
     - 问题代码
     - 影响
     - 建议
     - 置信度
   - “问题”使用 `risk.description` 或 `risk.message`。
   - “依据”优先使用 `risk.evidence`，不要和“问题”重复。
   - 如果存在 `risk.codeSnippet`，在“依据”下方展示代码块，并提供“查看该文件在 PR 中的变更”链接。
   - 如果没有 `risk.codeSnippet`，仍然展示文件名链接作为跳转入口。
   - 不要展示“位置”字段。
   - 类型必须使用中英双语，例如：
     - `security / 安全`
     - `maintainability / 可维护性`
     - `compatibility / 兼容性`
     - `test-missing / 测试缺失`
     - `dependency / 依赖`
     - `permission / 权限`
     - `type-safety / 类型安全`
     - `large-change / 大变更`
     - `logic / 逻辑`
     - `boundary / 边界条件`
     - `performance / 性能`
     - `config / 配置`

6. Review 建议
   - 每条建议一个 `.comment` 卡片
   - 显示建议类型
   - 文件名放在建议类型下方，并使用 `fileLinks[filePath]` 生成链接
   - 显示可复制的 Review 评论正文
   - 如果存在 `suggestion.suggestedCode`，在评论正文下方展示“建议修改后的代码”代码块
   - 建议代码必须和该条建议对应，不要放到风险详情里混淆

7. 测试建议
   - 两列布局：
     - 建议补充场景
     - 重点边界条件
   - 下方展示是否存在测试缺失风险

8. 文件级变更摘要
   - 必须使用紧凑列表，不要使用每个文件一个大卡片。
   - 外层使用 `.file-list`
   - 每个文件使用 `.file-row`
   - 左侧文件名，右侧摘要
   - 文件名优先使用 `fileLinks[filePath]` 生成链接

9. 总体结论
   - 白色面板
   - 显示最终结论和原因

样式要求：

1. 页面最大宽度约 1120px，居中。
2. 背景使用浅灰色，内容面板使用白色。
3. 卡片圆角不超过 8px。
4. 风险等级颜色：
   - high：红色系
   - medium：黄色系
   - low：蓝色系
5. 文件路径使用等宽字体、小号浅灰底标签样式。
6. 文件级变更摘要必须紧凑，避免大面积空白。
7. 移动端下：
   - 概览卡片改为单列
   - 测试建议改为单列
   - 文件摘要行改为上下排列

输出要求：

1. 只输出 HTML。
2. 不要输出 Markdown。
3. 不要输出任何 HTML 之外的解释。
4. 如果某个数组为空，对应区域仍保留标题，但内容显示“暂无”。
5. 链接必须设置 `target="_blank"` 和 `rel="noreferrer"`。
6. 中文展示要求：
   - 面向用户的解释、问题、依据、影响、建议、Review 评论、文件摘要必须使用中文。
   - 文件路径、代码标识符、函数名、变量名、包名、分支名、PR 标题、风险类型英文枚举、status 枚举值和常见技术名词可以保留英文。
   - 如果输入字段本身是英文解释句，请转写为中文，不要直接照抄英文。
7. 风险展示要求：
   - 不要让“问题”和“依据”显示相同内容。
   - “依据”需要回答 reviewer 为什么要相信这个判断。
   - “建议”需要说明下一步怎么改、怎么验证、是否需要补测试或人工确认。
