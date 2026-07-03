#!/usr/bin/env python3
"""Export travel agencies from EW Excel to data/travel-agencies/."""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collect_baku_plaza_tenants import DEFAULT_TRAVEL_XLSX, load_travel_agencies

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "travel-agencies"
OUT_CSV = OUT_DIR / "azerbaijan-travel-agencies.csv"

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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--travel-xlsx", type=Path, default=DEFAULT_TRAVEL_XLSX)
    args = parser.parse_args()

    raw = load_travel_agencies(args.travel_xlsx)
    rows = [
        {
            "id": r["tenant_id"],
            "company_name": r["company_name"],
            "phone": r["phone"],
            "email": r["email"],
            "city": r["city"],
            "source": r["source"],
            "source_id": r["source_id"],
            "extra_json": r["extra_json"],
        }
        for r in raw
    ]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} -> {OUT_CSV}")


if __name__ == "__main__":
    main()
