from ai_pr_review.diff_parser import parse_diff


def test_parse_diff_preserves_raw_text() -> None:
    diff = "diff --git a/app.py b/app.py\n+print('hello')\n"
    parsed = parse_diff(diff)
    assert parsed["raw"] == diff
    assert parsed["files"] == []

