import httpx
import re

targets = [
    ("Vimeo", "https://vimeo.com"),
    ("Logitech", "https://www.logitech.com"),
    ("Namecheap", "https://www.namecheap.com"),
    ("Exodus Wallet", "https://www.exodus.com"),
    ("GoCardless", "https://www.gocardless.com"),
    ("FetLife", "https://fetlife.com"),
    ("NBA", "https://www.nba.com"),
]

for name, url in targets:
    print(f"\n=== {name} ({url}) ===")
    try:
        r = httpx.get(url, timeout=10, follow_redirects=True)
        print(f"  Status: {r.status_code}")
        srv = r.headers.get("server", "N/A")
        pwr = r.headers.get("x-powered-by", "N/A")
        print(f"  Server: {srv}")
        print(f"  X-Powered-By: {pwr}")
        
        # Missing headers
        missing = []
        for h in ["x-frame-options", "x-content-type-options", "strict-transport-security", "content-security-policy"]:
            if h not in r.headers:
                missing.append(h.upper())
        if missing:
            print(f"  Missing: {', '.join(missing)}")
        
        # Version in HTML
        versions = re.findall(r"(?:version|ver|v)[=:\s]*(\d+\.\d+[\.\d]*)", r.text[:10000], re.I)
        if versions:
            print(f"  Version in HTML: {versions[0]}")
            
        # Check API paths
        api_paths = ["/api", "/graphql", "/api/v1", "/api/v2", "/wp-json", "/api/docs", "/swagger"]
        for path in api_paths:
            try:
                r2 = httpx.get(url + path, timeout=5, follow_redirects=True)
                if r2.status_code == 200 and len(r2.text) > 100:
                    ct = r2.headers.get("content-type", "")
                    print(f"  [+] {path} -> {r2.status_code} CT:{ct[:30]} ({len(r2.text)} bytes)")
            except:
                pass
                
        # Check CORS
        for origin in ["https://evil.com", "null"]:
            try:
                r3 = httpx.get(url, headers={"Origin": origin}, timeout=5)
                acao = r3.headers.get("access-control-allow-origin", "")
                if acao == "*" or acao == origin:
                    print(f"  [!] CORS: ACAO={acao} (Origin: {origin})")
            except:
                pass
                
    except Exception as e:
        print(f"  Error: {e}")
