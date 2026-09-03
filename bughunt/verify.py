import httpx
import json

# Verify findings
print("=== Verifying Netlify .env ===")
r = httpx.get("https://app.netlify.com/.env", timeout=10)
ct = r.headers.get("content-type", "N/A")
print(f"Status: {r.status_code}, CT: {ct}, Len: {len(r.text)}")
if "DB_" in r.text or "SECRET" in r.text or "API_KEY" in r.text:
    print("REAL .env EXPOSED!")
    print(r.text[:500])
elif "<html" in r.text.lower() or "<!doctype" in r.text.lower():
    print("FALSE POSITIVE - SPA catch-all")
else:
    print(f"Preview: {r.text[:200]}")

print("\n=== Verifying GitLab .env ===")
r = httpx.get("https://gitlab.com/.env", timeout=10)
ct = r.headers.get("content-type", "N/A")
print(f"Status: {r.status_code}, CT: {ct}, Len: {len(r.text)}")
if "DB_" in r.text or "SECRET" in r.text or "API_KEY" in r.text:
    print("REAL .env EXPOSED!")
    print(r.text[:500])
elif "<html" in r.text.lower() or "<!doctype" in r.text.lower():
    print("FALSE POSITIVE - SPA catch-all")
else:
    print(f"Preview: {r.text[:200]}")

print("\n=== GitLab API Discovery ===")
endpoints = [
    "/api/v4/version",
    "/api/v4/metadata",
    "/api/v4/users",
    "/api/v4/projects",
    "/api/v4/groups",
    "/api/v4/search?scope=users",
    "/api/v4/templates/key",
    "/graphql",
]
for ep in endpoints:
    try:
        r = httpx.get(f"https://gitlab.com{ep}", timeout=8)
        print(f"  {ep} -> {r.status_code} ({len(r.text)} bytes)")
        if r.status_code == 200 and len(r.text) > 50:
            try:
                d = r.json()
                if isinstance(d, list):
                    print(f"    Returns list of {len(d)} items")
                elif isinstance(d, dict):
                    print(f"    Keys: {list(d.keys())[:5]}")
            except:
                pass
    except:
        pass

print("\n=== Netlify API Discovery ===")
endpoints = [
    "/api/v1/sites",
    "/api/v1/accounts",
    "/api/v1/dns_zones",
    "/api/v1/packages",
]
for ep in endpoints:
    try:
        r = httpx.get(f"https://app.netlify.com{ep}", timeout=8)
        print(f"  {ep} -> {r.status_code} ({len(r.text)} bytes)")
    except:
        pass

print("\n=== Check Basecamp Status Page ===")
r = httpx.get("https://basecamp.com/status", timeout=10)
print(f"Status: {r.status_code}, Len: {len(r.text)}")
# Look for API endpoints in status page
import re
apis = re.findall(r'https?://[^"\s]+api[^"\s]*', r.text)
if apis:
    print(f"API URLs found: {apis[:5]}")

# Check for interesting headers
print("\n=== Interesting Headers ===")
targets = [
    ("GitLab", "https://gitlab.com"),
    ("Netlify", "https://app.netlify.com"),
    ("Basecamp", "https://basecamp.com"),
]
for name, url in targets:
    try:
        r = httpx.get(url, timeout=10)
        print(f"\n{name} ({url}):")
        for h in ["server", "x-powered-by", "x-request-id", "x-runtime", "x-version", "x-debug", "x-amz"]:
            val = r.headers.get(h, "")
            if val:
                print(f"  {h}: {val}")
    except:
        pass
