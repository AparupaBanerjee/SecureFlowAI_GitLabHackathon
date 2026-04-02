#!/usr/bin/env python3
"""
Security & validation summary for SecureFlow Vault.

Parses all GitLab security scan artifacts (SAST, Secret Detection, DAST,
API Security) plus unit-test and E2E JUnit XMLs and Cobertura coverage reports,
then posts (or idempotently updates) a structured markdown note on the MR.

GitLab Duo Code Review sees MR notes as context, so this bridges pipeline
outputs into the Duo review workflow without any native integration.

MR note auth: prefers GITLAB_TOKEN (project/personal access token with `api`
scope), falls back to CI_JOB_TOKEN (available automatically in every CI job).
"""
import json
import os
import glob
import xml.etree.ElementTree as ET
import urllib.request
import urllib.error

# Sentinel string used to find and idempotently update the note.
SENTINEL = "<!-- DUO-SECURITY-SUMMARY -->"

SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Info", "Unknown"]
SEV_EMOJI = {
    "Critical": "🔴",
    "High":     "🟠",
    "Medium":   "🟡",
    "Low":      "🔵",
    "Info":     "⚪",
    "Unknown":  "⚫",
}

SCAN_REPORT_FILES = [
    "gl-sast-report.json",
    "gl-secret-detection-report.json",
    "gl-dependency-scanning-report.json",
    "gl-dast-report.json",
    "gl-api-security-report.json",
    "gl-container-scanning-report-backend.json",
    "gl-container-scanning-report-frontend.json",
]

SCAN_LABELS = {
    "sast":                "SAST (Static Analysis)",
    "secret_detection":    "Secret Detection",
    "dependency_scanning": "Dependency Scanning",
    "container_scanning":  "Container Scanning (Trivy CVE)",
    "dast":                "DAST (Dynamic / Runtime)",
    "api_security":        "API Security",
}

DOCKLE_LEVEL_ORDER = ["FATAL", "WARN", "INFO"]
DOCKLE_LEVEL_EMOJI = {"FATAL": "🔴", "WARN": "🟠", "INFO": "⚪"}

NPM_SEV_MAP = {
    "critical": "Critical",
    "high":     "High",
    "moderate": "Medium",
    "low":      "Low",
    "info":     "Info",
}

# ── Security findings ────────────────────────────────────────────────────────

findings = []

for pattern in SCAN_REPORT_FILES:
    for path in glob.glob(f"**/{pattern}", recursive=True):
        try:
            with open(path) as fh:
                data = json.load(fh)
            scanner   = data.get("scan", {}).get("scanner", {}).get("name", "unknown")
            scan_type = data.get("scan", {}).get("type", "unknown")
            for v in data.get("vulnerabilities", []):
                loc = v.get("location", {})
                if loc.get("file"):
                    location = loc["file"]
                    line     = loc.get("start_line", "")
                elif loc.get("path"):
                    method   = loc.get("method", "")
                    location = f"{method} {loc['path']}" if method else loc["path"]
                    line     = ""
                else:
                    location = "?"
                    line     = ""
                identifiers = v.get("identifiers", [])
                cve = identifiers[0].get("value", "") if identifiers else ""
                findings.append({
                    "scanner":   scanner,
                    "scan_type": scan_type,
                    "severity":  v.get("severity", "Unknown"),
                    "name":      v.get("name", "Unknown"),
                    "cve":       cve,
                    "location":  location,
                    "line":      str(line),
                    "description": (v.get("description") or "")[:200],
                })
        except Exception as e:
            print(f"[security-summary] Could not parse {path}: {e}")

# ── Dockle CIS best-practices ────────────────────────────────────────────────

def parse_dockle(path: str) -> list[dict]:
    items = []
    try:
        with open(path) as fh:
            data = json.load(fh)
        for detail in data.get("details", []):
            level = detail.get("level", "INFO")
            if level in ("SKIP", "PASS"):
                continue
            items.append({
                "code":   detail.get("code", ""),
                "title":  detail.get("title", ""),
                "level":  level,
                "alerts": detail.get("alerts", []),
            })
    except Exception as e:
        print(f"[security-summary] Could not parse {path}: {e}")
    return items

dockle_backend  = parse_dockle("dockle-backend.json")
dockle_frontend = parse_dockle("dockle-frontend.json")

# ── npm audit ────────────────────────────────────────────────────────────────

