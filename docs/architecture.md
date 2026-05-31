# Architecture

## High-Level Flow

```text
PR URL
  -> Chrome extension popup or Next.js API route
  -> GitHub Client
  -> PR Data Fetcher
  -> Rule Checker
  -> Context Builder
  -> AI Review Analyzer
  -> Structured Analysis JSON
  -> Display/HTML Report Renderer
```

## Components

### API Routes

Receives the PR URL and coordinates backend workflows through Next.js App Router endpoints.

- `POST /api/pr/parse`
- `POST /api/pr/fetch`
- `POST /api/pr/analyze`
- `POST /api/pr/report-html`

### Browser Extension

Provides the lightweight user entry point. It detects whether the active tab is a GitHub PR page, auto-fills the PR URL when possible, calls the backend HTML report endpoint, and opens the generated report in a new tab.

The extension stores only recent report metadata in `chrome.storage.local`. Full HTML reports are kept in `chrome.storage.session` for the current browser session.

### GitHub Client

Fetches PR title, description, file changes, commit information, and diff content from GitHub.

### PR Data Fetcher

Normalizes GitHub REST API responses into project-owned types for PR metadata, changed files, patches, and limited context files.

### Rule Checker

Runs deterministic prechecks before AI analysis. Examples include security-sensitive paths, dependency files, deleted tests, large diffs, and maintainability signals.

### Context Builder

Selects the smallest useful context for model analysis. It filters GitHub fields, ranks higher-risk files first, trims long patches silently, and avoids leaking trimming details into the final report.

### AI Review Analyzer

Uses AI prompts to produce structured PR review analysis:

- PR change summary.
- Risk explanations.
- Review suggestions.
- File-level summaries.
- Test suggestions.
- Overall conclusion.

### Prompt Templates

Prompt templates are stored in `prompts/` and documented in `docs/prompt-design.md`.

The prompt layers are:

- Analysis prompts.
- Display view-model prompts.
- HTML report prompts.

### Report Renderer

Formats the final result into structured JSON or a human-readable HTML report. The current HTML report format is implemented by the report renderer and documented by `prompts/report-html-system.md` and `prompts/report-html-user.md`.
