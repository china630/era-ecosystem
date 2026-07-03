#!/usr/bin/env python3
"""
Scrape Azerbaijani exhibitors from Iteca/ERA exhibition sites.

Sites share the same CMS: /az/exhibitors-list/year/{year} + ERAForms/companies_list.php
"""

from __future__ import annotations

import csv
import json
import re
import time
from html import unescape
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "exhibitions"
OUT_MASTER = OUT_DIR / "azerbaijan-exhibition-exhibitors.csv"
OUT_RAW = OUT_DIR / "azerbaijan-exhibition-exhibitors-raw.csv"

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
DELAY_SEC = 0.45
PAGE_SIZE = 500

EXHIBITION_SITES = [
    {"host": "bakubuild.az", "slug": "bakubuild", "label": "BakuBuild"},
    {"host": "aquatherm.az", "slug": "aquatherm", "label": "Aquatherm Baku"},
    {"host": "medinex.az", "slug": "medinex", "label": "Medinex"},
    {"host": "beautyexpo.az", "slug": "beautyexpo", "label": "Beauty Expo Baku"},
    {"host": "interfood.az", "slug": "interfood", "label": "InterFood Azerbaijan"},
    {"host": "caspianoilgas.az", "slug": "caspianoilgas", "label": "Caspian Oil & Gas"},
    {"host": "securexcaspian.az", "slug": "securexcaspian", "label": "Securex Caspian"},
    {"host": "translogistica.az", "slug": "translogistica", "label": "TransLogistica Caspian"},
    {"host": "caspianagroweek.az", "slug": "caspianagroweek", "label": "Caspian Agro Week"},
    {"host": "plastex.az", "slug": "plastex", "label": "Plastex Caspian"},
]

AZ_MAP = str.maketrans(
    {
        "ə": "e",
        "ı": "i",
        "ö": "o",
        "ü": "u",
        "ç": "c",
        "ş": "s",
        "ğ": "g",
        "Ə": "e",
        "İ": "i",
        "Ö": "o",
        "Ü": "u",
        "Ç": "c",
        "Ş": "s",
        "Ğ": "g",
    }
)

MASTER_FIELDS = [
    "id",
    "company_name",
    "country",
    "categories",
    "stands",
    "exhibitions",
    "years",
    "appearance_count",
    "extra_json",
]

RAW_FIELDS = [
    "id",
    "company_name",
    "country",
    "category",
    "stand",
    "exhibition_site",
    "exhibition_label",
    "exhibition_year",
    "exhibition_id",
    "company_id",
    "source_url",
]


def fetch(url: str, post: bytes | None = None) -> str:
    headers = {"User-Agent": UA, "Accept-Language": "az,en"}
    if post is not None:
        headers.update(
            {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": url.split("/ERAForms/")[0] + "/az/exhibitors-list",
            }
        )
    req = Request(url, data=post, headers=headers, method="POST" if post else "GET")
    with urlopen(req, timeout=90) as resp:
        return resp.read().decode("utf-8", "replace")


def norm_key(name: str) -> str:
    s = unescape(name or "").strip().lower().translate(AZ_MAP)
    s = re.sub(r'[«»"\'`]', "", s)
    s = re.sub(r"\b(mmc|llc|ltd|qsc)\b", " ", s)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s


def parse_year_page(html: str) -> dict | None:
    if "dataTableURL" not in html:
        return None
    api_m = re.search(r"dataTableURL = '([^']+)'", html)
    if not api_m:
        return None
    api_path = api_m.group(1)
    exh_m = re.search(r"exhibition=(\d+)", api_path)
    years = sorted(
        set(re.findall(r'<option value="(20\d{2})"', html))
        | set(re.findall(r"exhibitors-list/year/(20\d{2})", html))
    )
    az_m = re.search(r'<option value="(\d+)"[^>]*>\s*Azərbaycan\s*</option>', html, re.I)
    return {
        "api_path": api_path,
        "exhibition_id": exh_m.group(1) if exh_m else "",
        "az_country_id": az_m.group(1) if az_m else "1",
        "years": years,
    }


def discover_years(host: str) -> list[str]:
    """Probe several archive years and merge year tabs from navigation."""
    found: set[str] = set()
    for year in (2027, 2025, 2023, 2021, 2019, 2017, 2016):
        url = f"https://{host}/az/exhibitors-list/year/{year}"
        try:
            html = fetch(url)
            meta = parse_year_page(html)
            if not meta:
                continue
            found.update(meta["years"])
            found.add(str(year))
        except Exception:
            continue
    if not found:
        found = {str(y) for y in range(2016, 2028)}
    return sorted(found)


def parse_api_row(cells: list, category: str) -> tuple[str, dict | None]:
    if not cells:
        return category, None
    first = str(cells[0])
    if "group-head" in first:
        m = re.search(r"<!--group-head-->(.+)", first)
        return (unescape(m.group(1).strip()) if m else category), None
    m = re.search(r'font-weight-bold mb-0">([^<]+)<', first)
    if not m:
        return category, None
    name = unescape(m.group(1).strip())
    country = re.sub(r"<[^>]+>", "", str(cells[1] if len(cells) > 1 else "")).strip()
    stand = re.sub(r"<[^>]+>", "", str(cells[2] if len(cells) > 2 else "")).strip()
    company_id_m = re.search(r"myInfo(\d+)", first)
    return category, {
        "name": name,
        "country": country,
        "stand": stand,
        "company_id": company_id_m.group(1) if company_id_m else "",
    }


