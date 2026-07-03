#!/usr/bin/env python3
"""Import customs brokers from State Customs Committee PDF registry."""

from __future__ import annotations

import csv
import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "legal"
CACHE_DIR = OUT_DIR / ".cache"
DEFAULT_PDF_URL = (
    "https://customs.gov.az/uploads/representative/7/"
    "2e69c2ce14c4bbb93388ea4a58387f2f.pdf?v=1771238095"
)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

LINE_RE = re.compile(r"^\s*(\d+)\.\s+(.+?)\s*$")


def fetch_pdf(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": UA, "Accept-Language": "az"})
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            with urlopen(req, timeout=120) as resp:
                return resp.read()
        except (HTTPError, URLError, TimeoutError) as err:
            last_err = err
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed to download PDF: {last_err}")


def extract_pdf_text(pdf_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as err:
        raise SystemExit(
            "pypdf required: python -m pip install pypdf"
        ) from err
    import io

    reader = PdfReader(io.BytesIO(pdf_bytes))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def normalize_name_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", name.lower())


def parse_brokers(text: str) -> list[dict]:
    rows: list[dict] = []
    for line in text.splitlines():
        if line.startswith("--- page"):
            continue
        m = LINE_RE.match(line)
        if not m:
            continue
        registry_no = int(m.group(1))
        name = m.group(2).strip()
        if len(name) < 3:
            continue
        rows.append({"registry_number": registry_no, "name": name})
    return rows


def dedupe(rows: list[dict]) -> list[dict]:
    by_key: dict[str, dict] = {}
    for row in rows:
        key = normalize_name_key(row["name"])
        if key not in by_key or row["registry_number"] < by_key[key]["registry_number"]:
            by_key[key] = row
    return sorted(by_key.values(), key=lambda r: r["registry_number"])


def main() -> None:
    import os

    url = os.environ.get("CUSTOMS_BROKERS_PDF_URL", DEFAULT_PDF_URL)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    pdf_path = CACHE_DIR / "customs-brokers-registry.pdf"
    pdf_bytes = fetch_pdf(url)
    pdf_path.write_bytes(pdf_bytes)

    text = extract_pdf_text(pdf_bytes)
    unique = dedupe(parse_brokers(text))

    fields = [
        "id",
        "name",
        "firm_type",
        "registry_number",
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
    out_path = OUT_DIR / "azerbaijan-customs-brokers.csv"
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for i, row in enumerate(unique, 1):
            writer.writerow(
                {
                    "id": f"customs-broker-{i:03d}",
                    "name": row["name"],
                    "firm_type": "customs_broker",
                    "registry_number": row["registry_number"],
                    "director": "",
                    "city": "",
                    "address": "",
                    "phones": "",
                    "email": "",
                    "community_id": "",
                    "lawyers_search_url": "",
                    "has_cabinets": "",
                    "source": "customs.gov.az",
                    "source_url": url.split("?")[0],
                }
            )

    stats = {
        "registry_entries_parsed": len(parse_brokers(text)),
        "unique_brokers": len(unique),
        "pdf_pages": text.count("--- page") or None,
        "source": "customs.gov.az/uploads/representative",
        "pdf_cached": str(pdf_path.relative_to(ROOT)).replace("\\", "/"),
    }
    try:
        from pypdf import PdfReader
        import io

        stats["pdf_pages"] = len(PdfReader(io.BytesIO(pdf_bytes)).pages)
    except Exception:
        pass

    (OUT_DIR / ".customs-brokers-stats.json").write_text(
        json.dumps(stats, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
