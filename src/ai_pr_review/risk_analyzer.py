"""Rule-based risk analysis for Pull Request changes."""

from __future__ import annotations


RISK_KEYWORDS = ("auth", "token", "permission", "crypto", "payment", "secret", "config")


def analyze_risk(parsed_diff: dict) -> list[dict]:
    """Return initial risk signals from parsed diff data."""
    risks: list[dict] = []
    for file_info in parsed_diff.get("files", []):
        path = file_info.get("path", "").lower()
        if any(keyword in path for keyword in RISK_KEYWORDS):
            risks.append(
                {
                    "path": file_info.get("path"),
                    "level": "medium",
                    "reason": "File path matches security-sensitive keywords.",
                }
            )
    return risks

