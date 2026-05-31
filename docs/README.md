# Documentation Index

This directory contains the product, architecture, prompt, and report documentation for AI PR Review Assistant.

## Core Documents

| Document | Purpose |
|---|---|
| `product-boundary.md` | Product scope, users, MVP boundary, and out-of-scope items. |
| `architecture.md` | Backend flow, components, and prompt/report rendering architecture. |
| `data-mapping.md` | Field meanings and how GitHub data should be mapped for AI review. |
| `model-strategy.md` | Model role, rule engine role, context strategy, and false-positive control. |
| `future-roadmap.md` | Future extension ideas. |
| `prompt-design.md` | Official prompt architecture and prompt contract. |

## Browser Extension

The extension MVP lives in `../extension`.

It provides a lightweight Chrome popup that detects GitHub PR pages, calls the backend report endpoint, and opens the generated HTML report in a new tab.

## Prompt Assets

Prompt templates live in `../prompts`.

Current production prompt layers:

| Prompt | Purpose |
|---|---|
| `../prompts/ai-review-system.md` | System prompt for structured AI PR analysis. |
| `../prompts/ai-review-user.md` | User prompt and schema for structured AI PR analysis. |
| `../prompts/report-display-system.md` | System prompt for converting analysis output into display data. |
| `../prompts/report-display-user.md` | User prompt and schema for display data. |
| `../prompts/report-html-system.md` | System prompt for generating the final HTML report. |
| `../prompts/report-html-user.md` | User prompt that fixes the final HTML report layout. |

## Example Outputs

| Document | Purpose |
|---|---|
| `pr-2-real-ai-test-report.md` | End-to-end real AI test notes for PR #2. |
| `pr-2-structured-ai-analysis.md` | Structured analysis sample for PR #2. |
| `pr-2-review-report.html` | Human-readable HTML report sample for PR #2. |
