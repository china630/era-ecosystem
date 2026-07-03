#!/usr/bin/env python3
"""Scrape CBAR public registries: insurers and non-bank credit institutions (BOKT)."""

from __future__ import annotations

import csv
import json
import re
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "financial-institutions"
INSURERS_URL = "https://www.cbar.az/page-202/insurers-and-reinsurers"
BOKT_URL = "https://www.cbar.az/page-196/non-bank-credit-institutions"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"


def fetch(url: str) -> str:
    req = Request(url, headers={"User-Agent": UA, "Accept-Language": "az"})
    with urlopen(req, timeout=90) as resp:
        return resp.read().decode("utf-8", "replace")


def strip_tags(s: str) -> str:
    return unescape(re.sub(r"<[^>]+>", " ", s or "")).strip()


def table_field(block: str, label: str) -> str:
    patterns = [
        rf">{re.escape(label)}<.*?<td[^>]*>(.*?)</td>",
        rf"{re.escape(label)}\s*</[^>]+>\s*</[^>]+>\s*<[^>]+>(.*?)</",
    ]
    for pat in patterns:
        m = re.search(pat, block, re.I | re.S)
        if m:
            return strip_tags(m.group(1))
    # markdown-style fallback when scraping saved exports
    m = re.search(rf"\|\s*{re.escape(label)}\s*\|\s*([^|\n]+)", block, re.I)
    return strip_tags(m.group(1)) if m else ""


def split_institution_blocks(html: str) -> list[tuple[str, str]]:
    """Return (name, block_html) pairs."""
    blocks: list[tuple[str, str]] = []
    # CBAR pages: heading then table per institution
    parts = re.split(r'<div[^>]*class="[^"]*asset[^"]*"[^>]*>', html, flags=re.I)
    if len(parts) <= 1:
        parts = re.split(r"<h[23][^>]*>", html, flags=re.I)
    for part in parts[1:]:
        name_m = re.search(
            r"^\s*(?:</[^>]+>\s*)*(.+?)\s*(?:<table|<div class=\"table)",
            part,
            re.I | re.S,
        )
        if not name_m:
            continue
        name = strip_tags(name_m.group(1))
        name = re.sub(r"\s+", " ", name)
        if len(name) < 4 or name.lower().startswith("naviqasiya"):
            continue
        blocks.append((name, part))
    if blocks:
        return blocks

    # Plain-text / markdown export style
    for m in re.finditer(
        r"\n\n([^\n|]{4,160}(?:ASC|MMC|QSC|BOKT)[^\n]*)\n\n\|",
        html,
    ):
        name = m.group(1).strip()
        start = m.end()
        nxt = re.search(r"\n\n[^\n|]{4,160}(?:ASC|MMC|QSC|BOKT)", html[start:])
        end = start + nxt.start() if nxt else start + 4000
        blocks.append((name, html[start:end]))
    return blocks


def parse_insurer(name: str, block: str) -> dict:
    return {
        "name": name,
        "legal_form": table_field(block, "Təşkilati-hüquqi forması"),
        "voen": re.sub(r"\D", "", table_field(block, "VÖEN"))[:10],
        "state_registered_at": table_field(block, "Dövlət qeydiyyatı tarixi"),
        "license_date": table_field(block, "Lisenziya verilmə tarixi"),
        "address": table_field(block, "Ünvan"),
        "contacts": table_field(block, "Əlaqə məlumatları"),
        "institution_type": "insurer",
        "source_url": INSURERS_URL,
    }


def parse_bokt(name: str, block: str) -> dict:
    return {
        "name": name,
        "legal_form": table_field(block, "Təşkilati-hüquqi forması"),
        "license_number": table_field(block, "Lisenziya nömrəsi"),
        "license_date": table_field(block, "Lisenziya verilmə tarixi"),
        "address": table_field(block, "Ünvan"),
        "contacts": table_field(block, "Əlaqə məlumatları"),
        "ceo": table_field(block, "İdarə heyəti sədri") or table_field(block, "Təkbaşına rəhbəri"),
        "institution_type": "bokt",
        "source_url": BOKT_URL,
    }


