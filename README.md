# AI PR Review Assistant

AI PR Review Assistant 是一个面向 GitHub Pull Request 的 AI 代码评审助手。用户输入或在浏览器插件中识别一个 GitHub PR 链接，系统会自动获取 PR 信息和代码 diff，经过规则预检测、上下文整理和 AI 分析后，生成一份中文 HTML Review 报告。

项目目标不是替代人工 reviewer，而是帮助 reviewer 更快理解 PR 改动、定位高风险文件、获得可复制的 Review 建议，并把注意力集中在真正可能影响功能、安全、稳定性和可维护性的地方。

## 核心能力

- PR 变更总结：概括本次 PR 的整体目的、主要改动点和文件级摘要。
- 风险代码识别：结合文件路径、diff、规则预检测和 AI 分析识别潜在风险。
- Review 建议生成：输出接近真实 code review 评论的中文建议。
- HTML 报告展示：把结构化分析结果渲染成适合阅读、下载和归档的报告。
- 浏览器插件入口：在 GitHub PR 页面自动识别当前 PR，一键触发分析并打开报告。

## 产品思路

代码评审真正困难的地方通常不是“看不懂一行代码”，而是：

- PR 改动范围太散，reviewer 很难快速建立整体上下文。
- 风险点隐藏在权限、配置、依赖、测试缺失、异常处理等细节里。
- 大模型如果直接读取原始 GitHub API 返回值，容易被无关字段干扰。
- 如果报告只输出泛泛建议，开发者很难直接修改。

因此本项目采用“数据获取 -> 上下文整理 -> 规则预检测 -> AI 结构化分析 -> HTML 展示”的流程。

```text
GitHub PR 链接
  -> 解析 owner / repo / pullNumber
  -> 获取 PR 元数据、changed files、patch、有限上下文文件
  -> 规则预检测，标注权限、依赖、安全、测试、超大改动等风险信号
  -> 构建 AI 标准上下文，过滤无用字段、控制上下文长度、排序高风险文件
  -> DeepSeek 模型输出结构化 JSON
  -> 固定 HTML 模板渲染成人类可读报告
```

这样做的核心原因是：AI 只负责分析，不负责猜测数据结构；展示层只负责把稳定 JSON 展开成统一报告。后续换模型、改报告样式、扩展数据库，都不会破坏主流程。

## 第一版边界

当前版本只做单个 GitHub PR 的辅助分析：

- 只支持 GitHub Pull Request。
- 只分析单个 PR 链接。
- 只读取 PR diff 和有限上下文文件。
- 不自动合并 PR。
- 不自动提交评论到 GitHub。
- 不接账号系统和数据库。
- 浏览器插件只作为轻量入口，不保存 GitHub Token 或 AI Key。

## 运行模式

当前产品只保留一种面向用户的运行方式：浏览器插件模式。

插件是用户入口，后端服务负责实际分析。用户不需要理解后端接口，也不需要手动调用 API；正常使用时只需要在 GitHub PR 页面点击插件即可。

1. 打开 Chrome 或 Chromium 浏览器。
2. 进入 `chrome://extensions`。
3. 打开“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择项目中的 `extension/` 目录。
6. 打开一个 GitHub PR 页面。
7. 点击插件图标。
8. 插件会自动填入当前 PR 链接。
9. 点击“开始分析”。
10. 分析完成后会自动打开 HTML 报告页。

如果当前页面不是 GitHub PR，插件不会自动填入链接，需要手动粘贴 PR 链接。

插件支持：

- 展示分析进度。
- 重新打开当前报告。
- 下载 HTML 报告，文件名使用报告标题。
- 复制 Review 建议。
- 查看最近 5 条报告记录，并选择指定报告打开或下载。

## 本地运行

本地运行主要用于开发和调试插件背后的后端服务。

安装依赖：

```bash
npm install
```

创建本地环境变量文件：

```bash
cp .env.example .env.local
```

Windows PowerShell 可以使用：

```powershell
Copy-Item .env.example .env.local
```

填写 DeepSeek API Key：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
```

启动开发服务：

```bash
npm run dev
```

默认服务地址：

```text
http://localhost:3000
```

构建生产版本：

```bash
npm run build
```

运行测试：

```bash
npm run test:node
python -m pytest
```

## 环境变量

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
GITHUB_TOKEN=optional_github_token
```

说明：

- `DEEPSEEK_API_KEY`：服务端调用 DeepSeek 模型使用，不能放到浏览器插件里。
- `GITHUB_TOKEN`：可选，用于提高 GitHub REST API rate limit。没有 token 时也可以分析公开仓库 PR。

不要把 `.env.local` 提交到 GitHub。线上部署时应在 Vercel 或其他云平台的环境变量面板中配置。

## 报告内容

HTML 报告采用固定结构，方便阅读和后续产品化：

