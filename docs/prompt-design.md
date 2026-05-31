# Prompt Design

This project uses prompts as versioned product assets. Prompts are split by responsibility so analysis, display shaping, and HTML rendering can evolve independently.

## Prompt Layers

```text
GitHub PR data
  -> AI context builder
  -> analysis prompts
  -> structured analysis JSON
  -> display prompts
  -> display view model
  -> HTML prompts or renderer
  -> human-readable report
```

## Prompt Files

| File | Role | Output |
|---|---|---|
| `prompts/ai-review-system.md` | Defines the reviewer role, evidence rules, risk discipline, and JSON-only behavior. | Analysis JSON |
| `prompts/ai-review-user.md` | Defines the standard AI review input contract and expected analysis schema. | Analysis JSON |
| `prompts/report-display-system.md` | Converts analysis results into front-end display data without re-analyzing code. | Display JSON |
| `prompts/report-display-user.md` | Defines the display view model used by a report page. | Display JSON |
| `prompts/report-html-system.md` | Defines the HTML rendering role and safety rules. | Full HTML |
| `prompts/report-html-user.md` | Fixes the final report layout, sections, link rules, and visual structure. | Full HTML |

The older prompt files `review_summary.md`, `risk_analysis.md`, and `review_suggestions.md` are early narrow prompts. Keep them as references, but use the layered prompts above for the current workflow.

## Analysis Prompt Contract

The analysis prompt should only generate structured review content:

- PR change summary.
- Risk identification.
- Review suggestions.
- File-level summaries.
- Test suggestions.
- Overall conclusion.

Analysis output must stay evidence-based:

- Every risk must reference a changed file.
- High risk requires concrete patch evidence.
- Rule precheck findings are hints, not final conclusions.
- Weak evidence should lower confidence instead of creating stronger claims.
- The prompt should not expose internal context trimming details to the report.
- User-facing analysis text must be Chinese. Technical identifiers such as file paths, code symbols, branch names, enum values, and terms like `TypeScript`, `GitHub`, `API`, `JSON`, `diff`, `patch`, and `token` may remain in English.
- English rule precheck messages or context snippets should be rewritten into Chinese explanations before they appear in `summary`, risks, review suggestions, or file summaries.
- Risk descriptions and evidence must not duplicate each other. The description states the issue; evidence explains the concrete basis from patch, rule finding, metadata, or context.
- When possible, risk output should include a `codeSnippet` copied from `changedFiles.patch`. If no concrete snippet exists, use an empty string instead of inventing code.
- Suggestions should be actionable for humans: what to change, what to test, and what boundary to confirm.
- Review suggestions may include `suggestedCode` when there is enough context to show a concrete code or test change. If the suggestion only asks for human confirmation, keep `suggestedCode` empty.

## Display Prompt Contract

The display prompt should not discover new risks. It only reshapes the analysis result for human reading:

- Preserve risk count, level, file path, confidence, and conclusion.
- Improve wording for readability.
- Keep report sections stable.
- Keep file names and review comments easy to scan.

## HTML Report Contract

The HTML prompt fixes the report format used by the project:

1. Hero.
2. PR overview with source PR links.
3. Change summary.
4. Risk overview.
5. Risk details.
6. Review suggestions.
7. Test suggestions.
8. Compact file-level summaries.
9. Overall conclusion.

Risk details must not show a separate `position` field. File names already link to the corresponding PR file diff when `fileLinks[filePath]` is available.

Risk details should show:

- Issue: the concise risk statement.
- Evidence: why the model believes this risk exists.
- Problem code: `risk.codeSnippet`, when available.
- Link: file name or “查看该文件在 PR 中的变更” should jump to the PR Files view for that file.
- Suggestion: detailed enough for the author to act on.

Review suggestions may additionally show:

- Suggested code: `suggestion.suggestedCode`, when available, under the matching review comment.

Risk types must be displayed in English and Chinese, for example:

- `security / 安全`
- `maintainability / 可维护性`
- `compatibility / 兼容性`
- `test-missing / 测试缺失`
- `dependency / 依赖`
- `permission / 权限`
- `type-safety / 类型安全`
- `large-change / 大变更`

## Link Rules

The report should use links only from prepared input:

- `sourceLinks.prUrl` for the source PR.
- `sourceLinks.filesUrl` for the PR Files page.
- `sourceLinks.sourceBranchUrl` and `sourceLinks.targetBranchUrl` for branch links.
- `fileLinks[filePath]` for file names in risks, review suggestions, and file summaries.

Do not ask the model to invent GitHub URLs. The application should compute PR file links before rendering.

## Language Rules

HTML reports are for Chinese readers. All explanatory text in the final report should be Chinese, while technical names can stay in their original form.

Keep as-is:

- File paths, code symbols, function names, package names, branch names, PR titles.
- Risk type enum values in bilingual labels, for example `type-safety / 类型安全`.
- Common technical terms such as `TypeScript`, `GitHub`, `API`, `JSON`, `diff`, `patch`, and `token`.

Rewrite to Chinese:

- Risk titles and descriptions.
- Evidence, impact, and suggestions.
- Review comments.
- File-level summaries.
- Any English sentence copied from `ruleFindings` or fallback analysis.

## Context Trimming Rule

Context trimming is an internal budget control. It should not appear in the prompt as a report concern and should not appear in final user-facing output.

If content is trimmed, the system may analyze only retained content. Missing trimmed content should not create additional report sections, warnings, or review noise.
