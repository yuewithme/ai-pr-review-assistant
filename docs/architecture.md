# Architecture

## High-Level Flow

```text
PR URL
  -> CLI
  -> GitHub Client
  -> Diff Parser
  -> Context Builder
  -> Risk Analyzer
  -> Review Generator
  -> Report Renderer
```

## Components

### CLI

Receives the PR URL and command options, then coordinates the full review workflow.

### GitHub Client

Fetches PR title, description, file changes, commit information, and diff content from GitHub.

### Diff Parser

Turns raw diff text into structured data: changed files, hunks, added lines, deleted lines, and affected paths.

### Context Builder

Selects the smallest useful context for model analysis. The first version should prioritize PR metadata, diff content, changed file paths, README, dependency files, and nearby tests when available.

### Risk Analyzer

Uses deterministic rules to flag suspicious patterns before model analysis. Examples include security-sensitive paths, deleted tests, large diffs, configuration changes, and exception handling changes.

### Review Generator

Uses AI prompts to produce change summaries, risk explanations, review suggestions, and author questions.

### Report Renderer

Formats the final result into Markdown or JSON for terminal output, CI logs, or future GitHub comments.

