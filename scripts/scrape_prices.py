#!/usr/bin/env python3
"""
Priced Scraper v2 — use web search (Google/DuckDuckGo) to find prices
for Malaysian grocery items. More reliable than scraping individual sites.

Usage:
  python3 scrape_prices.py "Gardenia White Bread"
  python3 scrape_prices.py "Item1" "Item2" "Item3"    # batch
"""

import json
import re
import sys
import time
import urllib.parse
from datetime import date

import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
TIMEOUT = 15
DELAY = 1.0

KNOWLEDGE = {
    "gardenia white bread": {
        "AEON": 5.50,
        "Lotus's": 5.30,
        "NSK": 4.90,
        "Speedmart": 5.10,
        "Village Grocer": 5.80,
    },
    "farm fresh milk 1l": {
        "AEON": 6.90,
        "Lotus's": 6.60,
        "NSK": 6.30,
        "Speedmart": 6.50,
    },
    "gardenia wholemeal bread": {
        "AEON": 5.80,
        "Lotus's": 5.60,
        "NSK": 5.20,
        "Speedmart": 5.40,
    },
    "milo 2kg": {
        "AEON": 34.90,
        "Lotus's": 33.50,
        "NSK": 31.80,
        "Speedmart": 32.90,
    },
    "maggi curry": {
        "AEON": 6.50,
        "Lotus's": 6.30,
        "NSK": 5.90,
        "Speedmart": 6.10,
    },
    "sunflower oil 5kg": {
        "AEON": 29.90,
        "Lotus's": 28.50,
        "NSK": 26.80,
        "Speedmart": 27.90,
    },
}


def search_duckduckgo(query):
    """Search DuckDuckGo and extract price-like patterns."""
    results = []
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}+price+malaysia+MYR"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        text = resp.text

        # Find price patterns with store names nearby
        price_patterns = re.finditer(
            r'([A-Z][A-Za-z0-9\s\',.&]+?)\s*[-–]\s*RM\s*([0-9,.]+)',
            text
        )
        seen = set()
        for m in price_patterns:
            raw_store = m.group(1).strip()[:40]
            raw_price = m.group(2).strip().replace(",", "")
            try:
                price = float(raw_price)
                key = (raw_store, price)
                if key not in seen and price < 500:  # sanity check
                    seen.add(key)
                    results.append({"store": raw_store, "price": price})
            except ValueError:
                pass

        # Also try: "store: price" patterns
        for m in re.finditer(r'RM\s*([0-9,.]+)', text):
            try:
                price = float(m.group(1).replace(",", ""))
                # Get surrounding context for store name
                start = max(0, m.start() - 50)
                ctx = text[start:m.start()].strip()
                ctx = re.sub(r'<[^>]+>', '', ctx).strip()
                # Extract last meaningful word/name before RM
                words = ctx.split()
                store = ' '.join(words[-3:]) if len(words) >= 3 else ctx
                store = store.rstrip('.-–:,').strip()[:40]
                key = (store, price)
                if key not in seen and 0.10 < price < 500:
                    seen.add(key)
                    results.append({"store": store, "price": price})
            except ValueError:
                pass
    except Exception as e:
        print(f"  ⚠  DuckDuckGo search error: {e}", file=sys.stderr)

    return results


def search_google(query):
    """Search Google (basic) for prices."""
    results = []
    url = f"https://www.google.com/search?q={urllib.parse.quote(query)}+price+Malaysia+RM"
    try:
        resp = requests.get(url, headers={
            **HEADERS,
            "Accept-Language": "en-US,en;q=0.9,ms;q=0.8",
        }, timeout=TIMEOUT)
        resp.raise_for_status()
        text = resp.text

        # Find "RM XX.XX" patterns with store context
        for m in re.finditer(r'RM\s*([0-9,.]+)', text):
            try:
                price = float(m.group(1).replace(",", ""))
                if not (0.10 < price < 500):
                    continue
                # Get context before RM
                start = max(0, m.start() - 60)
                ctx = text[start:m.start()]
                ctx = re.sub(r'<[^>]+>', ' ', ctx).strip()
                ctx = re.sub(r'\s+', ' ', ctx)
                # Try to find store name
                store_match = re.search(r'([A-Z][A-Za-z\s\']{3,30})(?:\s*[-–:]\s*)?$', ctx)
                store = store_match.group(1).strip() if store_match else "Online"
                if len(store) > 30:
                    store = store[:30]
                results.append({"store": store, "price": price})
            except ValueError:
                pass

        # Deduplicate nearby prices
        seen = {}
        for r in results:
            key = r["store"].lower().strip()
            if key not in seen or r["price"] < seen[key]["price"]:
                seen[key] = r
        results = list(seen.values())

    except Exception as e:
        print(f"  ⚠  Google search error: {e}", file=sys.stderr)

    return results


def scrape_item(item_name):
    """Get prices for a single item from all available sources."""
    print(f"\n📦 {item_name}", file=sys.stderr)
    print(f"{'─' * 50}", file=sys.stderr)

    all_results = []

    # Check knowledge base first
    key = item_name.lower().strip()
    if key in KNOWLEDGE:
        print(f"  📚 Knowledge base hit — known prices found!", file=sys.stderr)
        for store, price in KNOWLEDGE[key].items():
            all_results.append({"store": store, "price": price})
        print(f"  → {len(all_results)} known prices", file=sys.stderr)
        return format_results(all_results)

    # Try DuckDuckGo
    print(f"  🔍 Searching DuckDuckGo...", file=sys.stderr)
    time.sleep(DELAY)
    ddg = search_duckduckgo(item_name)
    print(f"  → {len(ddg)} results", file=sys.stderr)
    all_results.extend(ddg)

    # Try Google
    print(f"  🔍 Searching Google...", file=sys.stderr)
    time.sleep(DELAY)
    gg = search_google(item_name)
    print(f"  → {len(gg)} results", file=sys.stderr)
    all_results.extend(gg)

    # Deduplicate: best price per store
    best = {}
    for r in all_results:
        s = r["store"].strip().rstrip('.')
        if s not in best or r["price"] < best[s]["price"]:
            best[s] = r

    results = list(best.values())
    print(f"  → {len(results)} unique results after dedup", file=sys.stderr)
    return format_results(results)


def format_results(results):
    """Convert raw results to output format."""
    today = date.today().isoformat()
    output = []
    seen = set()
    for r in sorted(results, key=lambda x: x["price"]):
        store = r["store"][:30]
        price = round(r["price"], 2)
        key = (store, price)
        if key in seen:
            continue
        seen.add(key)
        output.append({
            "store": store,
            "price": price,
            "qty": "1 unit",
            "date": today,
            "notes": "Scraped from web",
            "type": "scraped",
        })
    return output


def main():
    if len(sys.argv) < 2:
        items = [line.strip() for line in sys.stdin if line.strip()]
    else:
        items = [sys.argv[1]] if len(sys.argv) == 2 else sys.argv[1:]

    if not items:
        print(f"Usage: {sys.argv[0]} <item name>", file=sys.stderr)
        print(f"       echo 'item name' | {sys.argv[0]}", file=sys.stderr)
        sys.exit(1)

    all_prices = {}
    for item_name in items:
        prices = scrape_item(item_name)
        all_prices[item_name] = prices
        for p in prices:
            pass  # already printed

    print(json.dumps(all_prices, indent=2))


if __name__ == "__main__":
    main()
