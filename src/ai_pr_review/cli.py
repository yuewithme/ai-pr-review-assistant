"""Command-line entry point for AI PR Review Assistant."""

from __future__ import annotations

import argparse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ai-pr-review",
        description="Generate an AI-assisted review report for a GitHub Pull Request.",
    )
    parser.add_argument("pr_url", help="GitHub Pull Request URL")
    parser.add_argument(
        "--format",
        choices=("markdown", "json"),
        default="markdown",
        help="Report output format",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    print(f"AI PR Review Assistant scaffold received: {args.pr_url}")
    print(f"Output format: {args.format}")
    print("Implementation will be added in the next development phase.")


if __name__ == "__main__":
    main()

