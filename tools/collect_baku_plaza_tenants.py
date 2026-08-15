#!/usr/bin/env python3
"""
Step 2 — Baku plaza tenant list + travel agencies (append).

Order of assembly:
  1. Companies located in approved plazas (plaza_id required)
  2. Travel agencies from EW Excel (appended after; no plaza link)

Plaza tenant sources:
  - audit.gov.az addresses (operational office in plaza)
  - e-taxes tax_legal_address in azerbaijan-legal-entities.csv (registered legal address)

Output: data/business-plazas/baku-plaza-tenants-DRAFT.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "business-plazas"
PLAZAS_CSV = DATA / "baku-business-plazas.csv"
OUT_CSV = DATA / "baku-plaza-tenants-DRAFT.csv"

DEFAULT_TRAVEL_XLSX = Path(
    r"c:\Users\ASUS G752VT\Downloads\EW\Travel Agencies.xlsx"
)

CSV_HEADER = [
    "record_group",
    "tenant_id",
    "company_name",
    "sector",
    "plaza_id",
    "plaza_name",
    "address",
    "city",
    "phone",
    "email",
    "website",
    "voen",
    "source",
    "source_id",
    "confidence",
    "extra_json",
]


def slugify(text: str, max_len: int = 48) -> str:
    t = unicodedata.normalize("NFKD", text or "")
    t = t.encode("ascii", "ignore").decode("ascii")
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return (t or "x")[:max_len]


def norm_name(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def clean_name(text: str) -> str:
    return (text or "").strip().strip('"').strip("“”")


def load_plaza_aliases() -> list[tuple[int, str, str, str]]:
    rows: list[tuple[int, str, str, str]] = []
    with PLAZAS_CSV.open(encoding="utf-8", newline="") as f:
        for p in csv.DictReader(f):
            names = [p["canonical_name"]]
            names += [a.strip() for a in (p.get("aliases") or "").split("|") if a.strip()]
            for n in names:
                key = n.lower()
                if len(key) >= 4:
                    rows.append((len(key), key, p["id"], p["canonical_name"]))
    rows.sort(reverse=True)
    return rows


def match_plaza(address: str, aliases: list[tuple[int, str, str, str]]):
    a = (address or "").lower()
    if not a:
        return None
    for _ln, key, plaza_id, plaza_name in aliases:
        if key in a:
            return plaza_id, plaza_name, key
    return None


def collect_plaza_tenants(aliases: list[tuple[int, str, str, str]]) -> list[dict]:
    """Companies with address evidence they are in a plaza building."""
    by_key: dict[tuple[str, str], dict] = {}
    plaza_seq = 0

    def upsert(key: tuple[str, str], row: dict) -> None:
        nonlocal plaza_seq
        if key not in by_key:
            plaza_seq += 1
            row["tenant_id"] = f"plaza-{plaza_seq:04d}"
            row["record_group"] = "plaza_tenant"
            by_key[key] = row
            return
        prev = by_key[key]
        for field in ("phone", "email", "website", "voen", "address"):
            if not prev.get(field) and row.get(field):
                prev[field] = row[field]
        sources = set((prev.get("source") or "").split("|"))
        sources.add(row.get("source") or "")
        prev["source"] = "|".join(sorted(s for s in sources if s))

    # Operational addresses (audit firms — known office in plaza)
    auditors_path = ROOT / "data" / "accountants" / "azerbaijan-auditors.csv"
    with auditors_path.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            m = match_plaza(row.get("address") or "", aliases)
            if not m:
                continue
            plaza_id, plaza_name, matched = m
            name = clean_name(row.get("name"))
            if not name:
                continue
            upsert(
                (plaza_id, norm_name(name)),
                {
                    "company_name": name,
                    "sector": "accounting",
                    "plaza_id": plaza_id,
                    "plaza_name": plaza_name,
                    "address": row.get("address") or "",
                    "city": row.get("city") or "Bakı",
                    "phone": row.get("phones") or "",
                    "email": row.get("email") or "",
                    "website": row.get("website") or "",
                    "voen": "",
                    "source": "accountants",
                    "source_id": slugify(name),
                    "confidence": "high",
                    "extra_json": json.dumps(
                        {
                            "matched_plaza_alias": matched,
                            "address_type": "operational",
                            "director": row.get("director"),
                        },
                        ensure_ascii=False,
                    ),
                },
            )

    # Registered legal addresses from DVX / e-taxes enrichment
    legal_path = ROOT / "data" / "legal-entities" / "azerbaijan-companies-with-voen.csv"
    with legal_path.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            addr = (row.get("tax_legal_address") or "").strip()
            if not addr:
                continue
            m = match_plaza(addr, aliases)
            if not m:
                continue
            plaza_id, plaza_name, matched = m
            name = clean_name(row.get("tax_name"))
            if not name:
                continue
            sector = (row.get("donor_sectors") or "").split("|")[0].strip() or "company"
            upsert(
                (plaza_id, norm_name(name)),
                {
                    "company_name": name,
                    "sector": sector,
                    "plaza_id": plaza_id,
                    "plaza_name": plaza_name,
                    "address": addr,
                    "city": (row.get("donor_cities") or "Bakı").split("|")[0] or "Bakı",
                    "phone": (row.get("donor_phones") or "").split("|")[0],
                    "email": (row.get("donor_emails") or "").split("|")[0],
                    "website": (row.get("donor_websites") or "").split("|")[0],
                    "voen": row.get("voen") or "",
                    "source": "legal_entities_tax_address",
                    "source_id": row.get("voen") or slugify(name),
                    "confidence": "high",
                    "extra_json": json.dumps(
                        {
                            "matched_plaza_alias": matched,
                            "address_type": "tax_legal",
                            "tax_active": row.get("tax_active"),
                            "tax_status": row.get("tax_status"),
                        },
                        ensure_ascii=False,
                    ),
                },
            )

    return sorted(
        by_key.values(),
        key=lambda r: (r["plaza_id"], r["company_name"].lower()),
    )


def load_travel_agencies(xlsx_path: Path) -> list[dict]:
    try:
        import pandas as pd
    except ImportError as e:
        raise SystemExit("pandas required: pip install pandas openpyxl") from e

    if not xlsx_path.is_file():
        raise SystemExit(f"Travel agencies file not found: {xlsx_path}")

    df = pd.read_excel(xlsx_path).fillna("")
    grouped: dict[str, dict] = {}

    for _, row in df.iterrows():
        name = str(row.get("Full Name") or "").strip()
        if not name:
            continue
        g = grouped.setdefault(
            name,
            {
                "ids": [],
                "agent_codes": [],
                "phones": [],
                "emails": [],
                "sales_reps": [],
                "rate_codes": [],
                "is_company": [],
                "passive": [],
                "grey_list": [],
            },
        )
        for field, key in [
            ("Id", "ids"),
            ("Agent Code", "agent_codes"),
            ("Phone", "phones"),
            ("Email", "emails"),
            ("Sales Rep", "sales_reps"),
            ("Rate Code", "rate_codes"),
        ]:
            val = str(row.get(field) or "").strip()
            if val:
                g[key].append(val)
        for field, key in [("Is Company", "is_company"), ("Passive", "passive"), ("Grey List", "grey_list")]:
            val = row.get(field)
            if val != "":
                g[key].append(val)

    rows: list[dict] = []
    for i, (name, g) in enumerate(sorted(grouped.items()), start=1):
        rows.append(
            {
                "record_group": "travel_agency",
                "tenant_id": f"travel-{i:04d}",
                "company_name": name,
                "sector": "travel_agency",
                "plaza_id": "",
                "plaza_name": "",
                "address": "",
                "city": "Bakı",
                "phone": " | ".join(dict.fromkeys(g["phones"])),
                "email": " | ".join(dict.fromkeys(g["emails"])),
                "website": "",
                "voen": "",
                "source": "ew_travel_agencies_xlsx",
                "source_id": g["ids"][0] if g["ids"] else slugify(name),
                "confidence": "high",
                "extra_json": json.dumps(
                    {
                        "source_file": str(xlsx_path),
                        "ew_ids": g["ids"],
                        "agent_codes": sorted(dict.fromkeys(g["agent_codes"])),
                        "rate_codes": sorted(dict.fromkeys(g["rate_codes"])),
                        "sales_reps": sorted(dict.fromkeys(g["sales_reps"])),
                        "is_company": g["is_company"],
                        "passive": g["passive"],
                        "grey_list": g["grey_list"],
                        "excel_row_count": len(g["ids"]),
                    },
                    ensure_ascii=False,
                ),
            }
        )
    return rows


def write_csv(plaza_rows: list[dict], travel_rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_HEADER, extrasaction="ignore")
        w.writeheader()
        for row in plaza_rows:
            w.writerow(row)
        for row in travel_rows:
            w.writerow(row)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build plaza tenants then append travel agencies.")
    parser.add_argument("--travel-xlsx", type=Path, default=DEFAULT_TRAVEL_XLSX)
    parser.add_argument("--output", type=Path, default=OUT_CSV)
    parser.add_argument("--travel-only", action="store_true", help="Skip plaza mining (debug)")
    parser.add_argument("--plaza-only", action="store_true", help="Skip travel agencies append")
    args = parser.parse_args()

    aliases = load_plaza_aliases()
    plaza_rows = [] if args.travel_only else collect_plaza_tenants(aliases)
    travel_rows = [] if args.plaza_only else load_travel_agencies(args.travel_xlsx)

    write_csv(plaza_rows, travel_rows, args.output)

    plazas_hit = len({r["plaza_id"] for r in plaza_rows})
    stats = {
        "plaza_tenants": len(plaza_rows),
        "plazas_with_tenants": plazas_hit,
        "travel_agencies": len(travel_rows),
        "total_rows": len(plaza_rows) + len(travel_rows),
        "assembly": "plaza_tenants first, then travel_agencies",
    }
    (DATA / ".tenants-collect-stats.json").write_text(
        json.dumps(stats, indent=2), encoding="utf-8"
    )
    print(json.dumps(stats, indent=2, ensure_ascii=False))
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
