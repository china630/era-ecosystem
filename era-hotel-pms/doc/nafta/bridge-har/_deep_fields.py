"""Deep field check for inhouse / folio / guests HARs."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

DOWNLOADS = Path(r"C:\Users\ASUS G752VT\Downloads")


def decode_text(content):
    t = content.get("text")
    if t is None:
        return None
    if content.get("encoding") == "base64":
        import base64

        return base64.b64decode(t).decode("utf-8", "replace")
    return t


def best_select(har_path: Path, object_substr: str):
    with har_path.open(encoding="utf-8") as f:
        har = json.load(f)
    best = None
    for e in har["log"]["entries"]:
        path = urlparse(e["request"]["url"]).path
        if object_substr not in path:
            continue
        body = decode_text(e["response"].get("content") or {})
        if not body:
            continue
        data = json.loads(body)
        rs = data.get("ResultSets")
        if not (isinstance(rs, list) and rs and isinstance(rs[0], list) and rs[0]):
            continue
        size = (e["response"].get("content") or {}).get("size") or 0
        post = json.loads((e["request"].get("postData") or {}).get("text") or "{}")
        if best is None or size > best[0]:
            best = (size, path, post, rs[0], data)
    return best


def filled(rows, key):
    return sum(1 for r in rows if r.get(key) not in (None, ""))


def dump(label, har_name, obj, keys_to_show):
    p = DOWNLOADS / har_name
    best = best_select(p, obj)
    print("=" * 60)
    print(label, obj)
    if not best:
        print("NOT FOUND")
        return
    size, path, post, rows, data = best
    print(f"path={path} rows={len(rows)} size={size}")
    print("Where:", json.dumps(post.get("Where"), ensure_ascii=False)[:400])
    for k in keys_to_show:
        if k in rows[0]:
            print(f"  filled {k}: {filled(rows, k)}/{len(rows)}")
    for sk in ("RESSTATE", "RESSTATEID", "REVCODE", "DEPCODE"):
        if sk in rows[0]:
            print(f"  {sk}: {Counter(str(r.get(sk)) for r in rows).most_common(12)}")
    # amount-like
    amount_keys = [k for k in rows[0] if any(x in k.upper() for x in ("AMOUNT", "PRICE", "REVENUE", "INCOME", "TOTAL", "DEBIT", "CREDIT", "NET"))]
    print("  amount-like keys:", amount_keys)
    for k in amount_keys:
        print(f"  filled {k}: {filled(rows, k)}/{len(rows)} sample={rows[0].get(k)}")
    # sample mapping fields
    print("  SAMPLE keys of interest:")
    for k in keys_to_show:
        if k in rows[0]:
            v = rows[0].get(k)
            if any(x in k.upper() for x in ("NAME", "PHONE", "PASS", "NATIONALID")):
                v = f"<redacted>"
            print(f"    {k}: {v}")


dump(
    "INHOUSE",
    "reservations-inhouse.elektraweb.com.har",
    "QA_HOTEL_RESERVATION",
    [
        "RESID",
        "ID",
        "RESSTATE",
        "RESSTATEID",
        "RESGUESTID",
        "CONTACTGUESTID",
        "GUESTNAMES",
        "ROOMNO",
        "ROOMTYPECODE",
        "RATECODE",
        "RATECODEID",
        "CHECKIN",
        "CHECKOUT",
        "ADULT",
        "AGENCY",
        "GUESTBALANCE",
        "GENERALBALANCE",
    ],
)

dump(
    "FOLIO LIST",
    "folios.elektraweb.com.har",
    "Q_HOTELFOLIOACTION",
    [
        "ID",
        "RESID",
        "INITIALRESID",
        "REVCODE",
        "REVID",
        "REVENUE",
        "TDATE",
        "ROOMNO",
        "GUESTNAMES",
        "FULLNAME",
        "RESSTATEID",
        "DEPCODE",
        "CURRID_CURCODE",
        "VAT1AMOUNT",
        "VAT2AMOUNT",
        "AGENCYID",
        "POSCHECKID",
    ],
)

dump(
    "FOLIO DETAIL",
    "folios.elektraweb.com.har",
    "HOTEL_FOLIOTRANS",
    [
        "ID",
        "RESID",
        "INITIALRESID",
        "REVID",
        "REVID_REVENUENAME",
        "CURRID_CURCODE",
        "TDATE",
        "RESID_ROOMNO",
        "RESID_GUESTNAMES",
        "DEPID_DEPARTMENTNAME",
        "STAFF_USERCODE",
        "CREATION_DATE",
    ],
)

dump(
    "GUEST LIST",
    "guests.elektraweb.com.har",
    "QG_HOTEL_GUEST_SIMPLE",
    [
        "ID",
        "ELEKTRAID",
        "NAME",
        "LNAME",
        "FULLNAME",
        "NATIONALIDNO",
        "PASSPORTNO",
        "PHONE",
        "BIRTHDATE",
        "GUEST_NATIONALITY_CODE2",
        "COUNTRYCODE",
        "EMAIL",
        "VIPTYPEID",
        "VIPNAME",
        "FIRSTVISITCHECKIN",
        "LASTVISITCHECKIN",
    ],
)

dump(
    "GUEST RECORD",
    "guests.elektraweb.com.har",
    "QA_HOTEL_GUEST_RECORD",
    [
        "ID",
        "NAME",
        "LNAME",
        "NATIONALIDNO",
        "PASSPORTNO",
        "PHONE",
        "BIRTHDATE",
        "GUEST_NATIONALITY_CODE2",
        "EMAIL",
        "VIPTYPEID",
        "FIRSTCHECKIN",
        "LASTCHECKIN",
    ],
)

dump(
    "GUEST ID DOC",
    "guests.elektraweb.com.har",
    "QG_HOTEL_GUEST_ID",
    ["GUESTID", "ID_NUMBER", "ID_TYPEID", "ID_FIRSTNAME", "ID_LASTNAME", "PASSTYPEID"],
)
