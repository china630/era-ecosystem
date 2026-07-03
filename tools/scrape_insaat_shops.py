#!/usr/bin/env python3
"""Scrape construction company profiles from https://insaat.az/shops"""

from __future__ import annotations

import csv
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "construction-companies"
OUT_CSV = OUT_DIR / "azerbaijan-construction-shops.csv"
BASE = "https://insaat.az/shops"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": UA, "Accept-Language": "az,en"})
    with urlopen(req, timeout=90) as r:
        return r.read().decode("utf-8", errors="replace")


def parse_page(html: str) -> list[dict]:
    shops: list[dict] = []
    for block in re.findall(r'<div class="campdiv clearfix">(.*?)</div>\s*</div>', html, re.S):
        name_m = re.search(
            r'<h3>\s*<a[^>]+href="(/me/[^"]+)"[^>]*title="([^"]*)"[^>]*>([^<]+)</a>',
            block,
            re.I,
        )
        if not name_m:
            continue
        profile_path, title, link_text = name_m.groups()
        name = (title or link_text).strip()
        profile_url = "https://insaat.az" + profile_path
        desc_m = re.search(r'<p class="cshort">([^<]+)</p>', block, re.I)
        phone_m = re.search(
            r'glyphicon-earphone.*?</span>\s*(\([^)]+\)\s*[\d\s]+)',
            block,
            re.I | re.S,
        )
        listings_m = re.search(r"class='ctotal'>(\d+)\s+elan", block, re.I)
        shops.append(
            {
                "name": name,
                "profile_url": profile_url,
                "phone": re.sub(r"\s+", " ", phone_m.group(1)).strip() if phone_m else "",
                "listings_count": listings_m.group(1) if listings_m else "",
                "description_snippet": re.sub(r"\s+", " ", desc_m.group(1)).strip()[:500]
                if desc_m
                else "",
            }
        )
    return shops


def max_start_page(html: str) -> int:
    starts = [int(x) for x in re.findall(r"/shops\?start=(\d+)", html)]
    return max(starts) if starts else 1


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_by_url: dict[str, dict] = {}

    html1 = fetch(BASE)
    last_page = max_start_page(html1)

    for start in range(1, last_page + 1):
        url = BASE if start == 1 else f"{BASE}?start={start}"
        html = html1 if start == 1 else fetch(url)
        batch = parse_page(html)
        new = 0
        for s in batch:
            if s["profile_url"] not in all_by_url:
                all_by_url[s["profile_url"]] = s
                new += 1
        print(f"start={start}: {len(batch)} cards, +{new} new, total {len(all_by_url)}")
        if start < last_page:
            time.sleep(0.8)

    fields = [
        "id",
        "name",
        "phone",
        "profile_url",
        "listings_count",
        "description_snippet",
        "source",
        "source_url",
    ]
    rows = []
    for i, s in enumerate(sorted(all_by_url.values(), key=lambda x: x["name"].lower()), 1):
        rows.append(
            {
                "id": f"insaat-{i:04d}",
                "name": s["name"],
                "phone": s["phone"],
                "profile_url": s["profile_url"],
                "listings_count": s["listings_count"],
                "description_snippet": s["description_snippet"],
                "source": "insaat.az",
                "source_url": BASE,
            }
        )

    with OUT_CSV.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} companies -> {OUT_CSV}")


if __name__ == "__main__":
    main()
