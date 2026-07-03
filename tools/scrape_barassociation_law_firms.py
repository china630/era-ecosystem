#!/usr/bin/env python3
"""Collect law firms (vəkil büroları) from barassociation.az communities listing."""

from __future__ import annotations

import csv
import json
import re
import time
from html import unescape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "legal"
BASE_URL = "https://barassociation.az/communities"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

CARD_RE = re.compile(
    r"<h4>([^<]+)</h4>\s*<p>\s*"
    r"Müdiri:\s*([^<]+?)\s*<br/>\s*"
    r"Ünvan:\s*([^<]+?)\s*<br/>\s*"
    r"(.*?)<br/>"
    r".*?lawyersearch\?community=(\d+)",
    re.I | re.S,
)


def fetch(url: str, retries: int = 3) -> str:
    req = Request(url, headers={"User-Agent": UA, "Accept-Language": "az"})
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            with urlopen(req, timeout=90) as resp:
                return resp.read().decode("utf-8", "replace")
        except (HTTPError, URLError, TimeoutError) as err:
            last_err = err
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_err}")


def strip_tags(text: str) -> str:
    return unescape(re.sub(r"<[^>]+>", " ", text or "")).strip()


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", strip_tags(text)).strip(" ,")


def parse_phones_email(contact_line: str) -> tuple[str, str]:
    line = normalize_spaces(contact_line)
    email = ""
    email_m = re.search(r"E-poçt:\s*([^\s,]+)", line, re.I)
    if email_m:
        email = email_m.group(1).strip()
    phone_part = re.sub(r",?\s*E-poçt:.*$", "", line, flags=re.I).strip()
    phone_part = re.sub(r"^Telefon:\s*", "", phone_part, flags=re.I).strip()
    phones = normalize_spaces(phone_part.replace("&nbsp;", " "))
    return phones, email


def infer_city(address: str) -> str:
    addr = address.strip()
    m = re.search(r"^([^,]+?)\s+(?:şəhəri|ş\.|rayonu)", addr, re.I)
    if m:
        return m.group(1).strip()
    if re.search(r"\bBakı\b", addr, re.I):
        return "Bakı"
    return ""


def discover_max_page(html: str) -> int:
    pages = [int(p) for p in re.findall(r"communities\?page=(\d+)", html)]
    return max(pages) if pages else 1


def resolve_total_pages() -> int:
    max_page = discover_max_page(fetch(f"{BASE_URL}?page=1"))
    while True:
        probe_max = discover_max_page(fetch(f"{BASE_URL}?page={max_page}"))
        if probe_max <= max_page:
            return max_page
        max_page = probe_max


def parse_page(html: str, page: int) -> list[dict]:
    rows: list[dict] = []
    for m in CARD_RE.finditer(html):
        name = normalize_spaces(m.group(1))
        director = normalize_spaces(m.group(2))
        address = normalize_spaces(m.group(3))
        contact_line = m.group(4)
        community_id = m.group(5)
        phones, email = parse_phones_email(contact_line)
        block = m.group(0)
        rows.append(
            {
                "name": name,
                "firm_type": "law_firm",
                "director": director,
                "city": infer_city(address),
                "address": address,
                "phones": phones,
                "email": email,
                "community_id": community_id,
                "lawyers_search_url": f"https://barassociation.az/lawyersearch?community={community_id}",
                "has_cabinets": "yes" if re.search(r"kabinet", block, re.I) else "no",
                "source": "barassociation.az",
                "source_url": f"{BASE_URL}?page={page}",
            }
        )
    return rows


def dedupe(rows: list[dict]) -> list[dict]:
    by_id: dict[str, dict] = {}
    for row in rows:
        by_id.setdefault(row["community_id"], row)
    return list(by_id.values())


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    max_page = resolve_total_pages()
    all_rows: list[dict] = []

    for page in range(1, max_page + 1):
        if page > 1:
            time.sleep(0.4)
        all_rows.extend(parse_page(fetch(f"{BASE_URL}?page={page}"), page))

    unique = dedupe(all_rows)
    unique.sort(key=lambda r: r["name"].lower())

    fields = [
        "id",
        "name",
        "firm_type",
        "director",
        "city",
        "address",
        "phones",
        "email",
        "community_id",
        "lawyers_search_url",
        "has_cabinets",
        "source",
        "source_url",
    ]
    out_path = OUT_DIR / "azerbaijan-law-firms.csv"
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for i, row in enumerate(unique, 1):
            writer.writerow({"id": f"law-firm-{i:03d}", **row})

    stats = {
        "pages_scraped": max_page,
        "law_firms": len(unique),
        "with_email": sum(1 for r in unique if r["email"]),
        "with_cabinets": sum(1 for r in unique if r["has_cabinets"] == "yes"),
        "source": "barassociation.az/communities",
    }
    (OUT_DIR / ".scrape-stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
