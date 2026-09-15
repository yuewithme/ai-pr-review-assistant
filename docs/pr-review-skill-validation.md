# PR Review Skill 验收记录

日期：2026-09-15。环境：Windows、Python 3.13.2、Git、已有 GitHub CLI 登录态。

## 结论

已完成 skill 文件校验、真实 GitHub 取数、代码查证、相关运行验证和本机安装。安装后的脚本可在原项目之外运行，不依赖 Next.js、npm 包或 DeepSeek。

这次验收由当前 AI 按 `SKILL.md` 执行。没有使用独立评审 agent，也未验证下一次会话中的自动匹配界面；本机安装文件和独立运行已验证。

## 数据与错误处理

| 检查 | 实际结果 |
|---|---|
| Skill 官方结构校验 | 仓库源文件和本机安装副本均通过；Windows 下使用 `python -X utf8` 读取中文文件 |
| 真实 PR 文件清单 | Requests #7588，预期 2 个，获取 2 个，两个 patch 均通过 hunk 与增删行数核对 |
| 分页 | 在本次验证进程中将每页数量设为 1，实际访问 3 页（末页为空）；两个文件的元数据与 patch 与正常请求一致，发布脚本默认仍为 100 |
| Fork 文件读取 | 从 `wanxiankai/requests` 按 head SHA 读取完整源文件 |
| Before 文件读取 | 从 `psf/requests` 按 merge-base SHA 读取原版本 |
| 内容一致性 | API 读取的 head 文件与 `git show HEAD:src/requests/sessions.py` 的 blob 字节完全一致 |
| 匿名公开访问 | 在验证进程中关闭凭据与 gh 路径后，标准库 HTTP 请求成功读取同一公开 PR |
| 非法链接 | HTTP、伪造域名、issue 链接和 PR #0 均拒绝 |
| patch 缺失/截断 | 空 patch 标记 missing；移除真实 patch 最后一行后标记 incomplete |
| 文件不存在/目录 | 404 和目录读取均非零退出，并且未生成目标内容文件 |
| 提交时效 | 原快照返回 unchanged；把快照副本的 head 改为旧 base SHA 后，check 返回 changed 和退出码 1 |
| 安装一致性 | `C:\Users\J\.codex\skills\ai-pr-review` 中 4 个文件与仓库版本逐字节一致 |
| 跨目录调用 | 在临时目录调用安装后的脚本，check 成功；不会依赖项目当前目录 |

首次内容比较遇到 Windows Git checkout 自动转 CRLF，随后改用 Git blob 验证原始字节，结果一致；未修改被审查代码来绕过验证。

## 真实 PR 审查样例

审查对象：[psf/requests #7588 — Ignore None request cookies](https://github.com/psf/requests/pull/7588)。该 PR 在快照时已关闭、未合并；仅作为此次验收样例。

- Head：`5973ce88752d0820e47e892182f59a007929b4c7`
- Base / merge-base：`f361ead047be5cb873174218582f7d8b9fcd9f49`
- 内容：对请求级 Cookie 字典中的 `None` 项，删除当前请求合并后的同名 Cookie；保留 Session 原始状态。

### 审查结论

在已审查范围内未发现阻碍字典 Cookie 删除功能的问题。实际验证的请求准备路径可按 PR 目标工作：被标为 `None` 的 Cookie 不进入生成的请求头，其他 Cookie 正常保留，Session 中原 Cookie 未被删除。

证据位置：

- [sessions.py:526](https://github.com/wanxiankai/requests/blob/5973ce88752d0820e47e892182f59a007929b4c7/src/requests/sessions.py#L526)：提取值为 `None` 的名称。
- [sessions.py:537](https://github.com/wanxiankai/requests/blob/5973ce88752d0820e47e892182f59a007929b4c7/src/requests/sessions.py#L537)：合并到新的 CookieJar，再从副本删除。
- [cookies.py:164](https://github.com/wanxiankai/requests/blob/5973ce88752d0820e47e892182f59a007929b4c7/src/requests/cookies.py#L164)：按名称收集待删除项，随后删除，避免边遍历边修改。
- [models.py:699](https://github.com/wanxiankai/requests/blob/5973ce88752d0820e47e892182f59a007929b4c7/src/requests/models.py#L699)：依据合并后的 CookieJar 生成请求头。
- [test_requests.py:425](https://github.com/wanxiankai/requests/blob/5973ce88752d0820e47e892182f59a007929b4c7/tests/test_requests.py#L425)：新增回归测试覆盖单个删除及 Session 状态保留。

### 实际运行验证

在独立临时 Git 仓库获取并核对上述 head SHA，使用该仓库的 `src` 目录导入 Requests，未修改源代码或安装新的测试依赖。

运行 PR 新增的原有测试：

```text
pytest -q -o addopts= tests/test_requests.py::TestRequests::test_request_cookie_none_removes_session_cookie
结果：1 passed in 0.98s
```

实际通过 Python 调用 `pytest.main` 执行，禁用了外部 pytest 插件自动加载，并将该 checkout 的 `src` 置于导入路径首位，确认使用的是被审查版本。

另对 `Session.prepare_request` 执行 7 个无需网络的使用场景，全部通过：删除一个 Cookie、删除全部 Cookie 时不产生空头、删除不存在的 Cookie、保留空字符串值、正常值覆盖、无覆盖时保留 Session、普通 RequestsCookieJar 值覆盖。每个场景同时检查 Session 状态未被污染。

### 覆盖限制

- 已阅读两个变更文件的全部 patch，以及 Session 准备请求、Cookie 合并/删除和请求头生成的相关实现。
- 没有执行真实 HTTP 发送、跨域重定向、自定义 CookiePolicy、CookieJar 中值为 None 的全部组合或跨 Python 版本验证；不能将结果推广到这些场景。
- 本次未验证私有仓库、真实超过 3,000 文件的 PR、真实重命名 PR、大型/二进制文件或删除 fork 后的读取。脚本/规范对这些情况设有处理边界，但不声称已实测。
- 当前样例未发现需要修改的问题，不等于已证明 skill 能发现所有缺陷。后续可根据实际 PR 使用反馈校正审查规范。

## 用户调用

```text
$ai-pr-review 审查这个 PR 是否能正确使用：https://github.com/OWNER/REPO/pull/123
```

如果新 skill 尚未出现在可用列表，重启 Codex 后再次调用。用户应提供自己的 PR 链接；上述 Requests PR 不会作为默认审查目标。
