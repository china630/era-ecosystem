#!/usr/bin/env python3
"""Diagnose hotel guest overlay misses; copy hotel sex/DOB onto clinic PatientRef."""
from __future__ import annotations

import json
import re
import subprocess
import sys

OVERLAY = "/tmp/guest-demographics-overlay.json"


def run(cmd, input_text=None):
    p = subprocess.run(cmd, input=input_text, text=True, capture_output=True)
    if p.returncode != 0:
        sys.stderr.write(p.stderr or "")
        raise SystemExit(p.stderr)
    return (p.stdout or "").strip()


def psql(db, sql):
    return run(
        ["docker", "exec", "-i", "era-postgres", "psql", "-U", "era", "-d", db, "-A", "-t", "-F", "\t", "-c", sql]
    )


def fold_name(value: str) -> str:
    s = (value or "").strip().lower()
    trans = str.maketrans({"ə": "e", "ı": "i", "ö": "o", "ü": "u", "ş": "s", "ç": "c", "ğ": "g"})
    s = s.translate(trans)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def sql_str(v):
    return "'" + v.replace("'", "''") + "'"


def sql_date(v):
    return "'" + v + "'::date"


overlay = json.load(open(OVERLAY, encoding="utf-8"))
by_id = overlay.get("byId") or {}
name_unique = overlay.get("nameUnique") or {}

raw = psql(
    "era_hotel_pms",
    """
    SELECT g.id::text, COALESCE(g.\"fullName\",''), COALESCE(g.\"externalRef\",''),
           COALESCE(g.gender::text,''), COALESCE(g.\"birthDate\"::text,''),
           COALESCE(g.\"globalPersonId\"::text,''), 'x'
    FROM \"Guest\" g
    WHERE g.\"globalPersonId\" IS NOT NULL
    """,
)
guests = []
for line in raw.splitlines():
    parts = line.split("\t")
    if len(parts) < 7:
        continue
    guests.append(parts)

miss = []
for gid, name, ext, gender, dob, gpid, _ in guests:
    rec = by_id.get(ext)
    if rec and (rec.get("sex") or rec.get("birthDate")):
        continue
    nu = name_unique.get(fold_name(name))
    if nu and (nu.get("sex") or nu.get("birthDate")):
        continue
    miss.append({"name": name, "externalRef": ext, "gender": gender, "dob": dob[:10] if dob else ""})

print(json.dumps({"linkedGuests": len(guests), "miss": len(miss), "sampleMiss": miss[:12]}, ensure_ascii=False, indent=2))

# Copy hotel → clinic by globalPersonId (fill-not-clear)
hotel_demo = {}
for gid, name, ext, gender, dob, gpid, _ in guests:
    hotel_demo[gpid] = (gender, dob[:10] if dob else "")

praw = psql(
    "era_clinic",
    """
    SELECT id::text, COALESCE(\"globalPersonId\"::text,''), COALESCE(sex::text,''), COALESCE(\"birthDate\"::text,''), 'x'
    FROM \"PatientRef\" WHERE \"globalPersonId\" IS NOT NULL
    """,
)
sqls = []
filled = 0
for line in praw.splitlines():
    parts = line.split("\t")
    if len(parts) < 5:
        continue
    pid, gpid, sex, dob, _ = parts
    h = hotel_demo.get(gpid)
    if not h:
        continue
    h_sex, h_dob = h
    person_sex = "MALE" if h_sex == "M" else "FEMALE" if h_sex == "F" else None
    sets = []
    if (not sex or sex == "UNKNOWN") and person_sex:
        sets.append(f"sex = {sql_str(person_sex)}")
    if not dob and h_dob:
        sets.append(f"\"birthDate\" = {sql_date(h_dob)}")
    if sets:
        filled += 1
        sqls.append(f"UPDATE \"PatientRef\" SET {', '.join(sets)} WHERE id = {sql_str(pid)};")

if sqls:
    run(["docker", "exec", "-i", "era-postgres", "psql", "-U", "era", "-d", "era_clinic"], input_text="\n".join(sqls))

after = psql(
    "era_clinic",
    """
    SELECT count(*) FILTER (WHERE sex::text IN ('MALE','FEMALE'))::text,
           count(*) FILTER (WHERE \"birthDate\" IS NOT NULL)::text,
           count(*)::text, 'x'
    FROM \"PatientRef\"
    """,
)
print(json.dumps({"clinicCopiedFromHotel": filled, "clinicAfter": after}, indent=2))
