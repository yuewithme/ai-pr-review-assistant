# AI Context Field Guide

Use this as compact context for AI review prompts.

| Field | Meaning | Use |
|---|---|---|
| `prInfo.title` | PR title | Intent hint, not code evidence |
| `prInfo.description` | PR body | Author context, may be incomplete |
| `prInfo.sourceBranch` | PR source branch | Change origin |
| `prInfo.targetBranch` | Merge target branch | Impact target |
| `changedFiles.filePath` | Changed file path | Required anchor for risks |
| `changedFiles.patch` | Code diff | Primary evidence |
| `changedFiles.changes` | Changed line count | Review size signal |
| `contextFiles` | Limited repo files | Background only |
| `ruleFindings` | Rule precheck hints | Attention guide, not final risk |
| `contextPolicy` | Internal context budget info | Internal only; do not expose in report |

Rules for AI:
- Prefer `changedFiles.patch` before claiming behavior.
- Every risk must reference a `changedFiles.filePath`.
- Do not treat `ruleFindings` as confirmed issues.
- Do not output high risk without concrete patch evidence.
- Context trimming is internal. Do not mention truncation or missing trimmed content in the final report.

Display rules:
- File names should link to PR file diff URLs when `fileLinks[filePath]` is available.
- Risk details should not show a separate `position` field.
- Risk types should use English and Chinese labels, for example `security / 安全`.
- File-level summaries should use a compact list layout, not one large card per file.