- 顶部标题和结论状态。
- PR 概览，包含作者、源分支、目标分支、修改文件数、新增行数、删除行数。
- 变更总结。
- 风险概览。
- 风险详情，包含风险类型、问题、依据、影响、建议、置信度和相关文件链接。
- Review 建议，尽量给出具体文件、修改前后对比和可执行建议。
- 测试建议。
- 紧凑文件级变更摘要。

报告会避免展示“内容截断”等内部处理信息。被截断的 diff 只影响 AI 输入范围，不进入最终报告干扰阅读。

## 技术结构

```text
app/                   Next.js App Router API routes
lib/                   PR 解析、GitHub 获取、规则检测、AI 分析、HTML 渲染
types/                 TypeScript 类型定义
prompts/               AI 分析和 HTML 报告提示词
extension/             Chrome Manifest V3 浏览器插件
docs/                  架构、数据映射、提示词设计和样例报告
tests/                 Node 和 Python 测试
```

关键模块：

- `lib/parser.ts`：解析和校验 GitHub PR URL。
- `lib/github.ts`：调用 GitHub REST API 获取 PR 数据。
- `lib/rule-checker.ts`：规则预检测，提供 AI 分析参考。
- `lib/ai-context-builder.ts`：清理、排序、截断和解释 AI 输入上下文。
- `lib/ai-review.ts`：调用 DeepSeek 模型并返回结构化分析结果。
- `lib/report-html.ts`：把结构化分析结果渲染成固定 HTML 报告。
- `extension/`：插件弹窗、后台任务、报告页和本地历史记录。

## 模型与上下文策略

当前版本默认使用 DeepSeek 模型。模型调用只发生在服务端，插件不会接触 API Key。

上下文不会直接把 GitHub API 原始返回值全部丢给模型，而是先做一层标准化处理：

- 只保留 AI 评审需要的字段。
- 给关键字段附带用途说明。
- 优先放入高风险文件和规则命中文件。
- 对超长 patch 做文件级截断。
- 不把截断提示写进最终报告。

规则预检测结果只作为分析提示，不直接等同于最终风险。AI 需要结合 diff 证据、文件路径和上下文判断风险等级。

## 后续开发方向

后续开发会继续围绕插件形态展开，重点不是增加复杂入口，而是提升分析可信度、报告可读性和真实 Review 场景中的可用性。

优先考虑以下方向：

1. 分析质量提升

   继续优化 AI 分析和规则预检测的配合方式，让风险判断更具体、更克制。重点降低误报，避免把规则命中直接当作最终风险；对权限、依赖、配置、测试缺失、异常处理等高价值场景做更细的判断。

2. 代码证据链增强

   让每个风险和 Review 建议都尽量绑定具体文件、代码片段、GitHub PR 文件链接和修改建议。报告中不仅说明“有什么问题”，还要说明“为什么判断有问题”以及“可以怎么改”。

3. 上下文获取优化

   继续改进 AI 输入上下文的筛选策略。后续可以按风险优先级读取更多上下文，例如 PR commits、关联说明、目标分支关键文件、测试目录和配置文件，而不是把 GitHub API 原始数据全部丢给模型。

4. 插件体验优化

   插件仍然作为唯一用户入口。后续重点优化 GitHub PR 页面识别、分析状态恢复、失败提示、历史报告管理、重新分析、下载和复制 Review 建议等交互，让用户尽量只需要在 PR 页面点击一次就能得到报告。

5. 报告展示打磨

   继续固定并优化 HTML 报告结构。风险详情、Review 建议、测试建议和文件级摘要要更紧凑、更适合阅读；代码片段、修改前后对比、文件跳转和单条建议复制会是重点。

6. 历史记录与存储

   第一阶段继续使用插件本地存储，保留轻量历史报告。等报告质量和交互流程稳定后，再考虑是否引入数据库，用于跨设备历史记录、团队共享和长期归档。

7. GitHub 深度集成

   后续可以考虑 GitHub App、私有仓库授权、读取已有 review comments、识别 CI 结果，以及在用户确认后把建议发布为 PR 评论。自动评论不会作为早期默认能力，避免产生噪音。

8. 评测与回归体系

   建立固定 PR 样例集，用来测试不同类型 PR 的分析结果是否稳定，包括小 PR、大 PR、依赖变更、权限改动、配置变更、测试缺失和无明显风险 PR。每次修改 prompt、规则或上下文策略，都需要避免报告质量退化。

整体优先级：

```text
分析质量和证据链
  -> 插件体验
  -> 报告展示
  -> 历史记录
  -> GitHub 深度集成
  -> 数据库和团队能力
```

## 当前状态

项目已经完成：

- PR URL 解析接口。
- GitHub PR 数据获取接口。
- 规则预检测模块。
- DeepSeek AI 分析模块。
- AI 上下文构建模块。
- HTML 报告生成接口。
- Chrome 插件 MVP。
- 单元测试和样例报告。

当前版本适合作为 AI PR Review Assistant 的 MVP 原型，用于展示完整分析链路和浏览器插件交互流程。
