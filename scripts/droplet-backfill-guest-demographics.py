#!/usr/bin/env python3
"""Fill hotel Guest + MDM + clinic PatientRef sex/DOB from EW overlay (fill-not-clear)."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import date

OVERLAY = "/tmp/guest-demographics-overlay.json"


def run(cmd: list[str], input_text: str | None = None) -> str:
    p = subprocess.run(cmd, input=input_text, text=True, capture_output=True)
    if p.returncode != 0:
        sys.stderr.write(p.stderr or "")
        raise SystemExit(f"cmd failed: {' '.join(cmd[:8])}")
    return (p.stdout or "").strip()


def psql_tuples(db: str, sql: str) -> list[tuple[str, ...]]:
    out = run(
        [
            "docker",
            "exec",
            "-i",
            "era-postgres",
            "psql",
            "-U",
            "era",
            "-d",
            db,
            "-A",
            "-t",
            "-F",
            "\t",
            "-c",
            sql,
        ]
    )
    rows = []
    for line in out.splitlines():
        if not line.strip():
            continue
        rows.append(tuple(line.split("\t")))
    return rows


def psql_exec(db: str, sql: str) -> str:
    return run(
        ["docker", "exec", "-i", "era-postgres", "psql", "-U", "era", "-d", db],
        input_text=sql,
    )


def fold_name(value: str) -> str:
    s = (value or "").strip().lower()
    trans = str.maketrans({"ə": "e", "ı": "i", "ö": "o", "ü": "u", "ş": "s", "ç": "c", "ğ": "g"})
    s = s.translate(trans)
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def sql_str(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + value.replace("'", "''") + "'"


def sql_date(value: str | None) -> str:
    if not value:
        return "NULL"
    return "'" + value + "'::date"


def hotel_sex_to_person(sex: str | None) -> str | None:
    if sex == "M":
        return "MALE"
    if sex == "F":
        return "FEMALE"
    return None


def main() -> None:
    with open(OVERLAY, encoding="utf-8") as f:
        overlay = json.load(f)
    by_id: dict = overlay.get("byId") or {}
    name_unique: dict = overlay.get("nameUnique") or {}

    guests = psql_tuples(
        "era_hotel_pms",
        """
        SELECT id::text, COALESCE(\"fullName\",''), COALESCE(\"externalRef\",''),
               COALESCE(gender::text,''), COALESCE(\"birthDate\"::text,''),
               COALESCE(\"globalPersonId\"::text,''), 'x'
        FROM \"Guest\"
        WHERE \"globalPersonId\" IS NOT NULL
        """,
    )

    hotel_updates = []
    matched_id = 0
    matched_name = 0
    unmatched = 0
    for gid, full_name, ext, gender, dob, gpid, _sent in guests:
        rec = by_id.get(ext) if ext else None
        via = "id"
        if not rec or (not rec.get("sex") and not rec.get("birthDate")):
            rec = name_unique.get(fold_name(full_name))
            via = "name"
        if not rec:
            unmatched += 1
            continue
        if via == "id":
            matched_id += 1
        else:
            matched_name += 1
        next_gender = rec.get("sex") or None
        next_dob = rec.get("birthDate") or None
        set_gender = next_gender if not gender and next_gender else None
        set_dob = next_dob if not dob and next_dob else None
        if set_gender or set_dob:
            hotel_updates.append((gid, set_gender, set_dob, gpid, hotel_sex_to_person(next_gender), next_dob))

    hotel_sql_parts = []
    mdm_sql_parts = []
    for gid, set_gender, set_dob, gpid, person_sex, next_dob in hotel_updates:
        sets = []
        if set_gender:
            sets.append(f"gender = {sql_str(set_gender)}")
        if set_dob:
            sets.append(f"\"birthDate\" = {sql_date(set_dob)}")
        if sets:
            hotel_sql_parts.append(
                f"UPDATE \"Guest\" SET {', '.join(sets)} WHERE id = {sql_str(gid)};"
            )
        mdm_sets = []
        if person_sex:
            mdm_sets.append(
                f"sex = CASE WHEN sex IS NULL OR sex = 'UNKNOWN' THEN {sql_str(person_sex)} ELSE sex END"
            )
        if next_dob:
            mdm_sets.append(
                f"birth_date = COALESCE(birth_date, {sql_date(next_dob)})"
            )
        if mdm_sets and gpid:
            mdm_sql_parts.append(
                f"UPDATE global_natural_persons SET {', '.join(mdm_sets)} WHERE id = {sql_str(gpid)};"
            )

    if hotel_sql_parts:
        psql_exec("era_hotel_pms", "\n".join(hotel_sql_parts))
    if mdm_sql_parts:
        psql_exec("era_mdm", "\n".join(mdm_sql_parts))

    patients = psql_tuples(
        "era_clinic",
        """
        SELECT id::text, COALESCE(\"globalPersonId\"::text,''), COALESCE(sex::text,''), COALESCE(\"birthDate\"::text,''), 'x'
        FROM \"PatientRef\"
        WHERE \"globalPersonId\" IS NOT NULL
        """,
    )
    mdm_rows = psql_tuples(
        "era_mdm",
        "SELECT id::text, COALESCE(sex::text,''), COALESCE(birth_date::text,''), 'x' FROM global_natural_persons",
    )
    mdm = {r[0]: (r[1], r[2]) for r in mdm_rows}
    clinic_sql = []
    for pid, gpid, sex, dob, _sent in patients:
        row = mdm.get(gpid)
        if not row:
            continue
        m_sex, m_dob = row
        sets = []
        if (not sex or sex == "UNKNOWN") and m_sex in ("MALE", "FEMALE"):
            sets.append(f"sex = {sql_str(m_sex)}")
        if not dob and m_dob:
            sets.append(f"\"birthDate\" = {sql_date(m_dob[:10])}")
        if sets:
            clinic_sql.append(
                f"UPDATE \"PatientRef\" SET {', '.join(sets)} WHERE id = {sql_str(pid)};"
            )
    if clinic_sql:
        psql_exec("era_clinic", "\n".join(clinic_sql))

    hotel_after = psql_tuples(
        "era_hotel_pms",
        """
        SELECT count(*) FILTER (WHERE gender IS NOT NULL)::text,
               count(*) FILTER (WHERE \"birthDate\" IS NOT NULL)::text,
               count(*)::text
        FROM \"Guest\" WHERE \"globalPersonId\" IS NOT NULL
        """,
    )
    clinic_after = psql_tuples(
        "era_clinic",
        """
        SELECT count(*) FILTER (WHERE sex IN ('MALE','FEMALE'))::text,
               count(*) FILTER (WHERE \"birthDate\" IS NOT NULL)::text,
               count(*)::text
        FROM \"PatientRef\"
        """,
    )
    print(
        json.dumps(
            {
                "guests": len(guests),
                "matchedId": matched_id,
                "matchedName": matched_name,
                "unmatched": unmatched,
                "hotelUpdates": len(hotel_updates),
                "mdmUpdates": len(mdm_sql_parts),
                "hotelAfter": {"gender": hotel_after[0][0], "dob": hotel_after[0][1], "n": hotel_after[0][2]},
                "clinicAfter": {"sex": clinic_after[0][0], "dob": clinic_after[0][1], "n": clinic_after[0][2]},
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
