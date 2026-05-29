# AI PR Review Assistant

AI PR Review Assistant is a lightweight tool concept for improving GitHub Pull Request review efficiency and quality. Users provide a GitHub PR URL, and the system fetches PR changes, builds review context, identifies risky code areas, and generates structured review suggestions.

## Goals

- Summarize what changed in a Pull Request.
- Identify risky files, patterns, and missing review signals.
- Generate actionable review suggestions for developers.
- Explain model choice, context strategy, false-positive control, and future expansion.

## MVP Scope

The first version focuses on a command-line workflow:

```bash
ai-pr-review https://github.com/owner/repo/pull/123
```

The expected output is a Markdown report containing:

- PR change summary
- Risk analysis
- Review suggestions
- Open questions for the PR author

## Project Structure

```text
docs/                  Product and architecture documentation
src/ai_pr_review/      Core Python package
tests/                 Unit tests and fixtures
examples/              Sample diff and sample report
prompts/               Prompt templates for AI analysis
```

## Current Status

This repository currently contains the project framework and design documentation. Implementation will be added incrementally.