def parse_npm_audit(path: str) -> list[dict]:
    items = []
    try:
        with open(path) as fh:
            data = json.load(fh)
        for pkg_name, vuln in data.get("vulnerabilities", {}).items():
            severity = NPM_SEV_MAP.get(vuln.get("severity", ""), "Unknown")
            titles = [
                via["title"]
                for via in vuln.get("via", [])
                if isinstance(via, dict) and via.get("title")
            ]
            items.append({
                "name":          pkg_name,
                "severity":      severity,
                "title":         titles[0] if titles else "(transitive)",
                "is_direct":     vuln.get("isDirect", False),
                "fix_available": bool(vuln.get("fixAvailable", False)),
            })
    except Exception as e:
        print(f"[security-summary] Could not parse {path}: {e}")
    return items

npm_audit_backend  = parse_npm_audit("audit-backend.json")
npm_audit_frontend = parse_npm_audit("audit-frontend.json")

# ── Unit / E2E test results (JUnit XML) ──────────────────────────────────────

def parse_junit(pattern: str) -> dict:
    totals = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
    for path in glob.glob(pattern, recursive=True):
        try:
            root = ET.parse(path).getroot()
            suites = [root] if root.tag == "testsuite" else root.findall(".//testsuite")
            for s in suites:
                totals["tests"]    += int(s.get("tests",    0))
                totals["failures"] += int(s.get("failures", 0))
                totals["errors"]   += int(s.get("errors",   0))
                totals["skipped"]  += int(s.get("skipped",  0))
        except Exception as e:
            print(f"[security-summary] Could not parse {path}: {e}")
    return totals

backend_tests  = parse_junit("backend/junit.xml")
frontend_tests = parse_junit("frontend/junit*.xml")
e2e_tests      = parse_junit("e2e/results.xml")

# ── Coverage (Cobertura XML) ──────────────────────────────────────────────────

def parse_cobertura(pattern: str) -> tuple[float | None, float | None]:
    for path in glob.glob(pattern, recursive=True):
        try:
            root = ET.parse(path).getroot()
            line_rate   = round(float(root.get("line-rate",   0)) * 100, 1)
            branch_rate = round(float(root.get("branch-rate", 0)) * 100, 1)
            return line_rate, branch_rate
        except Exception:
            pass
    return None, None

backend_line_cov, backend_branch_cov   = parse_cobertura("backend/coverage/cobertura-coverage.xml")
frontend_line_cov, frontend_branch_cov = parse_cobertura("frontend/coverage/cobertura-coverage.xml")

# ── Markdown note builder ─────────────────────────────────────────────────────

def sev_sort_key(item: dict) -> int:
    sev = item.get("severity", "Unknown")
    return SEVERITY_ORDER.index(sev) if sev in SEVERITY_ORDER else 99


def cov_cell(line: float | None, branch: float | None = None) -> str:
    if line is None:
        return "—"
    s = f"lines {line}%"
    if branch is not None:
        s += f" · branches {branch}%"
    return s


def pass_count(r: dict) -> int:
    return r["tests"] - r["failures"] - r["errors"] - r["skipped"]


