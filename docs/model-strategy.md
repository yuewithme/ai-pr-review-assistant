# Model Strategy

## Model Role

The model should perform semantic analysis that static rules cannot handle well:

- Explain the purpose of a change.
- Infer likely behavior impact.
- Identify review questions.
- Turn raw risk signals into actionable suggestions.

## Rule Engine Role

Rules should handle fast and explainable checks:

- Large file changes.
- Test deletion or missing test changes.
- Security-sensitive paths such as auth, token, permission, crypto, payment, and config.
- Dependency and CI changes.
- Broad refactors touching many modules.

## Context Strategy

The tool should avoid sending an entire repository by default. It should build compact context from:

- PR title and description.
- Changed file list.
- Diff hunks.
- Related config files.
- Nearby tests or missing test indicators.
- Repository README when useful.

## False-Positive Control

- Separate rule-based risk signals from model-generated conclusions.
- Require evidence for every high-risk suggestion.
- Prefer confidence levels over absolute claims.
- Ask review questions when the model is uncertain.

## Speed Strategy

- Analyze metadata and file paths first.
- Deep-analyze only risky or high-impact files.
- Keep prompt templates short and structured.
- Cache repeated GitHub API responses in future versions.

