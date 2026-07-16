import json
import os
from collections import Counter
from urllib.parse import urlparse

har_path = r"C:\Users\ASUS G752VT\Downloads\reservations.elektraweb.com.har"
out_dir = r"d:\My Projects\era-ecosystem\era-hotel-pms\doc\nafta\bridge-har"
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "_reservations_har_summary.txt")

with open(har_path, "r", encoding="utf-8") as f:
    har = json.load(f)


def decode_text(content):
    t = content.get("text")
    if t is None:
        return None
    if content.get("encoding") == "base64":
        import base64

        return base64.b64decode(t).decode("utf-8", "replace")
    return t


def get_data(object_name):
    for e in har["log"]["entries"]:
        path = urlparse(e["request"]["url"]).path
        if object_name not in path:
            continue
        body = decode_text(e["response"].get("content") or {})
        if not body:
            continue
        return e, json.loads(body)
    return None, None


lines: list[str] = []


def log(s: str = "") -> None:
    lines.append(s)


e, data = get_data("QA_HOTEL_RESERVATION_RESERVATION")
url = e["request"]["url"]
log(f"API host: {urlparse(url).netloc}")
headers = {h["name"].lower(): h["value"] for h in e["request"]["headers"]}
for name, val in sorted(headers.items()):
    if name in ("authorization", "cookie", "origin", "referer", "content-type") or name.startswith("x-"):
        v = val
        if name in ("authorization", "cookie") or "token" in name:
            v = f"{val[:16]}...<redacted len={len(val)}>"
        log(f"header {name}: {v}")

pd = (e["request"].get("postData") or {}).get("text", "")
post = json.loads(pd) if pd else {}
log(f"request Action/Object: {post.get('Action')} / {post.get('Object')}")
log(f"has LoginToken: {'LoginToken' in post} len={len(post.get('LoginToken') or '')}")
log(f"Select fields count: {len(post.get('Select') or [])}")
for k in ("Where", "Parameters", "Filter", "OrderBy", "Take", "Skip", "Page", "Top"):
    if k in post:
        log(f"post.{k}: {json.dumps(post[k], ensure_ascii=False)[:400]}")

rows = data["ResultSets"][0]
log(f"list rows: {len(rows)} TotalCount={data.get('TotalCount')}")
log(f"RESSTATE: {Counter(r.get('RESSTATE') for r in rows).most_common()}")
log(f"RESSTATEID: {Counter(r.get('RESSTATEID') for r in rows).most_common()}")


def filled(key: str) -> int:
    return sum(1 for r in rows if r.get(key) not in (None, ""))


for k in [
    "RESGUESTID",
    "CONTACTGUESTID",
    "GUESTNAMES",
    "RATECODE",
    "RATECODEID",
    "ROOMNO",
    "CHECKIN",
    "CHECKOUT",
    "RESID",
]:
    log(f"list field filled {k}: {filled(k)}/{len(rows)}")

log("first 5 (RESID, RESGUESTID, CONTACTGUESTID, name, state, rate, room):")
for r in rows[:5]:
    log(
        f"  {r.get('RESID')}, {r.get('RESGUESTID')}, {r.get('CONTACTGUESTID')}, "
        f"{r.get('GUESTNAMES')}, {r.get('RESSTATE')}, {r.get('RATECODE')}, {r.get('ROOMNO')}"
    )

_, detail = get_data("QA_EASYPMS_RESDETAIL")
drows = detail["ResultSets"][0]
log(f"detail rows: {len(drows)}")
if drows:
    row = drows[0]
    log("DETAIL keys with values:")
    for k in sorted(row.keys()):
        v = row[k]
        if v in (None, ""):
            continue
        log(f"  {k}: {v}")

_, guests = get_data("QA_HOTEL_RES_GUEST")
grows = guests["ResultSets"][0]
log(f"res guests: {len(grows)}")
for i, row in enumerate(grows):
    log(
        f"guest[{i}]: GUESTID={row.get('GUESTID')} RESID={row.get('RESID')} "
        f"NAME={row.get('NAME')} LNAME={row.get('LNAME')} "
        f"NATID={row.get('NATIONALIDNO')} PASS={row.get('PASSPORTNO')} PHONE={row.get('PHONE')}"
    )

log("")
log("All non-static paths:")
c: Counter[str] = Counter()
for entr in har["log"]["entries"]:
    path = urlparse(entr["request"]["url"]).path
    if any(x in path for x in [".js", ".css", ".woff", ".png", ".svg", ".ico", ".map"]):
        continue
    host = urlparse(entr["request"]["url"]).netloc
    c[f"{entr['request']['method']} {host}{path}"] += 1
for k, v in c.most_common():
    log(f"  {v} {k}")

with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"WROTE {out_path}")
# also print to console without guest PII excess
for line in lines:
    if "PASS=" in line or "NATID=" in line or "PHONE=" in line:
        # redact in console
        print(line.split("NAME=")[0] + "NAME=<redacted in console>")
    else:
        try:
            print(line)
        except UnicodeEncodeError:
            print(line.encode("ascii", "replace").decode("ascii"))
