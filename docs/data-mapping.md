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
| `contextPolicy` | Truncation and budget info | Explains missing or shortened context |

Rules for AI:
- Prefer `changedFiles.patch` before claiming behavior.
- Every risk must reference a `changedFiles.filePath`.
- Do not treat `ruleFindings` as confirmed issues.
- Do not output high risk without concrete patch evidence.
- If context is truncated, mention uncertainty instead of guessing.

