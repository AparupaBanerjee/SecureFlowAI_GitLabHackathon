#!/usr/bin/env python3
"""
generate-release-notes.py — SecureFlow Vault

Creates a GitLab Release on every successful merge to the default branch.

What it does
------------
1. Collects every commit since the previous release tag (or the last 100
   commits when no previous tag exists).
2. Groups commits into human-friendly sections using conventional-commit
   prefixes (feat, fix, security, perf, refactor, chore, docs, test, ci).
3. Strips technical jargon and rewrites each line in plain English so that
   non-technical stakeholders can follow along.
4. Adds a one-paragraph "Overall Health" section derived from the JUnit XML
   test results left by earlier pipeline jobs (when available).
5. Calls the GitLab Releases API to create a tagged release.  The tag is
   auto-generated as  release-YYYY-MM-DD-<short_sha>  so every push to main
   produces an individually addressable release.

Auth
----
Set GITLAB_TOKEN (project or personal access token, "api" scope).
Falls back to CI_JOB_TOKEN for read operations, but that token cannot create
releases in all GitLab tiers — use GITLAB_TOKEN for reliable operation.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration from CI environment
# ---------------------------------------------------------------------------
GITLAB_URL  = os.getenv("CI_SERVER_URL",       "https://gitlab.com")
PROJECT_ID  = os.getenv("CI_PROJECT_ID",       "")
SHORT_SHA   = os.getenv("CI_COMMIT_SHORT_SHA", "")
BRANCH      = os.getenv("CI_COMMIT_BRANCH",    "main")
COMMIT_SHA  = os.getenv("CI_COMMIT_SHA",       "HEAD")
TOKEN       = os.getenv("GITLAB_TOKEN") or os.getenv("CI_JOB_TOKEN", "")

TODAY       = date.today().isoformat()                  # YYYY-MM-DD
TAG_NAME    = f"release-{TODAY}-{SHORT_SHA or 'local'}"
RELEASE_NAME = f"Release {TODAY}"

# ---------------------------------------------------------------------------
# Conventional-commit type → human-friendly section heading
# ---------------------------------------------------------------------------
TYPE_MAP: dict[str, str] = {
    "feat":     "✨ New Features",
    "feature":  "✨ New Features",
    "fix":      "🐛 Bug Fixes",
    "bugfix":   "🐛 Bug Fixes",
    "security": "🔒 Security Improvements",
    "sec":      "🔒 Security Improvements",
    "perf":     "⚡ Performance Improvements",
    "refactor": "🔧 Internal Improvements",
    "style":    "🔧 Internal Improvements",
    "chore":    "🔧 Internal Improvements",
    "docs":     "📖 Documentation Updates",
    "test":     "✅ Test Coverage",
    "ci":       "🚀 Pipeline & Infrastructure",
    "build":    "🚀 Pipeline & Infrastructure",
    "revert":   "↩️ Reverted Changes",
}

# Section display order
SECTION_ORDER = [
    "✨ New Features",
    "🔒 Security Improvements",
    "🐛 Bug Fixes",
    "⚡ Performance Improvements",
    "🔧 Internal Improvements",
    "📖 Documentation Updates",
    "✅ Test Coverage",
    "🚀 Pipeline & Infrastructure",
    "↩️ Reverted Changes",
    "📝 Other Changes",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout.strip()


def last_release_tag() -> str | None:
    """Return the most recent release-* tag reachable from HEAD, or None."""
    raw = run(["git", "tag", "--sort=-creatordate", "--merged", "HEAD"])
    for tag in raw.splitlines():
        if tag.startswith("release-"):
            return tag
    return None


def commits_since(ref: str | None) -> list[dict]:
    """Return list of {sha, subject, body} since *ref* (exclusive)."""
    if ref:
        rev_range = f"{ref}..HEAD"
    else:
        # No previous release tag — take last 100 commits
        rev_range = "HEAD~100..HEAD"

    fmt = "%H\x1f%s\x1f%b\x1e"
    raw = run(["git", "log", rev_range, f"--format={fmt}"])
    commits = []
    for entry in raw.split("\x1e"):
        entry = entry.strip()
        if not entry:
            continue
        parts = entry.split("\x1f", 2)
        commits.append({
            "sha":     parts[0].strip() if len(parts) > 0 else "",
            "subject": parts[1].strip() if len(parts) > 1 else "",
            "body":    parts[2].strip() if len(parts) > 2 else "",
        })
    return commits


def parse_type(subject: str) -> tuple[str, str]:
    """Return (section_heading, cleaned_message)."""
    # conventional commit: type(scope): message  or  type: message
    m = re.match(r"^(\w+)(?:\([^)]+\))?!?:\s*(.+)", subject)
    if m:
        ctype  = m.group(1).lower()
        msg    = m.group(2)
        heading = TYPE_MAP.get(ctype, "📝 Other Changes")
    else:
        msg     = subject
        heading = "📝 Other Changes"

    # Capitalise first letter, strip trailing period
    msg = msg[:1].upper() + msg[1:]
    msg = msg.rstrip(".")
    return heading, msg


def humanise(message: str) -> str:
    """
    Light rewrite pass: replace developer shorthand with friendlier phrasing.
    Keeps it short — one line per bullet.
    """
    replacements = [
        (r"\bapi\b",        "API",         0),
        (r"\bui\b",         "the interface", re.IGNORECASE),
        (r"\bdb\b",         "the database",  re.IGNORECASE),
        (r"\bjwt\b",        "authentication tokens", re.IGNORECASE),
        (r"\benv\b",        "environment",   re.IGNORECASE),
        (r"\bconfig\b",     "configuration", re.IGNORECASE),
        (r"\bdeps?\b",      "dependencies",  re.IGNORECASE),
        (r"\bnpm\b",        "package manager", re.IGNORECASE),
        (r"\btsc\b",        "type checker",  re.IGNORECASE),
    ]
    for pattern, repl, *flags in replacements:
        flag = flags[0] if flags else 0
        message = re.sub(pattern, repl, message, flags=flag)
    return message


# ---------------------------------------------------------------------------
# Test health summary (optional — reads JUnit XMLs if present)
# ---------------------------------------------------------------------------

def test_health_summary() -> str:
    """Parse JUnit XML artifacts and return a one-line health sentence."""
    xmls = list(Path(".").rglob("*.xml"))
    total_tests = passed = failed = errors = 0
    for path in xmls:
        try:
            tree = ET.parse(path)
            root = tree.getroot()
            suites = [root] if root.tag == "testsuite" else root.findall(".//testsuite")
            for ts in suites:
                t = int(ts.get("tests",   0))
                f = int(ts.get("failures", 0))
                e = int(ts.get("errors",   0))
                total_tests += t
                failed       += f
                errors        += e
                passed        += t - f - e
        except Exception:
            pass

    if total_tests == 0:
        return "Test results were not available for this release."

    if failed == 0 and errors == 0:
        return (
            f"All **{total_tests}** automated tests passed — "
            "the application is working as expected."
        )
    bad = failed + errors
    return (
        f"**{passed}** of **{total_tests}** automated tests passed. "
        f"{bad} test(s) need attention before the next release."
    )


# ---------------------------------------------------------------------------
# Markdown builder
# ---------------------------------------------------------------------------

def build_markdown(sections: dict[str, list[str]], prev_tag: str | None) -> str:
    now_utc = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    health  = test_health_summary()

    lines: list[str] = [
        f"# Release Notes — {RELEASE_NAME}",
        "",
        f"**Released on:** {now_utc}  ",
        f"**Commit:** `{SHORT_SHA or COMMIT_SHA[:8]}`  ",
        f"**Branch:** `{BRANCH}`",
        "",
        "---",
        "",
        "## What's in this release",
        "",
        "> This page summarises every change included in this release, written "
        "in plain language for everyone on the team — no technical background needed.",
        "",
    ]

    has_content = False
    for heading in SECTION_ORDER:
        items = sections.get(heading, [])
        if not items:
            continue
        has_content = True
        lines.append(f"### {heading}")
        lines.append("")
        for item in items:
            lines.append(f"- {item}")
        lines.append("")

    if not has_content:
        lines.append("_No noteworthy changes were recorded for this release._")
        lines.append("")

    lines += [
        "---",
        "",
        "## Overall Health",
        "",
        health,
        "",
    ]

    if prev_tag:
        compare_url = (
            f"{GITLAB_URL}/{os.getenv('CI_PROJECT_PATH', '')}/-/compare/{prev_tag}...{TAG_NAME}"
        )
        lines += [
            "---",
            "",
            f"[View full diff since {prev_tag}]({compare_url})",
            "",
        ]

    lines += [
        "---",
        "",
        "_Generated automatically by the SecureFlow CI pipeline._",
    ]

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# GitLab Releases API
# ---------------------------------------------------------------------------

def api_request(method: str, path: str, body: dict | None = None) -> dict:
    url  = f"{GITLAB_URL}/api/v4/projects/{PROJECT_ID}{path}"
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Content-Type":  "application/json",
            "PRIVATE-TOKEN": TOKEN,
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode(errors="replace")
        print(f"[release-notes] API {method} {url} → {exc.code}: {body_text}")
        raise


def create_gitlab_release(markdown: str) -> None:
    if not PROJECT_ID or not TOKEN:
        print("[release-notes] PROJECT_ID or TOKEN missing — skipping API call.")
        return

    payload = {
        "name":        RELEASE_NAME,
        "tag_name":    TAG_NAME,
        "ref":         COMMIT_SHA or BRANCH,
        "description": markdown,
        "released_at": datetime.now(timezone.utc).isoformat(),
    }
    print(f"[release-notes] Creating release '{RELEASE_NAME}' with tag '{TAG_NAME}' …")
    result = api_request("POST", "/releases", payload)
    tag    = result.get("tag_name", TAG_NAME)
    name   = result.get("name",     RELEASE_NAME)
    print(f"[release-notes] ✅ Release '{name}' created (tag: {tag})")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    prev_tag = last_release_tag()
    print(f"[release-notes] Previous release tag: {prev_tag or '(none)'}")

    commits = commits_since(prev_tag)
    print(f"[release-notes] {len(commits)} commit(s) to document")

    sections: dict[str, list[str]] = {}
    for c in commits:
        if not c["subject"]:
            continue
        heading, msg = parse_type(c["subject"])
        msg = humanise(msg)
        sections.setdefault(heading, []).append(msg)

    markdown = build_markdown(sections, prev_tag)

    # Always write artifact regardless of API success
    Path("RELEASE_NOTES.md").write_text(markdown, encoding="utf-8")
    print("[release-notes] Saved RELEASE_NOTES.md artifact")

    create_gitlab_release(markdown)


if __name__ == "__main__":
    main()
