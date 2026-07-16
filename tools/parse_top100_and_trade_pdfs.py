#!/usr/bin/env python3
"""Parse official Top-100 taxpayer PDFs + Green Corridor import/export lists to CSV."""

from __future__ import annotations

import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def parse_top100(text: str, list_kind: str, year: str) -> list[dict]:
    rows: list[dict] = []
    # Amounts: 11,2 | 46,4 | 1.508,0 (thousands with dot)
    pat = re.compile(
        r"^(\d{1,3})\s+(.+?)\s+((?:\d{1,3}\.)*\d{1,4}(?:[.,]\d+)?)\s*$",
        re.M,
    )
    for m in pat.finditer(text):
        rank = int(m.group(1))
        name = m.group(2).strip()
        raw_amt = m.group(3)
        # 1.508,0 → 1508.0 ; 46,4 → 46.4
        if "," in raw_amt and "." in raw_amt:
            amount = raw_amt.replace(".", "").replace(",", ".")
        else:
            amount = raw_amt.replace(",", ".")
        if rank < 1 or rank > 100:
            continue
        if len(name) < 5:
            continue
        rows.append(
            {
                "rank": rank,
                "name": name,
                "amount_mln_azn": amount,
                "list_kind": list_kind,
                "year": year,
                "source": "taxes.gov.az",
            }
        )
    by_rank: dict[int, dict] = {}
    for r in rows:
        by_rank.setdefault(r["rank"], r)
    return [by_rank[k] for k in sorted(by_rank)]


def parse_green_corridor(text: str, direction: str) -> list[dict]:
    rows: list[dict] = []
    pat = re.compile(r"^(\d{1,4})\s+(.+?)\s*$", re.M)
    for m in pat.finditer(text):
        n = int(m.group(1))
        name = m.group(2).strip()
        if n < 1 or len(name) < 3:
            continue
        # skip headers
        if "siyahısı" in name.lower() or "əməliyyat" in name.lower():
            continue
        rows.append(
            {
                "seq": n,
                "name": name,
                "direction": direction,
                "source": "customs.gov.az green-corridor",
                "source_url": (
                    "https://customs.gov.az/uploads/pdfcontent/import.pdf"
                    if direction == "import"
                    else "https://customs.gov.az/uploads/pdfcontent/export.pdf"
                ),
            }
        )
    by_seq: dict[int, dict] = {}
    for r in rows:
        by_seq.setdefault(r["seq"], r)
    return [by_seq[k] for k in sorted(by_seq)]


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} → {path}")


def main() -> None:
    top_dir = ROOT / "data" / "top-taxpayers"
    trade_dir = ROOT / "data" / "trade-participants"

    paid = (top_dir / ".cache" / "2025_1.txt").read_text(encoding="utf-8")
    calc = (top_dir / ".cache" / "2025_top100.txt").read_text(encoding="utf-8")

    paid_rows = parse_top100(paid, "paid_taxes", "2025")
    calc_rows = parse_top100(calc, "calculated_ex_vat_excise", "2025")
    write_csv(
        top_dir / "azerbaijan-top100-taxpayers-2025-paid.csv",
        paid_rows,
        ["rank", "name", "amount_mln_azn", "list_kind", "year", "source"],
    )
    write_csv(
        top_dir / "azerbaijan-top100-taxpayers-2025-calculated.csv",
        calc_rows,
        ["rank", "name", "amount_mln_azn", "list_kind", "year", "source"],
    )

    # merged unique names
    merged: dict[str, dict] = {}
    for r in paid_rows + calc_rows:
        key = re.sub(r"\s+", " ", r["name"]).upper()
        ex = merged.get(key)
        if not ex:
            merged[key] = {
                "name": r["name"],
                "rank_paid": r["rank"] if r["list_kind"] == "paid_taxes" else "",
                "rank_calculated": r["rank"] if r["list_kind"] != "paid_taxes" else "",
                "amount_paid_mln": r["amount_mln_azn"] if r["list_kind"] == "paid_taxes" else "",
                "amount_calculated_mln": r["amount_mln_azn"] if r["list_kind"] != "paid_taxes" else "",
                "year": "2025",
                "source": "taxes.gov.az Top100",
            }
        else:
            if r["list_kind"] == "paid_taxes":
                ex["rank_paid"] = r["rank"]
                ex["amount_paid_mln"] = r["amount_mln_azn"]
            else:
                ex["rank_calculated"] = r["rank"]
                ex["amount_calculated_mln"] = r["amount_mln_azn"]

    write_csv(
        top_dir / "azerbaijan-top100-taxpayers-2025.csv",
        list(merged.values()),
        [
            "name",
            "rank_paid",
            "rank_calculated",
            "amount_paid_mln",
            "amount_calculated_mln",
            "year",
            "source",
        ],
    )

    imp = parse_green_corridor(
        (trade_dir / ".cache" / "green-corridor-import.txt").read_text(encoding="utf-8"),
        "import",
    )
    exp = parse_green_corridor(
        (trade_dir / ".cache" / "green-corridor-export.txt").read_text(encoding="utf-8"),
        "export",
    )
    write_csv(
        trade_dir / "azerbaijan-green-corridor-importers.csv",
        imp,
        ["seq", "name", "direction", "source", "source_url"],
    )
    write_csv(
        trade_dir / "azerbaijan-green-corridor-exporters.csv",
        exp,
        ["seq", "name", "direction", "source", "source_url"],
    )

    # merge unique trade names
    trade: dict[str, dict] = {}
    for r in imp + exp:
        key = re.sub(r"\s+", " ", r["name"]).upper()
        ex = trade.get(key)
        if not ex:
            trade[key] = {
                "name": r["name"],
                "is_importer": "yes" if r["direction"] == "import" else "",
                "is_exporter": "yes" if r["direction"] == "export" else "",
                "source": "customs.gov.az Green Corridor",
            }
        else:
            if r["direction"] == "import":
                ex["is_importer"] = "yes"
            else:
                ex["is_exporter"] = "yes"
    write_csv(
        trade_dir / "azerbaijan-green-corridor-trade-participants.csv",
        list(trade.values()),
        ["name", "is_importer", "is_exporter", "source"],
    )


if __name__ == "__main__":
    main()
