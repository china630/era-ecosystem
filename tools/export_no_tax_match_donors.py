#!/usr/bin/env python3
"""Export donor rows with match_status=no_tax_match from legal-entities CSV."""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "legal-entities" / "azerbaijan-legal-entities.csv"
OUT = ROOT / "data" / "legal-entities" / "azerbaijan-donors-no-tax-match.csv"

FIELDS = [
    "match_status",
    "search_query",
    "donor_sectors",
    "donor_ids",
    "donor_search_names",
    "donor_names",
    "donor_cities",
    "donor_addresses",
    "donor_phones",
    "donor_emails",
    "donor_websites",
    "donor_voens",
    "donor_categories",
    "donor_extra_json",
]


def main() -> None:
    rows = []
    with SRC.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if row.get("match_status") != "no_tax_match":
                continue
            if not (row.get("donor_ids") or row.get("donor_names")):
                continue
            rows.append({k: row.get(k, "") for k in FIELDS})

    rows.sort(key=lambda r: (r.get("donor_sectors") or "", r.get("donor_names") or ""))

    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)

    print(f"Exported {len(rows)} donor rows -> {OUT}")


if __name__ == "__main__":
    main()
