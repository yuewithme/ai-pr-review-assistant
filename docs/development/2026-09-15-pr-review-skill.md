# PR 审查 Skill 开发日志

## 任务目标

将现有 GitHub PR 审查助手提炼为可安装、可调用的 `ai-pr-review` skill。当前 AI 执行有代码证据的审查，使用轻量脚本获取 GitHub 数据，日常使用无需启动 Next.js 或配置 DeepSeek。

## 实施计划

1. 记录迁移设计与验收标准，核实 GitHub 数据读取方式。
2. 在 `skills/ai-pr-review/` 创建独立 skill、界面元数据、审查参考和必要的数据读取脚本。
3. 更新项目入口说明，安装到本机 skill 目录。
4. 验证脚本、安装内容和真实公开 PR 审查流程，记录实际覆盖与限制。

完整计划见 [迁移计划](../pr-review-skill-plan.md)。

## 完成结果

- 已检查现有 TypeScript 审查主流程；Python CLI 仍为占位实现。
- 新流程使用宿主 AI 分析，沿用证据优先、规则只作线索、中文建议的原则。
- 实施前已有修改：`extension/README.md`、`extension/manifest.json`、`tests/extension-static.test.ts`；另有未跟踪的 `docs/chrome-store/`、`extension/icons/`、`release/`。
- 新增 `skills/ai-pr-review/`：入口规范、界面元数据、审查参考、Python 标准库数据脚本，共 4 个文件。
- 数据脚本支持分页、快照 SHA、merge-base、fork 文件读取、patch 覆盖标记和审查结束时的版本检查；错误非零退出，不产生模拟审查结果。
- README 增加推荐入口、安装、调用和真实验收记录链接，并区分浏览器后端的配置要求。
- 已安装到 `C:\Users\J\.codex\skills\ai-pr-review`，安装内容与仓库源文件一致。
- 状态：已实施并通过本次范围内的验证。

## 验证情况

- 已确认本机具备 Python、Git、GitHub CLI。
- 源 skill 和安装副本通过官方结构校验；运行脚本及跨目录调用通过。
- 使用真实公开 PR `psf/requests#7588` 完成读取、代码查证和中文审查；2 个变更文件完整获取。
- 验证真实分页、匿名访问、非法 URL、缺失/截断 patch、404、目录误读、旧快照拒绝和 Git blob 内容一致性。
- 在独立 checkout 运行 PR 新增的回归测试，结果 1 passed；另有 7 个 Cookie 使用场景通过。
- 只使用已安装的 pytest 执行该 PR 的一个现有测试，未引入测试框架、提交新的测试基础设施或运行本项目完整测试套件。
- 开发中发现 raw 内容接口可能把目录 JSON 当作文本文件，已在写出前通过 metadata 确认为普通文件；首次校验器使用系统 GBK 导致读取失败，改用 `python -X utf8` 验证通过。
- 已检查最终差异：本任务仅修改 README，新增 skill、迁移计划、验收记录与本日志；不包含此前已有的插件发布改动。
- 详细结果与未实测的边界见 [Skill 验收记录](../pr-review-skill-validation.md)。
