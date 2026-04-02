#!/usr/bin/env python3
"""
DAST API Security overrides command.
Mints a JWT Bearer token by calling POST /api/auth/login
and writes the overrides JSON file consumed by the scanner.

Runs inside the API-Security analyzer (Alpine Linux + Python 3).
Uses only stdlib (urllib) — no pip packages needed.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

TARGET_URL = os.environ.get("APISEC_TARGET_URL", "")
USERNAME = os.environ.get("DAST_AUTH_USERNAME", "alice@example.com")
PASSWORD = os.environ.get("DAST_AUTH_PASSWORD", "Alice1234!")
OVERRIDES_FILE = os.environ.get("APISEC_OVERRIDES_FILE", "dast-api-overrides.json")
WORKING_DIR = os.environ.get("CI_PROJECT_DIR", ".")

overrides_path = os.path.join(WORKING_DIR, OVERRIDES_FILE)
login_url = f"{TARGET_URL.rstrip('/')}/api/auth/login"


def mint_token():
    """Call the login endpoint and return the JWT token."""
    payload = json.dumps({"email": USERNAME, "password": PASSWORD}).encode("utf-8")
    req = urllib.request.Request(
        login_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    return body.get("token", "")


def write_overrides(token):
    """Write the overrides JSON that the scanner injects into every request."""
    data = {"headers": {"Authorization": f"Bearer {token}"}}
    with open(overrides_path, "w") as f:
        json.dump(data, f)
    print(f"[auth] Overrides written to {overrides_path}")


# Retry loop — Render may still be deploying
MAX_ATTEMPTS = 30
for attempt in range(1, MAX_ATTEMPTS + 1):
    try:
        token = mint_token()
        if token:
            print(f"[auth] Token obtained ({len(token)} chars) on attempt {attempt}")
            write_overrides(token)
            sys.exit(0)
        else:
            print(f"[auth] Attempt {attempt}/{MAX_ATTEMPTS}: login succeeded but no token in response")
    except urllib.error.URLError as e:
        print(f"[auth] Attempt {attempt}/{MAX_ATTEMPTS}: {e}")
    except Exception as e:
        print(f"[auth] Attempt {attempt}/{MAX_ATTEMPTS}: unexpected error: {e}")

    time.sleep(10)

# If we get here, write empty overrides so the scanner still runs (unauthenticated)
print("[auth] WARNING: Could not obtain token. Authenticated endpoints will return 401.")
write_overrides("")
