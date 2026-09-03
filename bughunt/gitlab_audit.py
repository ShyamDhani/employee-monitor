import httpx
import json
import re

# GitLab public projects
print("=== GitLab Public Projects ===")
r = httpx.get("https://gitlab.com/api/v4/projects?per_page=5&order_by=last_activity_at", timeout=10)
if r.status_code == 200:
    projects = r.json()
    for p in projects[:3]:
        print(f"  ID: {p.get('id')}, Name: {p.get('name')}")
        print(f"  Path: {p.get('path_with_namespace')}")
        print(f"  Visibility: {p.get('visibility')}")
        for key in ["runners_token", "deploy_token", "build_token", "token"]:
            if p.get(key):
                print(f"  [!] {key} EXPOSED: {p[key][:20]}...")

# Check users
print("\n=== GitLab Users API ===")
r = httpx.get("https://gitlab.com/api/v4/users?per_page=3", timeout=10)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    for u in r.json()[:2]:
        print(f"  {u.get('username')} | {u.get('name')} | {u.get('state')}")

# IDOR on projects
print("\n=== IDOR Test: Project IDs ===")
for pid in [1, 2, 3, 100, 1000, 999999]:
    try:
        r = httpx.get(f"https://gitlab.com/api/v4/projects/{pid}", timeout=8)
        if r.status_code == 200:
            d = r.json()
            print(f"  Project {pid}: {d.get('name')} (vis: {d.get('visibility')})")
            for key in ["runners_token", "deploy_token", "build_token", "token"]:
                if d.get(key):
                    print(f"    [!] {key} EXPOSED!")
    except:
        pass

# Check version
print("\n=== GitLab Version ===")
r = httpx.get("https://gitlab.com/", timeout=10)
versions = re.findall(r"GitLab\s+(?:CE|EE)?\s*v?(\d+\.\d+[\.\d]*)", r.text)
if versions:
    print(f"  Version: {versions[0]}")
else:
    versions = re.findall(r'content="GitLab ([^"]+)"', r.text)
    if versions:
        print(f"  Version: {versions[0]}")
    else:
        print("  No version in HTML")

# Check for exposed admin endpoints
print("\n=== Admin/Debug Endpoints ===")
admin_paths = [
    "/admin", "/admin/dashboard", "/admin/projects",
    "/api/v4/admin", "/api/v4/application/settings",
    "/debug", "/metrics", "/-/health",
    "/api/v4/internal", "/api/v4/features",
]
for path in admin_paths:
    try:
        r = httpx.get(f"https://gitlab.com{path}", timeout=8)
        if r.status_code not in [404, 302]:
            print(f"  {path} -> {r.status_code} ({len(r.text)} bytes)")
    except:
        pass

# Check for open redirect
print("\n=== Open Redirect Test ===")
redirect_params = ["redirect_to", "return_to", "redirect", "next"]
for param in redirect_params:
    url = f"https://gitlab.com/users/sign_in?{param}=https://evil.com"
    try:
        r = httpx.get(url, follow_redirects=False, timeout=8)
        if r.status_code in [301, 302, 303, 307, 308]:
            loc = r.headers.get("location", "")
            if "evil.com" in loc:
                print(f"  [!] OPEN REDIRECT: {param} -> {loc}")
            else:
                print(f"  {param} -> redirect to {loc[:80]}")
    except:
        pass
