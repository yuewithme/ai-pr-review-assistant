"""GitHub Pull Request data access."""

from __future__ import annotations


class GitHubClient:
    """Fetches Pull Request metadata and diff content from GitHub."""

    def fetch_pull_request(self, pr_url: str) -> dict:
        raise NotImplementedError("GitHub API integration is not implemented yet.")

