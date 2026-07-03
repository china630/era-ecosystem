#!/usr/bin/env python3
"""Collect private schools and colleges from modern.az and edu.gov.az."""

from __future__ import annotations

import csv
import json
import re
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "education"
MODERN_URL = "https://modern.az/az/tehsil/514701/azerbaycandaki-zel-orta-mektebler-siyahi/"
EDU_URL = (
    "https://edu.gov.az/secondary-special-education/ozel-orta-ixtisas-tehsil-muessiseleri"
)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": UA, "Accept-Language": "az"})
    with urlopen(req, timeout=90) as resp:
        return resp.read().decode("utf-8", "replace")


def parse_modern_schools(html: str) -> list[dict]:
    rows: list[dict] = []
    block_m = re.search(
        r"Özəl orta məktəblərin siyahısını təqdim edirik:.*?<strong>(.*?)</strong>",
        html,
        re.I | re.S,
    )
    if block_m:
        block = unescape(block_m.group(1))
        for line in re.split(r"<br\s*/?>", block, flags=re.I):
            name = re.sub(r"^\s*-\s*", "", strip_tags(line)).strip()
            if not name or len(name) < 3:
                continue
            rows.append(
                {
                    "name": name,
                    "institution_type": "private_general_school",
                    "address": "",
                    "city": "Bakı",
                    "source": "modern.az",
                    "source_url": MODERN_URL,
                }
            )
    # Fallback: markdown-style **name**
    for m in re.finditer(r"\*\*-?\s*([^*<]+?)\s*\*\*", html):
        name = unescape(m.group(1)).strip()
        if not name or len(name) < 3:
            continue
        low = name.lower()
        if any(
            x in low
            for x in (
                "modern.az",
                "daha çox",
                "paylaş",
                "kanalımıza",
                "şagird",
                "müəllim",
                "nazir",
            )
        ):
            continue
        if name.endswith(":"):
            continue
        rows.append(
            {
                "name": name,
                "institution_type": "private_general_school",
                "address": "",
                "city": "Bakı",
                "source": "modern.az",
                "source_url": MODERN_URL,
            }
        )
    # Deduplicate by normalized name
    seen: set[str] = set()
    unique = []
    for r in rows:
        key = re.sub(r"[^a-z0-9]+", "", r["name"].lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(r)
    return unique


def strip_tags(s: str) -> str:
    return unescape(re.sub(r"<[^>]+>", " ", s or "")).strip()


def parse_edu_colleges(html: str) -> list[dict]:
    rows: list[dict] = []
    for m in re.finditer(
        r"<strong>\s*(\d+)\.\s*([^<]+?)<br\s*/?>\s*Ünvan:\s*</strong>\s*([^<]+)</p>",
        html,
        re.I | re.S,
    ):
        rows.append(
            {
                "name": strip_tags(m.group(2)),
                "institution_type": "private_vocational_college",
                "address": strip_tags(m.group(3)),
                "city": "Bakı",
                "source": "edu.gov.az",
                "source_url": EDU_URL,
            }
        )
    if rows:
        return rows
    for m in re.finditer(
        r"\*\*(\d+)\.\s*([^*<]+)\*\*\s*(?:<br\s*/?>)?\s*\*\*Ünvan:\*\*\s*([^<]+)",
        html,
        re.I | re.S,
    ):
        rows.append(
            {
                "name": strip_tags(m.group(2)),
                "institution_type": "private_vocational_college",
                "address": strip_tags(m.group(3)),
                "city": "Bakı",
                "source": "edu.gov.az",
                "source_url": EDU_URL,
            }
        )
    return rows


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    modern = parse_modern_schools(fetch(MODERN_URL))
    colleges = parse_edu_colleges(fetch(EDU_URL))
    all_rows = modern + colleges

    path = OUT_DIR / "azerbaijan-private-schools.csv"
    fields = ["id", "name", "institution_type", "city", "address", "source", "source_url"]
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for i, row in enumerate(all_rows, 1):
            w.writerow({"id": f"school-{i:03d}", **row})

    stats = {
        "general_schools": len(modern),
        "vocational_colleges": len(colleges),
        "total": len(all_rows),
    }
    (OUT_DIR / ".scrape-stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print(stats)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