def extract_contacts(contacts: str) -> tuple[str, str, str]:
    phone = ""
    email = ""
    website = ""
    pm = re.search(r"(?:Tel|telefon)[:\s]*([^;,\n]+)", contacts, re.I)
    if pm:
        phone = pm.group(1).strip()
    em = re.search(r"e-?mail[:\s]*([^\s,;]+)", contacts, re.I)
    if em:
        email = em.group(1).strip()
    wm = re.search(r"(www\.[^\s,;]+)", contacts, re.I)
    if wm:
        website = wm.group(1).strip()
    return phone, email, website


def write_insurers(rows: list[dict]) -> None:
    path = OUT_DIR / "azerbaijan-insurers.csv"
    fields = [
        "id",
        "name",
        "legal_form",
        "voen",
        "state_registered_at",
        "license_date",
        "address",
        "phone",
        "email",
        "website",
        "contacts_raw",
        "source_url",
    ]
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for i, row in enumerate(rows, 1):
            phone, email, website = extract_contacts(row.get("contacts", ""))
            w.writerow(
                {
                    "id": f"insurer-{i:03d}",
                    "name": row["name"],
                    "legal_form": row.get("legal_form", ""),
                    "voen": row.get("voen", ""),
                    "state_registered_at": row.get("state_registered_at", ""),
                    "license_date": row.get("license_date", ""),
                    "address": row.get("address", ""),
                    "phone": phone,
                    "email": email,
                    "website": website,
                    "contacts_raw": row.get("contacts", ""),
                    "source_url": row.get("source_url", ""),
                }
            )
    print(f"Wrote {len(rows)} insurers -> {path}")


def write_bokt(rows: list[dict]) -> None:
    path = OUT_DIR / "azerbaijan-bokt.csv"
    fields = [
        "id",
        "name",
        "legal_form",
        "license_number",
        "license_date",
        "address",
        "phone",
        "email",
        "website",
        "ceo",
        "contacts_raw",
        "source_url",
    ]
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for i, row in enumerate(rows, 1):
            phone, email, website = extract_contacts(row.get("contacts", ""))
            w.writerow(
                {
                    "id": f"bokt-{i:03d}",
                    "name": row["name"],
                    "legal_form": row.get("legal_form", ""),
                    "license_number": row.get("license_number", ""),
                    "license_date": row.get("license_date", ""),
                    "address": row.get("address", ""),
                    "phone": phone,
                    "email": email,
                    "website": website,
                    "ceo": row.get("ceo", ""),
                    "contacts_raw": row.get("contacts", ""),
                    "source_url": row.get("source_url", ""),
                }
            )
    print(f"Wrote {len(rows)} BOKT -> {path}")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    insurers_html = fetch(INSURERS_URL)
    bokt_html = fetch(BOKT_URL)

    insurers = [parse_insurer(n, b) for n, b in split_institution_blocks(insurers_html)]
    bokt = [parse_bokt(n, b) for n, b in split_institution_blocks(bokt_html)]

    # Fallback: parse markdown-like blocks if HTML split failed
    if len(insurers) < 5:
        upload = Path(
            r"C:\Users\ASUS G752VT\.cursor\projects\d-My-Projects-era-ecosystem\uploads\insurers-and-reinsurers-10.md"
        )
        if upload.exists():
            insurers = [
                parse_insurer(n, b) for n, b in split_institution_blocks(upload.read_text(encoding="utf-8"))
            ]
    if len(bokt) < 10:
        upload = Path(
            r"C:\Users\ASUS G752VT\.cursor\projects\d-My-Projects-era-ecosystem\uploads\non-bank-credit-institutions-11.md"
        )
        if upload.exists():
            bokt = [
                parse_bokt(n, b) for n, b in split_institution_blocks(upload.read_text(encoding="utf-8"))
            ]

    insurers = [r for r in insurers if r["name"]]
    bokt = [r for r in bokt if r["name"]]

    write_insurers(insurers)
    write_bokt(bokt)

    meta = {
        "insurers": len(insurers),
        "insurers_with_voen": sum(1 for r in insurers if r.get("voen")),
        "bokt": len(bokt),
    }
    (OUT_DIR / ".scrape-stats.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(meta)


if __name__ == "__main__":
    main()
