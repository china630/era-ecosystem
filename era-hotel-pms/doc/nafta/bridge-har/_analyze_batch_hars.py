"""Analyze Elektraweb HARs for live bridge discovery. Writes redacted summary."""
from __future__ import annotations

import json
import os
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

DOWNLOADS = Path(r"C:\Users\ASUS G752VT\Downloads")
OUT_DIR = Path(r"d:\My Projects\era-ecosystem\era-hotel-pms\doc\nafta\bridge-har")
OUT_DIR.mkdir(parents=True, exist_ok=True)

HARS = {
    "inhouse": DOWNLOADS / "reservations-inhouse.elektraweb.com.har",
    "folios": DOWNLOADS / "folios.elektraweb.com.har",
    "guests": DOWNLOADS / "guests.elektraweb.com.har",
}


def decode_text(content: dict) -> str | None:
    t = content.get("text")
    if t is None:
        return None
    if content.get("encoding") == "base64":
        import base64

        return base64.b64decode(t).decode("utf-8", "replace")
    return t


def load_har(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def iter_selects(har: dict):
    for e in har["log"]["entries"]:
        url = e["request"]["url"]
        path = urlparse(url).path
        method = e["request"]["method"]
        host = urlparse(url).netloc
        body = decode_text(e["response"].get("content") or {})
        post_raw = (e["request"].get("postData") or {}).get("text") or ""
        post = None
        if post_raw.startswith("{"):
            try:
                post = json.loads(post_raw)
            except json.JSONDecodeError:
                post = None
        data = None
        if body:
            try:
                data = json.loads(body)
            except json.JSONDecodeError:
                data = None
        yield {
            "method": method,
            "host": host,
            "path": path,
            "status": e["response"].get("status"),
            "size": (e["response"].get("content") or {}).get("size") or 0,
            "post": post,
            "data": data,
        }


def rows_from(data: dict | None) -> list[dict]:
    if not data:
        return []
    rs = data.get("ResultSets")
    if isinstance(rs, list) and rs and isinstance(rs[0], list):
        return [r for r in rs[0] if isinstance(r, dict)]
    return []


def filled(rows: list[dict], key: str) -> str:
    if not rows:
        return "0/0"
    n = sum(1 for r in rows if r.get(key) not in (None, ""))
    return f"{n}/{len(rows)}"


def summarize_har(label: str, path: Path) -> list[str]:
    lines: list[str] = []
    lines.append("=" * 72)
    lines.append(f"{label}: {path.name} size_mb={round(path.stat().st_size / 1e6, 2)}")
    har = load_har(path)
    lines.append(f"entries={len(har['log']['entries'])}")

    path_counts: Counter[str] = Counter()
    selects: dict[str, list] = {}

    for item in iter_selects(har):
        if any(x in item["path"] for x in [".js", ".css", ".woff", ".png", ".svg", ".ico", ".map"]):
            continue
        key = f"{item['method']} {item['host']}{item['path']}"
        path_counts[key] += 1
        if "/Select/" in item["path"] and item["data"] and rows_from(item["data"]):
            obj = item["path"].split("/Select/")[-1]
            selects.setdefault(obj, []).append(item)

    lines.append("Top paths:")
    for k, v in path_counts.most_common(25):
        lines.append(f"  {v:3} {k}")

    for obj, items in sorted(selects.items()):
        # pick largest payload
        item = max(items, key=lambda x: x["size"])
        rows = rows_from(item["data"])
        post = item["post"] or {}
        lines.append("")
        lines.append(f"--- Select {obj} ---")
        lines.append(f"rows={len(rows)} size={item['size']} Action={post.get('Action')}")
        where = post.get("Where")
        if where is not None:
            lines.append(f"Where: {json.dumps(where, ensure_ascii=False)[:500]}")
        if not rows:
            continue
        keys = sorted(rows[0].keys())
        lines.append(f"field_count={len(keys)}")
        # interesting keys heuristics
        interesting = [
            k
            for k in keys
            if any(
                s in k.upper()
                for s in (
                    "RES",
                    "GUEST",
                    "STATE",
                    "ROOM",
                    "RATE",
                    "CHECK",
                    "AMOUNT",
                    "PRICE",
                    "INCOME",
                    "REVENUE",
                    "FOLIO",
                    "ID",
                    "NAME",
                    "PASS",
                    "NATIONAL",
                    "PHONE",
                    "DATE",
                    "CODE",
                    "BALANCE",
                )
            )
        ]
        lines.append("interesting_keys: " + ", ".join(interesting[:80]))
        for k in interesting[:40]:
            lines.append(f"  filled {k}: {filled(rows, k)}")

        # state/status distributions
        for sk in ("RESSTATE", "RESSTATEID", "STATE", "STATUS", "STATUSID", "FOLIOSTATE"):
            if sk in rows[0]:
                lines.append(f"{sk} dist: {Counter(str(r.get(sk)) for r in rows).most_common(15)}")

        # sample first row — redact PII-ish values
        sample = rows[0]
        lines.append("sample_nonempty (redacted names/ids partially):")
        for k in sorted(sample.keys()):
            v = sample[k]
            if v in (None, "", False) and v is not True:
                if v in (None, ""):
                    continue
            s = str(v)
            ku = k.upper()
            if any(x in ku for x in ("NAME", "PHONE", "EMAIL", "PASS", "NATIONALID", "TOKEN", "PASSWORD")):
                s = f"<redacted len={len(s)}>"
            elif len(s) > 80:
                s = s[:80] + "..."
            lines.append(f"  {k}: {s}")

    return lines


def main() -> None:
    all_lines: list[str] = []
    for label, path in HARS.items():
        if not path.exists():
            all_lines.append(f"MISSING {label}: {path}")
            continue
        all_lines.extend(summarize_har(label, path))
        all_lines.append("")

    out = OUT_DIR / "_har_batch_summary.txt"
    out.write_text("\n".join(all_lines), encoding="utf-8")
    print(f"WROTE {out}")
    # print without too much noise — path headers + Select objects + state dists
    for line in all_lines:
        if (
            line.startswith("=")
            or line.startswith("---")
            or line.startswith("Top")
            or line.startswith("  ")
            and ("Select/" in line or line.strip()[:1].isdigit())
            or "dist:" in line
            or line.startswith("rows=")
            or line.startswith("Where:")
            or line.startswith("MISSING")
            or line.startswith("inhouse")
            or line.startswith("folios")
            or line.startswith("guests")
            or "field_count" in line
            or line.startswith("interesting")
            or "filled RES" in line
            or "filled GUEST" in line
            or "filled ID:" in line
            or "filled INCOME" in line
            or "filled AMOUNT" in line
            or "filled REVENUE" in line
            or "filled LOCAL" in line
            or "filled ROOMNO" in line
            or "filled CHECK" in line
            or "filled RATE" in line
        ):
            try:
                print(line)
            except UnicodeEncodeError:
                print(line.encode("ascii", "replace").decode())


if __name__ == "__main__":
    main()
