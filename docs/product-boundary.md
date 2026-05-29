# Product Boundary

## Target Users

- Developers who review GitHub Pull Requests.
- Team leads who need faster first-pass review signals.
- Students or project teams demonstrating AI-assisted software engineering workflows.

## In Scope

- Accept a GitHub PR URL as input.
- Fetch PR metadata and code changes.
- Parse changed files and diff hunks.
- Summarize PR intent and change impact.
- Identify risky code changes using rules and AI analysis.
- Generate structured review suggestions.
- Output Markdown or JSON reports.

## Out of Scope

- Automatically approving or rejecting PRs.
- Fully replacing human code review.
- Acting as a complete CI system.
- Enterprise permission management.
- Guaranteed support for every programming language.
- Directly writing review comments back to GitHub in the MVP.

## MVP Boundary

The MVP should prove one complete workflow:

1. User provides a GitHub PR URL.
2. The tool fetches PR data.
3. The tool builds review context from diff and metadata.
4. The tool generates a structured review report.

