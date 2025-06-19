#!/usr/bin/env python3
import sys
import requests
from bs4 import BeautifulSoup

print("Testing scraper components...")

try:
    print("1. Testing requests...")
    response = requests.get('https://www.gktoday.in/current-affairs/', timeout=10)
    print(f"   Status code: {response.status_code}")
    print(f"   Content length: {len(response.content)}")
    
    print("2. Testing BeautifulSoup...")
    soup = BeautifulSoup(response.content, 'html.parser')
    print(f"   Parsed HTML successfully")
    
    print("3. Looking for article links...")
    links = soup.find_all('a', href=True)
    article_links = []
    for link in links:
        href = link.get('href', '')
        text = link.get_text().strip()
        if href and ('current-affairs' in href or '/202' in href) and href.startswith('https://www.gktoday.in/'):
            if len(text) > 10:
                article_links.append((href, text))
    
    print(f"   Found {len(article_links)} potential article links")
    for i, (url, title) in enumerate(article_links[:5]):
        print(f"   {i+1}. {title[:60]}...")
        print(f"      {url}")
    
    print("4. Testing one article...")
    if article_links:
        article_url, article_title = article_links[0]
        article_response = requests.get(article_url, timeout=10)
        print(f"   Article status: {article_response.status_code}")
        article_soup = BeautifulSoup(article_response.content, 'html.parser')
        paragraphs = article_soup.find_all('p')
        print(f"   Found {len(paragraphs)} paragraphs")
        if paragraphs:
            first_para = paragraphs[0].get_text().strip()
            print(f"   First paragraph: {first_para[:100]}...")
    
    print("✅ All tests passed!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
