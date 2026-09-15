#!/usr/bin/env python3
"""Read-only GitHub PR snapshots and pinned source files. Python 3.10+, stdlib."""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen

PAGE_SIZE = 100
MAX_FILES = 3000


class ReviewError(Exception):
    pass


def parse_pr_url(value: str) -> tuple[str, int]:
    url = urlsplit(value.strip())
    match = re.fullmatch(
        r"/([A-Za-z0-9-]+)/([A-Za-z0-9_.-]+)/pull/([1-9][0-9]*)(?:/(?:files|commits|checks))?/?",
        url.path,
    )
    if url.scheme != "https" or url.netloc.lower() != "github.com" or not match:
        raise ReviewError("Use an HTTPS github.com OWNER/REPO/pull/NUMBER URL.")
    repo = f"{match[1]}/{match[2]}"
    validate_repo(repo)
    return repo, int(match[3])


def validate_repo(repo: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9-]+/[A-Za-z0-9_.-]+", repo) or repo.split("/")[1] in (".", ".."):
        raise ReviewError("Invalid GitHub repository name.")
    return repo


def validate_sha(sha: str) -> str:
    if not re.fullmatch(r"[0-9a-fA-F]{40}", sha):
        raise ReviewError("Missing or invalid commit SHA in GitHub data.")
    return sha


class GitHub:
    def __init__(self) -> None:
        self.token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
        self.use_gh = False
        if not self.token and shutil.which("gh"):
            status = subprocess.run(
                ["gh", "auth", "status", "--hostname", "github.com"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30,
            )
            self.use_gh = status.returncode == 0

    def read(self, endpoint: str, *, raw: bool = False):
        accept = "application/vnd.github.raw+json" if raw else "application/vnd.github+json"
        if self.use_gh:
            result = subprocess.run(
                ["gh", "api", "--hostname", "github.com", "--method", "GET", endpoint,
                 "-H", f"Accept: {accept}", "-H", "X-GitHub-Api-Version: 2022-11-28"],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90,
            )
            if result.returncode:
                # Avoid echoing arbitrary API bodies or environment credentials.
                status = re.search(rb"HTTP (\d{3})", result.stderr)
                code = status[1].decode() if status else "request failed"
                raise ReviewError(f"GitHub {code}: check access, rate limits and the requested resource.")
            data = result.stdout
        else:
            headers = {"Accept": accept, "User-Agent": "ai-pr-review-skill",
                       "X-GitHub-Api-Version": "2022-11-28"}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            request = Request("https://api.github.com/" + endpoint, headers=headers)
            try:
                with urlopen(request, timeout=90) as response:
                    data = response.read()
            except HTTPError as exc:
                raise ReviewError(f"GitHub HTTP {exc.code}: check access, rate limits and the requested resource.") from None
            except URLError:
                raise ReviewError("Cannot reach api.github.com; check network access.") from None
        return data if raw else json.loads(data)


def patch_status(file: dict) -> str:
    patch = file.get("patch")
    if not patch:
        return "missing"
    additions = deletions = old = new = 0
    expected = None
    for line in patch.rstrip("\n").split("\n"):
        hunk = re.match(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line)
        if hunk:
            if expected is not None and (old, new) != expected:
                return "incomplete"
            expected = (int(hunk[2] or 1), int(hunk[4] or 1))
            old = new = 0
        elif expected is None:
            return "incomplete"
        elif line.startswith("+"):
            additions += 1
            new += 1
        elif line.startswith("-"):
            deletions += 1
            old += 1
        elif line.startswith(" "):
            old += 1
            new += 1
        elif not line.startswith("\\"):
            return "incomplete"
    if expected is None or (old, new) != expected:
        return "incomplete"
    return "available" if (additions, deletions) == (file["additions"], file["deletions"]) else "incomplete"


def version(pr: dict) -> tuple[str, str]:
    return validate_sha(pr["base"]["sha"]), validate_sha(pr["head"]["sha"])


def fetch_snapshot(api: GitHub, url: str, out: str | None) -> dict:
    repo, number = parse_pr_url(url)
    endpoint = f"repos/{repo}/pulls/{number}"
    pr = api.read(endpoint)
    base_sha, head_sha = version(pr)
    files = []
    pages = 0
    for page in range(1, (MAX_FILES + PAGE_SIZE - 1) // PAGE_SIZE + 1):
        batch = api.read(f"{endpoint}/files?per_page={PAGE_SIZE}&page={page}")
        if not isinstance(batch, list):
            raise ReviewError("GitHub did not return a file list.")
        files.extend(batch)
        pages += 1
        if len(batch) < PAGE_SIZE:
            break
    compare = api.read(f"repos/{repo}/compare/{base_sha}...{head_sha}?per_page=1")
    merge_base = validate_sha(compare["merge_base_commit"]["sha"])
    if version(api.read(endpoint)) != (base_sha, head_sha):
        raise ReviewError("PR changed during download. Fetch a new snapshot before reviewing.")
    names = [file["filename"] for file in files]
    if len(names) != len(set(names)):
        raise ReviewError("Duplicate files in paginated data. Fetch a new snapshot.")
    files_complete = len(files) == pr["changed_files"]
    destination = Path(out).resolve() if out else Path(tempfile.mkdtemp(prefix="ai-pr-review-"))
    if destination.exists() and any(destination.iterdir()):
        raise ReviewError("Output directory is not empty; choose a fresh directory.")
    destination.mkdir(parents=True, exist_ok=True)
    patches = destination / "patches"
    patches.mkdir()
    mapped = []
    for index, file in enumerate(files, 1):
        patch_file = f"patches/{index:04d}.patch" if file.get("patch") else None
        if patch_file:
            (destination / patch_file).write_text(file["patch"], encoding="utf-8")
        mapped.append({
            "path": file["filename"], "previousPath": file.get("previous_filename"),
            "status": file["status"], "additions": file["additions"],
            "deletions": file["deletions"], "patchFile": patch_file,
            "patchStatus": patch_status(file),
        })
    gaps = [file["path"] for file in mapped if file["patchStatus"] != "available"]
    snapshot = {
        "schemaVersion": 1, "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "pr": {
            "url": f"https://github.com/{repo}/pull/{number}", "repo": repo, "number": number,
            "title": pr["title"], "body": pr.get("body") or "", "state": pr["state"],
            "draft": pr.get("draft", False), "merged": pr.get("merged", False),
            "author": (pr.get("user") or {}).get("login"),
            "baseSha": base_sha, "headSha": head_sha, "mergeBaseSha": merge_base,
            "baseRef": pr["base"]["ref"], "headRef": pr["head"]["ref"],
            "headRepo": (pr["head"].get("repo") or {}).get("full_name") or repo,
        },
        "coverage": {
            "expectedFiles": pr["changed_files"], "fetchedFiles": len(files), "pages": pages,
            "filesComplete": files_complete, "patchesNeedingContext": gaps,
            "notes": ([] if files_complete else ["File list is incomplete; GitHub returns at most 3000 files."])
            + (["Missing/incomplete patches need full files or Git diff before conclusions."] if gaps else []),
        },
        "files": mapped,
    }
    context_file = destination / "context.json"
    context_file.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"contextFile": str(context_file), "headSha": head_sha, "coverage": snapshot["coverage"]}


