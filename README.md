# AI PR Review Assistant

AI PR Review Assistant is a lightweight tool concept for improving GitHub Pull Request review efficiency and quality. Users provide a GitHub PR URL, and the system fetches PR changes, builds review context, identifies risky code areas, and generates structured review suggestions.

## Goals

- Summarize what changed in a Pull Request.
- Identify risky files, patterns, and missing review signals.
- Generate actionable review suggestions for developers.
- Explain model choice, context strategy, false-positive control, and future expansion.

## MVP Scope

The first version focuses on a single GitHub PR analysis workflow:

```bash
POST /api/pr/analyze
{
  "prUrl": "https://github.com/owner/repo/pull/123"
}
```

The expected output is structured analysis data that can be rendered as an HTML report containing:

- PR change summary
- Risk analysis
- Review suggestions
- File-level change summaries
- Test suggestions

## Project Structure

```text
app/                   Next.js App Router API routes
docs/                  Product and architecture documentation
lib/                   Backend parsing, GitHub fetch, context, rules, and AI review logic
types/                 Shared TypeScript types
extension/             Chrome extension MVP
src/ai_pr_review/      Core Python package
tests/                 Unit tests and fixtures
examples/              Sample diff and sample report
prompts/               Prompt templates for AI analysis
```

## Prompt Design

Prompt templates are treated as first-class project assets:

- `prompts/ai-review-system.md` and `prompts/ai-review-user.md` generate structured analysis JSON.
- `prompts/report-display-system.md` and `prompts/report-display-user.md` shape analysis data for front-end display.
- `prompts/report-html-system.md` and `prompts/report-html-user.md` fix the final HTML report format.

See `docs/README.md` for the full documentation index, and `docs/prompt-design.md` for the prompt architecture, output contracts, and report layout rules.

## Current Status

The repository contains the backend API foundation, GitHub PR fetch flow, rule precheck module, AI analysis integration, prompt templates, and an example HTML report.

## Browser Extension MVP

The `extension/` directory contains a Chrome Manifest V3 extension prototype.

It detects the current GitHub PR page, lets the user trigger analysis from a popup, calls `POST /api/pr/report-html`, opens the generated HTML report in a new tab, and keeps only lightweight recent-report metadata in local extension storage.
