import httpx
import json

print("=" * 60)
print("VIMEO AUDIT")
print("=" * 60)

c = httpx.Client(timeout=15, follow_redirects=True)

# GraphQL introspection
print("\n--- GraphQL ---")
q = '{"query":"{ __schema { queryType { name } mutationType { name } types { name kind } } }"}'
try:
    r = c.post("https://vimeo.com/graphql", content=q, headers={"Content-Type": "application/json"})
    print(f"Status: {r.status_code}")
    d = r.json()
    if d.get("data") and d["data"].get("__schema"):
        s = d["data"]["__schema"]
        print(f"Query: {s.get('queryType',{}).get('name')}")
        print(f"Mutation: {s.get('mutationType',{}).get('name')}")
        ts = [t["name"] for t in s.get("types",[]) if not t["name"].startswith("__")]
        print(f"Types: {ts[:15]}")
    elif "errors" in d:
        print(f"Blocked: {str(d['errors'])[:200]}")
except Exception as e:
    print(f"Error: {e}")

# API discovery
print("\n--- API ---")
paths = ["/api/v2/config", "/api/v2/hello", "/api/docs", "/oembed", "/player_config"]
for p in paths:
    try:
        r = c.get(f"https://vimeo.com{p}")
        ct = r.headers.get("content-type", "")
        print(f"  {p} -> {r.status_code} CT:{ct[:30]} ({len(r.text)}b)")
    except:
        pass

# CORS
print("\n--- CORS ---")
for o in ["https://evil.com", "null"]:
    try:
        r = c.get("https://vimeo.com", headers={"Origin": o})
        a = r.headers.get("access-control-allow-origin", "")
        if a:
            print(f"  Origin={o} ACAO={a} ACAC={r.headers.get('access-control-allow-credentials','')}")
    except:
        pass

# Video IDOR
print("\n--- Video IDOR ---")
for vid in ["1", "2", "100", "123456789"]:
    try:
        r = c.get(f"https://vimeo.com/api/v2/video/{vid}.json")
        if r.status_code == 200:
            d = r.json()
            v = d.get("video", {})
            print(f"  Video {vid}: {v.get('title','N/A')[:50]} user:{v.get('user',{}).get('name','N/A')}")
    except:
        pass
