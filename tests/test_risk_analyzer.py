from ai_pr_review.risk_analyzer import analyze_risk


def test_analyze_risk_flags_security_sensitive_paths() -> None:
    parsed_diff = {"files": [{"path": "src/auth/session.py"}]}
    risks = analyze_risk(parsed_diff)
    assert risks
    assert risks[0]["level"] == "medium"

