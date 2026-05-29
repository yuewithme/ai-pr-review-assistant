"""Build compact review context for model analysis."""

from __future__ import annotations


def build_context(pr_data: dict, parsed_diff: dict) -> dict:
    """Build the smallest useful context for review generation."""
    return {"pr": pr_data, "diff": parsed_diff}

