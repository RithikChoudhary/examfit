#!/usr/bin/env python3
import sys
import requests
import time

# Force output to be unbuffered
sys.stdout.reconfigure(line_buffering=True)

print("=== URL Testing Script ===", flush=True)

urls_to_test = [
    "https://www.gktoday.in/current-affairs/",
    "https://www.jagranjosh.com/current-affairs",
    "https://www.jagranjosh.com/current-affairs/daily-current-affairs",
    "https://www.affairscloud.com/current-affairs/",
    "https://httpbin.org/status/200"
]

session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
})

for i, url in enumerate(urls_to_test, 1):
    print(f"\n{i}. Testing: {url}", flush=True)
    try:
        response = session.get(url, timeout=10)
        print(f"   ✅ Status: {response.status_code}", flush=True)
        print(f"   📏 Content length: {len(response.content)} bytes", flush=True)
        
        if response.status_code == 200:
            print(f"   🎯 SUCCESS: URL is working", flush=True)
        else:
            print(f"   ⚠️  Non-200 status code", flush=True)
            
    except requests.exceptions.Timeout:
        print(f"   ❌ TIMEOUT: URL took too long to respond", flush=True)
    except requests.exceptions.ConnectionError:
        print(f"   ❌ CONNECTION ERROR: Could not connect", flush=True)
    except requests.exceptions.HTTPError as e:
        print(f"   ❌ HTTP ERROR: {e}", flush=True)
    except Exception as e:
        print(f"   ❌ ERROR: {e}", flush=True)
    
    time.sleep(1)  # Be respectful

print("\n=== Test Complete ===", flush=True)