def fetch_exhibitors(host: str, api_path: str, az_country_id: str) -> list[dict]:
    api_url = f"https://{host}/{api_path.lstrip('/')}"
    all_rows: list[dict] = []
    start = 0
    draw = 1
    while True:
        payload = urlencode(
            {
                "draw": str(draw),
                "start": str(start),
                "length": str(PAGE_SIZE),
                "search[value]": "",
                "search[regex]": "false",
                "field1": az_country_id,
                "field2": "0",
                "field3": "",
            }
        ).encode()
        raw = fetch(api_url, payload)
        data = json.loads(raw)
        batch = data.get("data") or []
        if not batch:
            break
        cat = ""
        for row in batch:
            cat, item = parse_api_row(row, cat)
            if item:
                item["category"] = cat
                all_rows.append(item)
        total = int(data.get("recordsFiltered") or data.get("recordsTotal") or 0)
        start += len(batch)
        draw += 1
        if start >= total:
            break
        time.sleep(DELAY_SEC)
    return all_rows


def is_azerbaijan(country: str) -> bool:
    c = country.lower().translate(AZ_MAP)
    return "azerbaycan" in c or c in ("az", "aze")


def scrape_site(site: dict) -> list[dict]:
    host = site["host"]
    years = discover_years(host)
    print(f"  {site['label']}: years {years}")
    raw_rows: list[dict] = []

    for year in years:
        page_url = f"https://{host}/az/exhibitors-list/year/{year}"
        try:
            html = fetch(page_url)
        except Exception as e:
            print(f"    {year}: page error {e}")
            continue
        meta = parse_year_page(html)
        if not meta or not meta["exhibition_id"]:
            print(f"    {year}: no exhibition data")
            continue
        try:
            companies = fetch_exhibitors(host, meta["api_path"], meta["az_country_id"])
        except Exception as e:
            print(f"    {year}: api error {e}")
            continue

        az_count = 0
        for c in companies:
            if not is_azerbaijan(c.get("country", "")):
                continue
            az_count += 1
            raw_rows.append(
                {
                    "company_name": c["name"],
                    "country": c.get("country") or "Azərbaycan",
                    "category": c.get("category") or "",
                    "stand": c.get("stand") or "",
                    "exhibition_site": site["slug"],
                    "exhibition_label": site["label"],
                    "exhibition_year": year,
                    "exhibition_id": meta["exhibition_id"],
                    "company_id": c.get("company_id") or "",
                    "source_url": page_url,
                }
            )
        print(f"    {year}: exhibition={meta['exhibition_id']} az={az_count}/{len(companies)}")
        time.sleep(DELAY_SEC)

    return raw_rows


def merge_raw(rows: list[dict]) -> list[dict]:
    by_key: dict[str, dict] = {}
    for row in rows:
        key = norm_key(row["company_name"])
        if not key:
            continue
        appearance = {
            "exhibition": row["exhibition_site"],
            "exhibition_label": row["exhibition_label"],
            "year": row["exhibition_year"],
            "category": row["category"],
            "stand": row["stand"],
            "company_id": row["company_id"],
            "source_url": row["source_url"],
        }
        if key not in by_key:
            by_key[key] = {
                "company_name": row["company_name"],
                "country": row["country"],
                "appearances": [appearance],
            }
        else:
            cur = by_key[key]
            if row["company_name"] and len(row["company_name"]) > len(cur["company_name"]):
                cur["company_name"] = row["company_name"]
            cur["appearances"].append(appearance)

    merged = []
    for i, (_, rec) in enumerate(sorted(by_key.items(), key=lambda kv: kv[1]["company_name"].lower()), 1):
        apps = rec["appearances"]
        categories = sorted({a["category"] for a in apps if a["category"]})
        stands = sorted({a["stand"] for a in apps if a["stand"] and a["stand"] != "-"})
        exhibitions = sorted({a["exhibition_label"] for a in apps})
        years = sorted({a["year"] for a in apps})
        merged.append(
            {
                "id": f"expo-{i:05d}",
                "company_name": rec["company_name"],
                "country": rec["country"],
                "categories": " | ".join(categories),
                "stands": " | ".join(stands),
                "exhibitions": " | ".join(exhibitions),
                "years": " | ".join(years),
                "appearance_count": len(apps),
                "extra_json": json.dumps({"appearances": apps}, ensure_ascii=False),
            }
        )
    return merged


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    all_raw: list[dict] = []

    for site in EXHIBITION_SITES:
        print(site["host"])
        all_raw.extend(scrape_site(site))

    for i, row in enumerate(all_raw, 1):
        row["id"] = f"expo-raw-{i:06d}"

    merged = merge_raw(all_raw)

    with OUT_RAW.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=RAW_FIELDS)
        w.writeheader()
        w.writerows(all_raw)

    with OUT_MASTER.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=MASTER_FIELDS)
        w.writeheader()
        w.writerows(merged)

    print(f"\nRaw rows: {len(all_raw)}")
    print(f"Unique companies: {len(merged)}")
    print(f"Wrote {OUT_MASTER}")
    print(f"Wrote {OUT_RAW}")


if __name__ == "__main__":
    main()
