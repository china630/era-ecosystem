#!/usr/bin/env python3
"""Scrape Azerbaijani telecom operators/providers from az.wikipedia.org."""

from __future__ import annotations

import csv
import json
import re
import ssl
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "telecommunications"
WIKI_URL = (
    "https://az.wikipedia.org/wiki/"
    "Az%C9%99rbaycan_operator_v%C9%99_provayderl%C9%99rinin_siyah%C4%B1s%C4%B1"
)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": UA, "Accept-Language": "az"})
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urlopen(req, timeout=90, context=ctx) as resp:
        return resp.read().decode("utf-8", "replace")


def strip_tags(text: str) -> str:
    text = re.sub(r"<sup[^>]*>.*?</sup>", "", text or "", flags=re.I | re.S)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.I | re.S)
    return unescape(re.sub(r"<[^>]+>", " ", text)).strip()


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def cell_text_and_link(td_html: str) -> tuple[str, str]:
    link_m = re.search(r'href="(https?://[^"]+)"', td_html, re.I)
    website = link_m.group(1) if link_m else ""
    text = normalize_spaces(strip_tags(td_html))
    if not website:
        bare = text.strip()
        if bare and re.match(r"^[\w.-]+\.[a-z]{2,}", bare, re.I):
            website = bare if bare.startswith("http") else f"https://{bare}"
    return text, website


def clean_name(name: str) -> str:
    name = re.sub(r"\[\d+\]", "", name)
    name = re.sub(r"\[a\]", "", name, flags=re.I)
    name = name.strip(" \"“”'")
    return normalize_spaces(name)


def infer_entity_type(name: str, legal_form: str) -> str:
    if legal_form:
        return "company"
    if re.search(r"\boğlu\b|\bqızı\b", name, re.I):
        return "individual"
    if name.startswith('"') or "MMC" in name or "QSC" in name:
        return "company"
    return "organization"


def normalize_website(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if not url.startswith("http"):
        url = f"https://{url}"
    return url.rstrip("/")


def parse_wikitable(html: str) -> list[dict]:
    table_m = re.search(
        r'<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>(.*?)</table>',
        html,
        re.I | re.S,
    )
    if not table_m:
        raise RuntimeError("wikitable not found on Wikipedia page")

    rows: list[dict] = []
    for tr in re.finditer(r"<tr[^>]*>(.*?)</tr>", table_m.group(1), re.I | re.S):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr.group(1), re.I | re.S)
        if len(cells) < 4:
            continue
        num_text = strip_tags(cells[0])
        if not re.match(r"\d+", num_text):
            continue
        list_number = int(re.sub(r"\D", "", num_text))
        name, _ = cell_text_and_link(cells[1])
        name = clean_name(name)
        if not name:
            continue
        legal_form, _ = cell_text_and_link(cells[2])
        legal_form = normalize_spaces(strip_tags(cells[2]))
        activity, _ = cell_text_and_link(cells[3])
        activity = normalize_spaces(strip_tags(cells[3]))
        website = ""
        if len(cells) > 4:
            _, website = cell_text_and_link(cells[4])
        website = normalize_website(website)

        activity_lower = activity.lower()
        rows.append(
            {
                "list_number": list_number,
                "name": name,
                "entity_type": infer_entity_type(name, legal_form),
                "legal_form": legal_form,
                "activity_types": activity,
                "is_operator": "yes"
                if "operator" in activity_lower and "provayder" not in activity_lower.replace("internet provayder", "")
                else ("yes" if re.search(r"\boperator\b", activity_lower) else "no"),
                "is_internet_provider": "yes"
                if re.search(r"internet provayder", activity_lower)
                else "no",
                "is_host_provider": "yes"
                if re.search(r"host provayder", activity_lower)
                else "no",
                "website": website,
                "source": "az.wikipedia.org",
                "source_url": WIKI_URL,
            }
        )
    return rows


def fix_operator_flag(row: dict) -> dict:
    act = row["activity_types"].lower()
    row["is_operator"] = "yes" if re.search(r"\boperator\b", act) else "no"
    return row


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    html = fetch(WIKI_URL)
    rows = [fix_operator_flag(r) for r in parse_wikitable(html)]
    rows.sort(key=lambda r: r["list_number"])

    fields = [
        "id",
        "list_number",
        "name",
        "entity_type",
        "legal_form",
        "activity_types",
        "is_operator",
        "is_internet_provider",
        "is_host_provider",
        "website",
        "source",
        "source_url",
    ]
    out_path = OUT_DIR / "azerbaijan-telecom-operators.csv"
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for i, row in enumerate(rows, 1):
            writer.writerow({"id": f"telecom-{i:03d}", **row})

    stats = {
        "total": len(rows),
        "operators": sum(1 for r in rows if r["is_operator"] == "yes"),
        "internet_providers": sum(1 for r in rows if r["is_internet_provider"] == "yes"),
        "host_providers": sum(1 for r in rows if r["is_host_provider"] == "yes"),
        "with_website": sum(1 for r in rows if r["website"]),
        "individuals": sum(1 for r in rows if r["entity_type"] == "individual"),
        "source": WIKI_URL,
    }
    (OUT_DIR / ".scrape-stats.json").write_text(
        json.dumps(stats, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
