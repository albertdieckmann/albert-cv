from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen

NEWS_URL = "https://www.roskilde-festival.dk/nyheder"
OUTPUT_PATH = Path(__file__).resolve().parents[2] / "output" / "rf_news.json"
USER_AGENT = "RoskildeWebsiteExplorer/0.2 (+local research project)"


def fetch_html(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=20) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def extract_next_data(html: str) -> dict:
    match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
    if not match:
        raise ValueError("Kunne ikke finde __NEXT_DATA__")
    return json.loads(match.group(1))


def post_to_api(articles: list, api_url: str, secret: str) -> None:
    data = json.dumps(articles).encode("utf-8")
    request = Request(
        api_url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {secret}",
        },
        method="POST",
    )
    with urlopen(request, timeout=20) as response:
        result = json.loads(response.read())
        print(f"API svar: {result}")


def main() -> int:
    print("Henter nyheder fra roskilde-festival.dk...")
    html = fetch_html(NEWS_URL)
    next_data = extract_next_data(html)

    modules = next_data["props"]["pageProps"]["modules"]
    items = mod
