#!/usr/bin/env python3
"""Merge EW Excel + turlar.az + trippost.az into azerbaijan-travel-agencies.csv."""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collect_baku_plaza_tenants import DEFAULT_TRAVEL_XLSX, load_travel_agencies

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "travel-agencies"
OUT_CSV = OUT_DIR / "azerbaijan-travel-agencies.csv"
TURLAR_CSV = OUT_DIR / "azerbaijan-turlar-shops.csv"
TRIPPOST_CSV = OUT_DIR / "azerbaijan-trippost-travel.csv"

FIELDS = [
    "id",
    "company_name",
    "phone",
    "email",
    "city",
    "source",
    "source_id",
    "extra_json",
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

LEGAL_DROP_RE = re.compile(
    r'mmc|ltd|llc|travel|turizm|tour|agency|agentliyi|sirketi|şirkəti|company|co\b',
    re.I,
)


def norm_key(name: str) -> str:
    s = (name or "").strip().lower().translate(AZ_MAP)
    s = re.sub(r'[«»"\'`]', "", s)
    s = re.sub(r"^\d+\.\s*", "", s)
    s = LEGAL_DROP_RE.sub(" ", s)
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s


def read_csv(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def merge_extra(existing: dict, patch: dict) -> dict:
    out = dict(existing)
    for k, v in patch.items():
        if k not in out or out[k] in (None, "", [], {}):
            out[k] = v
            continue
        if isinstance(out[k], list) and isinstance(v, list):
            out[k] = list(dict.fromkeys([*out[k], *v]))
        elif out[k] != v:
            if "alt_values" not in out:
                out["alt_values"] = {}
            out["alt_values"].setdefault(k, [])
            if v not in out["alt_values"][k]:
                out["alt_values"][k].append(v)
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--travel-xlsx", type=Path, default=DEFAULT_TRAVEL_XLSX)
    args = parser.parse_args()

    by_key: dict[str, dict] = {}

    for r in load_travel_agencies(args.travel_xlsx):
        key = norm_key(r["company_name"])
        if not key:
            continue
        extra = json.loads(r["extra_json"]) if r.get("extra_json") else {}
        extra["sources"] = ["ew_travel_agencies_xlsx"]
        by_key[key] = {
            "company_name": r["company_name"],
            "phone": r.get("phone") or "",
            "email": r.get("email") or "",
            "city": r.get("city") or "Bakı",
            "source": r.get("source") or "ew_travel_agencies_xlsx",
            "source_id": r.get("source_id") or "",
            "extra": extra,
        }

    for row in read_csv(TURLAR_CSV):
        name = row.get("name") or ""
        key = norm_key(name)
        if not key:
            continue
        patch_extra = {
            "sources": ["turlar.az"],
            "profile_url": row.get("profile_url") or "",
            "listings_count": row.get("listings_count") or "",
            "description_snippet": row.get("description_snippet") or "",
        }
        if key in by_key:
            cur = by_key[key]
            if not cur["phone"] and row.get("phone"):
                cur["phone"] = row["phone"]
            cur["extra"] = merge_extra(cur["extra"], patch_extra)
            if "turlar.az" not in cur["source"].split("+"):
                cur["source"] = "+".join(dict.fromkeys([*cur["source"].split("+"), "turlar.az"]))
        else:
            by_key[key] = {
                "company_name": name,
                "phone": row.get("phone") or "",
                "email": "",
                "city": "Bakı",
                "source": "turlar.az",
                "source_id": row.get("id") or "",
                "extra": patch_extra,
            }

    for row in read_csv(TRIPPOST_CSV):
        name = row.get("name") or ""
        key = norm_key(name)
        if not key:
            continue
        patch_extra = {
            "sources": ["trippost.az"],
            "profile_url": row.get("profile_url") or "",
            "slug": row.get("slug") or "",
            "tagline": row.get("tagline") or "",
        }
        if key in by_key:
            cur = by_key[key]
            if not cur["phone"] and row.get("phone"):
                cur["phone"] = row["phone"]
            cur["extra"] = merge_extra(cur["extra"], patch_extra)
            if "trippost.az" not in cur["source"].split("+"):
                cur["source"] = "+".join(dict.fromkeys([*cur["source"].split("+"), "trippost.az"]))
        else:
            by_key[key] = {
                "company_name": name,
                "phone": row.get("phone") or "",
                "email": "",
                "city": "Bakı",
                "source": "trippost.az",
                "source_id": row.get("id") or "",
                "extra": patch_extra,
            }

    rows_out = []
    for i, (_, rec) in enumerate(sorted(by_key.items(), key=lambda kv: kv[1]["company_name"].lower()), 1):
        rows_out.append(
            {
                "id": f"travel-{i:04d}",
                "company_name": rec["company_name"],
                "phone": rec["phone"],
                "email": rec["email"],
                "city": rec["city"],
                "source": rec["source"],
                "source_id": rec["source_id"],
                "extra_json": json.dumps(rec["extra"], ensure_ascii=False),
            }
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows_out)

    sources = {"ew": 0, "turlar": 0, "trippost": 0, "merged": 0}
    for rec in by_key.values():
        src = rec["source"]
        parts = set(src.split("+"))
        if len(parts) > 1:
            sources["merged"] += 1
        if "ew_travel_agencies_xlsx" in parts or "ew" in parts:
            sources["ew"] += 1
        if "turlar.az" in parts:
            sources["turlar"] += 1
        if "trippost.az" in parts:
            sources["trippost"] += 1

    print(f"Wrote {len(rows_out)} unique agencies -> {OUT_CSV}")
    print(f"  EW rows: {sources['ew']}, turlar: {sources['turlar']}, trippost: {sources['trippost']}, multi-source: {sources['merged']}")


if __name__ == "__main__":
    main()
