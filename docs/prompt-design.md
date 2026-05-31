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

## Context Trimming Rule

Context trimming is an internal budget control. It should not appear in the prompt as a report concern and should not appear in final user-facing output.

If content is trimmed, the system may analyze only retained content. Missing trimmed content should not create additional report sections, warnings, or review noise.