def load_context(path: str) -> dict:
    context = json.loads(Path(path).read_text(encoding="utf-8"))
    if context.get("schemaVersion") != 1:
        raise ReviewError("Unsupported context format; fetch a new snapshot.")
    return context


def fetch_file(api: GitHub, context: dict, side: str, path: str, out: str) -> dict:
    pr = context["pr"]
    repo = validate_repo(pr["headRepo"] if side == "head" else pr["repo"])
    sha = validate_sha(pr[{"head": "headSha", "base": "baseSha", "before": "mergeBaseSha"}[side]])
    if side == "before":
        for file in context["files"]:
            if file["path"] == path:
                path = file.get("previousPath") or path
                break
    if not path or path.startswith("/") or any(part in ("", ".", "..") for part in path.split("/")):
        raise ReviewError("Use a repository-relative file path without dot segments.")
    destination = Path(out).resolve()
    if destination.exists():
        raise ReviewError("Output file already exists; choose a new path.")
    encoded = quote(path, safe="/")
    endpoint = f"repos/{repo}/contents/{encoded}?ref={sha}"
    metadata = api.read(endpoint)
    if not isinstance(metadata, dict) or metadata.get("type") != "file" or metadata.get("submodule_git_url"):
        raise ReviewError("Path is not a regular file; inspect directories, symlinks or submodules separately.")
    if metadata.get("encoding") == "base64":
        data = base64.b64decode(metadata["content"])
    elif metadata.get("encoding") == "none":
        data = api.read(endpoint, raw=True)
    else:
        raise ReviewError("GitHub did not return readable file content.")
    try:
        content = data.decode("utf-8")
    except UnicodeDecodeError:
        raise ReviewError("File is not UTF-8 text; inspect it with a suitable tool and record coverage.") from None
    if "\x00" in content:
        raise ReviewError("File contains binary data; inspect it separately and record coverage.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return {"path": path, "repo": repo, "sha": sha, "localFile": str(destination),
            "sourceUrl": f"https://github.com/{repo}/blob/{sha}/{encoded}"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    fetch = commands.add_parser("fetch", help="Save PR metadata and every available file patch.")
    fetch.add_argument("pr_url")
    fetch.add_argument("--out", help="Fresh output directory; defaults to a temporary directory.")
    file = commands.add_parser("file", help="Read a text file at a pinned commit.")
    file.add_argument("--context", required=True)
    file.add_argument("--side", choices=("head", "before", "base"), default="head")
    file.add_argument("--path", required=True)
    file.add_argument("--out", required=True)
    check = commands.add_parser("check", help="Check whether PR base/head still match the snapshot.")
    check.add_argument("--context", required=True)
    args = parser.parse_args()
    try:
        # Validate input before probing authentication or sending requests.
        if args.command == "fetch":
            parse_pr_url(args.pr_url)
            context = None
        else:
            context = load_context(args.context)
        api = GitHub()
        if args.command == "fetch":
            result = fetch_snapshot(api, args.pr_url, args.out)
        elif args.command == "file":
            result = fetch_file(api, context, args.side, args.path, args.out)
        else:
            repo, number = parse_pr_url(context["pr"]["url"])
            current = api.read(f"repos/{repo}/pulls/{number}")
            fresh = version(current) == (context["pr"]["baseSha"], context["pr"]["headSha"])
            result = {"status": "unchanged" if fresh else "changed",
                      "reviewedHeadSha": context["pr"]["headSha"], "currentHeadSha": current["head"]["sha"]}
            print(json.dumps(result, ensure_ascii=False))
            return 0 if fresh else 1
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except (ReviewError, OSError, ValueError, KeyError, TypeError, subprocess.TimeoutExpired) as exc:
        message = str(exc) if isinstance(exc, ReviewError) else "Invalid data, local I/O failure or request timeout; check inputs and connectivity."
        print(json.dumps({"error": message}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