def build_note() -> str:
    pipeline_id  = os.environ.get("CI_PIPELINE_ID",  "local")
    pipeline_url = os.environ.get("CI_PIPELINE_URL", "")
    commit_sha   = os.environ.get("CI_COMMIT_SHORT_SHA", "")

    md: list[str] = [
        SENTINEL,
        "",
        "## :shield: Security & validation Pipeline Summary",
        f"*Pipeline [`#{pipeline_id}`]({pipeline_url}) &nbsp;·&nbsp; commit `{commit_sha}`*",
        "",
    ]

    # ── Test results table ───────────────────────────────────────────────────
    md += [
        "### E2E(core functionality),Unit Test Results & Coverage",
        "",
        "| Suite | Tests | :white_check_mark: Pass | :x: Fail | Coverage |",
        "|-------|------:|------:|-----:|----------|",
    ]

    def test_row(label: str, r: dict, line_cov, branch_cov) -> str | None:
        if r["tests"] == 0:
            return None
        passed = pass_count(r)
        failed = r["failures"] + r["errors"]
        icon   = ":white_check_mark:" if failed == 0 else ":x:"
        cov    = cov_cell(line_cov, branch_cov)
        return f"| {icon} {label} | {r['tests']} | {passed} | {failed} | {cov} |"

    for row in [
        test_row("Backend unit (Jest)",    backend_tests,  backend_line_cov,  backend_branch_cov),
        test_row("Frontend unit (Vitest)", frontend_tests, frontend_line_cov, frontend_branch_cov),
        test_row("E2E (Playwright)",       e2e_tests,      None, None),
    ]:
        if row:
            md.append(row)

    all_empty = all(
        r["tests"] == 0
        for r in [backend_tests, frontend_tests, e2e_tests]
    )
    if all_empty:
        md.append("| ⚪ No JUnit results found | — | — | — | — |")

    md.append("")

    # ── Security findings ────────────────────────────────────────────────────
    md.append("### Security Findings")
    md.append("")

    if not findings:
        md.append(":white_check_mark: No security findings detected across all scanners.")
        md.append("")
    else:
        by_sev: dict[str, list] = {}
        for f in findings:
            by_sev.setdefault(f["severity"], []).append(f)

        severity_summary = " &nbsp;·&nbsp; ".join(
            f"{SEV_EMOJI[s]} {s}: **{len(by_sev[s])}**"
            for s in SEVERITY_ORDER
            if s in by_sev
        )
        md.append(f"**{len(findings)} total** &nbsp;— {severity_summary}")
        md.append("")

        by_type: dict[str, list] = {}
        for f in findings:
            by_type.setdefault(f["scan_type"], []).append(f)

        for scan_type in ["secret_detection", "sast", "dependency_scanning", "container_scanning", "dast", "api_security"]:
            items = by_type.get(scan_type, [])
            if not items:
                continue
            label   = SCAN_LABELS.get(scan_type, scan_type)
            crit_hi = sum(1 for i in items if i["severity"] in ("Critical", "High"))
            badge   = f" ⚠️ {crit_hi} Critical/High" if crit_hi else ""
            md.append("<details>")
            md.append(f"<summary><strong>{label}</strong> — {len(items)} finding(s){badge}</summary>")
            md.append("")
            md.append("| Severity | Finding | Location | Scanner |")
            md.append("|----------|---------|----------|---------|")
            for item in sorted(items, key=sev_sort_key):
                emoji = SEV_EMOJI.get(item["severity"], "⚫")
                sev   = f"{emoji} {item['severity']}"
                name  = item["name"]
                loc   = item["location"]
                line  = f":{item['line']}" if item.get("line") else ""
                loc_s = f"`{loc}{line}`" if loc != "?" else "—"
                md.append(f"| {sev} | {name} | {loc_s} | {item['scanner']} |")
            md.append("")
            md.append("</details>")
            md.append("")

    # ── npm Audit ────────────────────────────────────────────────────────────
    md.append("### npm Audit")
    md.append("")

    for img_label, items in [("Backend", npm_audit_backend), ("Frontend", npm_audit_frontend)]:
        if not items:
            md.append(f":white_check_mark: **{img_label}** — No npm audit vulnerabilities.")
            md.append("")
            continue
        crit_hi = sum(1 for i in items if i["severity"] in ("Critical", "High"))
        badge   = f" ⚠️ {crit_hi} Critical/High" if crit_hi else ""
        md.append("<details>")
        md.append(f"<summary><strong>{img_label}</strong> — {len(items)} vulnerable package(s){badge}</summary>")
        md.append("")
        md.append("| Severity | Package | Advisory | Fix Available |")
        md.append("|----------|---------|----------|:-------------:|")
        for item in sorted(items, key=sev_sort_key):
            emoji = SEV_EMOJI.get(item["severity"], "⚫")
            fix   = ":white_check_mark:" if item["fix_available"] else ":x:"
            md.append(f"| {emoji} {item['severity']} | `{item['name']}` | {item['title']} | {fix} |")
        md.append("")
        md.append("</details>")
        md.append("")

    # ── Container Best Practices (Dockle CIS) ────────────────────────────────
    md.append("### Container Best Practices (CIS Benchmark)")
    md.append("")

    for img_label, items in [("Backend", dockle_backend), ("Frontend", dockle_frontend)]:
        if not items:
            md.append(f":white_check_mark: **{img_label}** — No CIS issues found.")
            md.append("")
            continue
        fatal = sum(1 for i in items if i["level"] == "FATAL")
        warn  = sum(1 for i in items if i["level"] == "WARN")
        parts = []
        if fatal:
            parts.append(f"⚠️ {fatal} Fatal")
        if warn:
            parts.append(f"🟠 {warn} Warn")
        badge = " &nbsp;·&nbsp; ".join(parts)
        md.append("<details>")
        md.append(f"<summary><strong>{img_label}</strong> — {len(items)} check(s) failed &nbsp; {badge}</summary>")
        md.append("")
        md.append("| Level | Code | Title | Detail |")
        md.append("|-------|------|-------|--------|")
        for item in sorted(items, key=lambda x: DOCKLE_LEVEL_ORDER.index(x["level"]) if x["level"] in DOCKLE_LEVEL_ORDER else 99):
            emoji     = DOCKLE_LEVEL_EMOJI.get(item["level"], "⚫")
            alerts_str = "; ".join(item["alerts"])[:120]
            md.append(f"| {emoji} {item['level']} | `{item['code']}` | {item['title']} | {alerts_str} |")
        md.append("")
        md.append("</details>")
        md.append("")

    md += [
        "---",
        "_Auto-posted by `.ci/security-summary.py` — updates on every pipeline run._",
    ]

    return "\n".join(md)

