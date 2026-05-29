"""Utilities for parsing unified diff content."""

from __future__ import annotations


def parse_diff(diff_text: str) -> dict:
    """Parse raw unified diff text into a structured representation."""
    return {"raw": diff_text, "files": []}

