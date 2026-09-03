#!/usr/bin/env python3
"""
Quick Bug Hunter - Tests multiple targets for low-hanging fruit
"""

import httpx
import json
import sys

def test_target(name, base_url):
    print(f"\n{'='*60}")
    print(f"TARGET: {name} ({base_url})")
    print(f"{'='*60}")
    
    client = httpx.Client(
        timeout=10,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    )
    
    findings = []
    
    # 1. Check headers
    try:
        r = client.get(base_url)
        print(f"\n[+] Status: {r.status_code}")
        print(f"[+] Server: {r.headers.get('server', 'N/A')}")
        print(f"[+] X-Powered-By: {r.headers.get('x-powered-by', 'N/A')}")
        
        missing = []
        for h in ['x-frame-options', 'x-content-type-options', 'strict-transport-security', 'content-security-policy']:
            if h not in r.headers:
                missing.append(h.upper())
        if missing:
            print(f"[!] Missing headers: {', '.join(missing)}")
            findings.append(f"Missing security headers: {', '.join(missing)}")
    except Exception as e:
        print(f"[-] Error: {e}")
    
    # 2. Check CORS
    print(f"\n--- CORS Check ---")
    for origin in ["https://evil.com", "null"]:
        try:
            r = client.get(base_url, headers={"Origin": origin})
            acao = r.headers.get("access-control-allow-origin", "")
            if acao == "*" or acao == origin:
                print(f"[!] CORS Issue: ACAO={acao} with Origin={origin}")
                findings.append(f"CORS misconfiguration: ACAO reflects {origin}")
        except:
            pass
    
    # 3. Check common paths
    print(f"\n--- Path Discovery ---")
    paths = [
        "/robots.txt", "/sitemap.xml", "/.env", "/.git/HEAD",
        "/api", "/graphql", "/swagger", "/docs",
        "/admin", "/login", "/register",
        "/health", "/status", "/version", "/info",
        "/api/v1", "/api/v2", "/.well-known/security.txt",
    ]
    
    for path in paths:
        try:
            r = client.get(base_url + path)
            if r.status_code == 200:
                content_len = len(r.text)
                if content_len > 0:
                    print(f"[+] {path} -> {r.status_code} ({content_len} bytes)")
                    if path in ["/.env", "/.git/HEAD"]:
                        findings.append(f"Sensitive file exposed: {path}")
        except:
            pass
    
    # 4. Check API endpoints for IDOR patterns
    print(f"\n--- API Endpoint Check ---")
    api_paths = [
        "/api/users/me", "/api/user/me", "/api/account/me",
        "/api/profile", "/api/me",
    ]
    
    for path in api_paths:
        try:
            r = client.get(base_url + path)
            print(f"[+] {path} -> {r.status_code}")
            if r.status_code == 200:
                try:
                    data = r.json()
                    print(f"    Response: {json.dumps(data)[:200]}")
                except:
                    pass
        except:
            pass
    
    # 5. Check GraphQL introspection
    print(f"\n--- GraphQL Check ---")
    try:
        r = client.post(
            base_url + "/graphql",
            json={"query": "{ __schema { types { name } } }"}
        )
        if r.status_code == 200:
            data = r.json()
            if "data" in data and data["data"]:
                types = [t["name"] for t in data["data"]["__schema"]["types"][:10]]
                print(f"[!] GraphQL introspection enabled! Types: {types}")
                findings.append("GraphQL introspection enabled")
    except:
        pass
    
    # Summary
    print(f"\n{'='*60}")
    print(f"FINDINGS: {len(findings)}")
    for f in findings:
        print(f"  - {f}")
    print(f"{'='*60}")
    
    return findings

if __name__ == "__main__":
    targets = [
        ("Netlify", "https://app.netlify.com"),
        ("Basecamp", "https://basecamp.com"),
        ("Evernote", "https://evernote.com"),
        ("GitLab", "https://gitlab.com"),
    ]
    
    all_findings = []
    for name, url in targets:
        try:
            findings = test_target(name, url)
            all_findings.extend(findings)
        except Exception as e:
            print(f"Error testing {name}: {e}")
    
    print(f"\n\n{'='*60}")
    print(f"TOTAL FINDINGS: {len(all_findings)}")
    print(f"{'='*60}")