# ── Print to pipeline log ────────────────────────────────────────────────────

note_body = build_note()
print(note_body)

# ── Post / update MR note via GitLab API ─────────────────────────────────────
# Supports two auth methods:
#   1. GITLAB_TOKEN  — project/personal access token with `api` scope (preferred)
#   2. CI_JOB_TOKEN  — automatically available in every CI job (limited write access)
#
# To enable MR note posting, add a masked CI/CD variable named GITLAB_TOKEN
# with a project access token (Settings > Access Tokens > role: Reporter, scope: api).

gitlab_url = os.environ.get("CI_SERVER_URL", "https://gitlab.com")
project_id = os.environ.get("CI_PROJECT_ID", "")
mr_iid     = os.environ.get("CI_MERGE_REQUEST_IID", "")

gitlab_token = os.environ.get("GITLAB_TOKEN", "")
job_token    = os.environ.get("CI_JOB_TOKEN", "")

if not project_id or not mr_iid:
    print("\n[security-summary] Not an MR pipeline — skipping MR note post.")
    raise SystemExit(0)

if not gitlab_token and not job_token:
    print("\n[security-summary] No auth token available — skipping MR note post.")
    raise SystemExit(0)

# Build auth headers — prefer GITLAB_TOKEN (broader write permissions)
if gitlab_token:
    auth_headers = {"PRIVATE-TOKEN": gitlab_token}
else:
    auth_headers = {"JOB-TOKEN": job_token}

base_url = f"{gitlab_url}/api/v4/projects/{project_id}/merge_requests/{mr_iid}/notes"
common_headers = {"Content-Type": "application/json", **auth_headers}


def api(method: str, url: str, data: dict | None = None) -> dict | list | None:
    body = json.dumps(data).encode() if data else None
    req  = urllib.request.Request(url, data=body, headers=common_headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        print(f"[security-summary] API {method} {url} → HTTP {e.code}: {e.read().decode()[:300]}")
        return None


# Find an existing sentinel note (paginate through all notes)
existing_note_id: int | None = None
page = 1
while True:
    notes = api("GET", f"{base_url}?per_page=100&page={page}")
    if not notes or not isinstance(notes, list):
        break
    for note in notes:
        if SENTINEL in (note.get("body") or ""):
            existing_note_id = note["id"]
            break
    if existing_note_id or len(notes) < 100:
        break
    page += 1

# Update existing note or create a new one
if existing_note_id:
    result = api("PUT", f"{base_url}/{existing_note_id}", {"body": note_body})
    if result:
        print(f"\n[security-summary] ✅ Updated MR note #{existing_note_id}")
else:
    result = api("POST", base_url, {"body": note_body})
    if result and isinstance(result, dict):
        print(f"\n[security-summary] ✅ Posted new MR note #{result.get('id')}")

# ── Trigger GitLab Duo Code Review via @GitLabDuo mention ─────────────────────
# Only trigger when there are security findings worth reviewing.
DUO_SENTINEL = "<!-- DUO-REVIEW-TRIGGER -->"

# Check if we already posted the Duo trigger note
duo_note_exists = False
page = 1
while True:
    notes = api("GET", f"{base_url}?per_page=100&page={page}")
    if not notes or not isinstance(notes, list):
        break
    for note in notes:
        if DUO_SENTINEL in (note.get("body") or ""):
            duo_note_exists = True
            break
    if duo_note_exists or len(notes) < 100:
        break
    page += 1

if findings and not duo_note_exists:
    duo_body = (
        f"{DUO_SENTINEL}\n"
        "@GitLabDuo Please review this MR. "
        "The pipeline security summary above contains "
        f"**{len(findings)} security finding(s)**. "
        "Cross-reference those findings with the code changes in this diff."
    )
    duo_result = api("POST", base_url, {"body": duo_body})
    if duo_result and isinstance(duo_result, dict):
        print(f"\n[security-summary] ✅ Triggered Duo Code Review via note #{duo_result.get('id')}")
elif not findings:
    print("\n[security-summary] No security findings — skipping Duo review trigger.")
else:
    print("\n[security-summary] Duo review trigger already posted — skipping.")
