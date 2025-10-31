import asyncio
import json
import logging
import os
import subprocess
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import re

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import requests
from bs4 import BeautifulSoup

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection management
ws_connections: dict[str, WebSocket] = {}


# Note: Process cleanup moved to cursor_server.py since this server doesn't manage cursor processes


# Note: Cursor Agent endpoints (/api/chat/create and /ws) have been moved to cursor_server.py
# to allow the cursor agent server to run without auto-reload, preserving cursor agent processes


def detect_language(text: str) -> str:
    """Simple language detection - check if text contains mostly English characters"""
    if not text:
        return "unknown"
    # Count English vs non-English characters
    english_chars = len(re.findall(r'[a-zA-Z]', text))
    total_chars = len(re.findall(r'[a-zA-Z\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]', text))
    if total_chars == 0:
        return "unknown"
    ratio = english_chars / total_chars
    return "en" if ratio > 0.7 else "non-en"


def extract_article_content(url: str) -> Dict[str, str]:
    """Extract article content from a given URL"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Try to find article title
        title = ""
        title_selectors = ['h1', 'title', '.title', '.post-title', '.article-title', '[class*="title"]']
        for selector in title_selectors:
            title_elem = soup.select_one(selector)
            if title_elem:
                title = title_elem.get_text(strip=True)
                if title:
                    break
        
        # Try to find article content
        content = ""
        content_selectors = [
            'article',
            '.article-content',
            '.post-content',
            '.content',
            '[class*="article"]',
            '[class*="post"]',
            'main',
            '.entry-content'
        ]
        
        for selector in content_selectors:
            content_elem = soup.select_one(selector)
            if content_elem:
                # Remove script and style elements
                for script in content_elem(["script", "style", "nav", "header", "footer"]):
                    script.decompose()
                content = content_elem.get_text(separator='\n', strip=True)
                if len(content) > 100:  # Ensure we have substantial content
                    break
        
        # If no specific content area found, try to get body text
        if not content:
            body = soup.find('body')
            if body:
                for script in body(["script", "style", "nav", "header", "footer"]):
                    script.decompose()
                content = body.get_text(separator='\n', strip=True)
        
        # Clean up content - remove excessive whitespace
        content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)
        content = content[:5000]  # Limit content length
        
        return {
            "title": title or "Untitled",
            "content": content or "Content not available",
            "url": url
        }
    except Exception as e:
        logger.error(f"Error extracting content from {url}: {e}")
        return {
            "title": "Error loading article",
            "content": f"Failed to load article: {str(e)}",
            "url": url
        }


def find_articles_from_yage() -> List[Dict[str, str]]:
    """Scrape yage.ai and find the first 5 English articles"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        url = "https://yage.ai"
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        articles = []
        seen_urls = set()
        
        # Common patterns for article links
        link_selectors = [
            'a[href*="/article"]',
            'a[href*="/post"]',
            'a[href*="/blog"]',
            'a[href*="/entry"]',
            'article a',
            '.article-link',
            '.post-link',
            '[class*="article"] a',
            '[class*="post"] a',
            '[class*="blog"] a'
        ]
        
        all_links = []
        for selector in link_selectors:
            links = soup.select(selector)
            for link in links:
                href = link.get('href', '')
                if not href:
                    continue
                
                # Make absolute URL if relative
                if href.startswith('/'):
                    href = url.rstrip('/') + href
                elif not href.startswith('http'):
                    continue
                
                # Get link text
                link_text = link.get_text(strip=True)
                
                if href not in seen_urls and link_text:
                    seen_urls.add(href)
                    all_links.append({
                        'url': href,
                        'text': link_text,
                        'language': detect_language(link_text)
                    })
        
        # Filter for English articles
        english_links = [link for link in all_links if link['language'] == 'en']
        
        # If we don't have enough English links from link text, check page content
        if len(english_links) < 5:
            # Try to find all links and check their content
            all_page_links = soup.find_all('a', href=True)
            for link in all_page_links:
                if len(articles) >= 5:
                    break
                    
                href = link.get('href', '')
                if not href or href in seen_urls:
                    continue
                
                # Make absolute URL
                if href.startswith('/'):
                    href = url.rstrip('/') + href
                elif not href.startswith('http'):
                    continue
                
                # Skip if it's not likely an article URL
                if not any(word in href.lower() for word in ['article', 'post', 'blog', 'entry', 'news', 'story']):
                    # But still try if it's a different page (not the homepage)
                    if url in href and href != url:
                        pass  # Continue to check
                    else:
                        continue
                
                seen_urls.add(href)
                
                # Extract article content
                article_data = extract_article_content(href)
                
                # Check if content is in English
                sample_text = article_data['title'] + ' ' + article_data['content'][:200]
                if detect_language(sample_text) == 'en':
                    articles.append(article_data)
        
        # If still not enough, get top articles from homepage sections
        if len(articles) < 5:
            # Look for article elements directly
            article_elements = soup.find_all(['article', 'div'], class_=re.compile(r'article|post|blog|entry', re.I))
            
            for elem in article_elements[:10]:  # Check first 10
                if len(articles) >= 5:
                    break
                
                # Try to find a link within the article
                link = elem.find('a', href=True)
                if not link:
                    continue
                
                href = link.get('href', '')
                if href in seen_urls:
                    continue
                
                if href.startswith('/'):
                    href = url.rstrip('/') + href
                elif not href.startswith('http'):
                    continue
                
                seen_urls.add(href)
                
                article_data = extract_article_content(href)
                sample_text = article_data['title'] + ' ' + article_data['content'][:200]
                if detect_language(sample_text) == 'en':
                    articles.append(article_data)
        
        # Return first 5 articles
        return articles[:5]
        
    except Exception as e:
        logger.error(f"Error scraping yage.ai: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch articles: {str(e)}")


@app.get("/api/articles/yage")
async def get_yage_articles():
    """Fetch the first 5 English articles from yage.ai"""
    logger.info("Fetching articles from yage.ai")
    articles = find_articles_from_yage()
    return {"articles": articles, "count": len(articles)}


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "service": "Cursor Scaffold Backend"}


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 3001))
    uvicorn.run(app, host="0.0.0.0", port=port)

