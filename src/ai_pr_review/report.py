"""Render review results into user-facing formats."""

from __future__ import annotations


def render_markdown(review: dict) -> str:
    """Render a review result as Markdown."""
    lines = [
        "# PR Review Report",
        "",
        "## Summary",
        review.get("summary", ""),
        "",
        "## Risks",
    ]
    risks = review.get("risks", [])
    if risks:
        for risk in risks:
            lines.append(f"- `{risk.get('path')}`: {risk.get('reason')}")
    else:
        lines.append("- No obvious risks detected.")
    return "\n".join(lines)

