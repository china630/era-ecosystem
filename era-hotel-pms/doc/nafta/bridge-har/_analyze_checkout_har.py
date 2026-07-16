"""Analyze checkout-mixed reservations HAR for RESSTATE mapping."""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

HAR = Path(r"C:\Users\ASUS G752VT\Downloads\reservations-checkout.elektraweb.com.har")


def decode_text(content):
    t = content.get("text")
    if t is None:
        return None
    if content.get("encoding") == "base64":
        import base64

        return base64.b64decode(t).decode("utf-8", "replace")
    return t


def main() -> None:
    with HAR.open(encoding="utf-8") as f:
        har = json.load(f)

    print(f"file={HAR.name} size_mb={round(HAR.stat().st_size/1e6,2)} entries={len(har['log']['entries'])}")

    path_counts: Counter[str] = Counter()
    selects: dict[str, list] = defaultdict(list)

    for e in har["log"]["entries"]:
        url = e["request"]["url"]
        path = urlparse(url).path
        host = urlparse(url).netloc
        method = e["request"]["method"]
        if any(x in path for x in [".js", ".css", ".woff", ".png", ".svg", ".ico", ".map"]):
            continue
        path_counts[f"{method} {host}{path}"] += 1
        body = decode_text(e["response"].get("content") or {})
        if not body or "/Select/" not in path:
            continue
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            continue
        rs = data.get("ResultSets")
        if not (isinstance(rs, list) and rs and isinstance(rs[0], list) and rs[0]):
            continue
        post_raw = (e["request"].get("postData") or {}).get("text") or "{}"
        try:
            post = json.loads(post_raw)
        except json.JSONDecodeError:
            post = {}
        obj = path.split("/Select/")[-1]
        size = (e["response"].get("content") or {}).get("size") or 0
        selects[obj].append((size, post, rs[0], path))

    print("Top paths:")
    for k, v in path_counts.most_common(20):
        print(f"  {v:3} {k}")

    for obj, items in sorted(selects.items()):
        items.sort(key=lambda x: -x[0])
        size, post, rows, path = items[0]
        print("=" * 60)
        print(f"Select {obj} path={path} rows={len(rows)} size={size} captures={len(items)}")
        print("Where:", json.dumps(post.get("Where"), ensure_ascii=False)[:500])
        if "RESSTATE" in rows[0] or "RESSTATEID" in rows[0]:
            print("RESSTATE:", Counter(str(r.get("RESSTATE")) for r in rows).most_common(20))
            print("RESSTATEID:", Counter(str(r.get("RESSTATEID")) for r in rows).most_common(20))
            # cross tab
            pairs = Counter((str(r.get("RESSTATEID")), str(r.get("RESSTATE"))) for r in rows)
            print("ID→STATE pairs:", pairs.most_common(20))
        # if multiple captures, merge all for state map
        if len(items) > 1 and ("RESSTATE" in rows[0] or "RESSTATEID" in rows[0]):
            all_rows = []
            for _, _, rws, _ in items:
                all_rows.extend(rws)
            pairs = Counter((str(r.get("RESSTATEID")), str(r.get("RESSTATE"))) for r in all_rows)
            print(f"ALL CAPTURES merged rows={len(all_rows)} pairs:", pairs.most_common(30))

        # guest id fill if reservation-like
        for k in ("RESGUESTID", "CONTACTGUESTID", "RESID", "ROOMNO", "CHECKIN", "CHECKOUT"):
            if k in rows[0]:
                n = sum(1 for r in rows if r.get(k) not in (None, ""))
                print(f"  filled {k}: {n}/{len(rows)}")


if __name__ == "__main__":
    main()
