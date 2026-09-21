#!/usr/bin/env python3
"""Run ON the droplet (root). Fix orch URL, MDM-link in-house guests, replay check-in events."""
from __future__ import annotations

import json
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone


def run(cmd: list[str], input_text: str | None = None) -> str:
    p = subprocess.run(cmd, input=input_text, text=True, capture_output=True)
    if p.returncode != 0:
        sys.stderr.write(p.stderr or "")
        raise SystemExit(f"cmd failed ({p.returncode}): {' '.join(cmd[:8])}")
    return (p.stdout or "").strip()


def psql(db: str, sql: str) -> str:
    return run(
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
        ],
        sql,
    )


def stamp_url(db: str) -> str:
    return psql(
        db,
        """
UPDATE "_era_runtime_config"
SET "configJson" = jsonb_set(
  COALESCE("configJson"::jsonb, '{}'::jsonb),
  '{orchestratorEventUrl}',
  '"http://orchestrator:4000"'::jsonb,
  true
)::text,
"updatedAt" = NOW(),
"updatedBy" = 'droplet-replay-checkin'
WHERE id = 1;
SELECT COALESCE("configJson"::jsonb->>'orchestratorEventUrl', 'MISSING');
""",
    )


def orch_post(path: str, token: str, body: dict) -> str:
    raw = json.dumps(body, ensure_ascii=False)
    open("/tmp/era-replay-body.json", "w", encoding="utf-8").write(raw)
    run(["docker", "cp", "/tmp/era-replay-body.json", "era-orchestrator:/tmp/era-replay-body.json"])
    quoted = token.replace("'", "'\\''")
    p = subprocess.run(
        [
            "docker",
            "exec",
            "era-orchestrator",
            "sh",
            "-lc",
            "wget -qO- --header='Authorization: Bearer "
            + quoted
            + "' --header='Content-Type: application/json' --header='x-service-token: "
            + quoted
            + "' --post-file=/tmp/era-replay-body.json 'http://127.0.0.1:4000"
            + path
            + "' 2>/tmp/era-wget.err; echo EXIT:$?",
        ],
        text=True,
        capture_output=True,
    )
    out = ((p.stdout or "") + (p.stderr or "")).strip()
    return out


def main() -> None:
    print("== stamp orchestratorEventUrl")
    print("hotel", stamp_url("era_hotel_pms"))
    print("clinic", stamp_url("era_clinic"))

    ep = psql(
        "era_orchestrator",
        """SELECT satellite_key || ' ' || base_url
           FROM satellite_endpoints
           WHERE satellite_key = 'industry_clinic' AND enabled IS TRUE;""",
    )
    print("clinic endpoint:", ep or "(none)")
    if "127.0.0.1" in ep or "localhost" in ep:
        print("rewrite clinic SatelliteEndpoint → http://era-clinic:3203")
        psql(
            "era_orchestrator",
            """UPDATE satellite_endpoints
               SET base_url = 'http://era-clinic:3203', updated_at = NOW()
               WHERE satellite_key = 'industry_clinic'
                 AND (base_url ILIKE '%127.0.0.1%' OR base_url ILIKE '%localhost%');""",
        )

    print("== restart orch, hotel, clinic")
    run(["docker", "restart", "era-orchestrator"])
    time.sleep(12)
    run(["docker", "restart", "era-hotel-pms", "era-clinic"])
    time.sleep(10)

    token = run(["docker", "exec", "era-hotel-pms", "printenv", "SATELLITE_EVENT_SERVICE_TOKEN"])
    if not token:
        raise SystemExit("SATELLITE_EVENT_SERVICE_TOKEN empty")
    org = psql(
        "era_hotel_pms",
        'SELECT "organizationId" FROM "_era_organization_bind" WHERE id = 1;',
    )
    if not org:
        raise SystemExit("org bind missing")
    print("org", org)

    guests = json.loads(
        psql(
            "era_hotel_pms",
            """
SELECT COALESCE(json_agg(t), '[]'::json) FROM (
  SELECT g.id, g."fullName" AS full_name, g."firstName" AS first_name,
         g."lastName" AS last_name, g."middleName" AS middle_name,
         g.gender AS sex, g.phone, g.nationality,
         to_char(g."birthDate"::timestamp, 'YYYY-MM-DD') AS birth_date,
         g."globalPersonId" AS global_person_id
  FROM "Guest" g
  WHERE EXISTS (
    SELECT 1 FROM "Reservation" r
    WHERE r.status = 'IN_HOUSE' AND r."guestId" = g.id
  )
  OR EXISTS (
    SELECT 1 FROM "ReservationGuest" rg
    JOIN "Reservation" r ON r.id = rg."reservationId"
    WHERE r.status = 'IN_HOUSE' AND rg."guestId" = g.id
  )
) t;
""",
        )
        or "[]"
    )
    print("guests to consider", len(guests))
    linked = 0
    created = 0
    failed_mdm = 0
    for g in guests:
        if g.get("global_person_id"):
            linked += 1
            continue
        body = {
            "firstName": g.get("first_name") or None,
            "middleName": g.get("middle_name") or None,
            "lastName": g.get("last_name") or None,
            "fullName": g.get("full_name") or None,
            "phone": g.get("phone") or None,
            "nationality": g.get("nationality") or None,
            "organizationId": org,
        }
        if g.get("sex"):
            body["sex"] = g["sex"]
        if g.get("birth_date"):
            body["birthDate"] = g["birth_date"]
        out = orch_post("/internal/v1/mdm/persons/resolve", token, body)
        gpid = None
        try:
            js = out.split("EXIT:")[0].strip()
            data = json.loads(js)
            gpid = data.get("globalPersonId") or data.get("id")
        except Exception:
            failed_mdm += 1
            print("MDM fail", g.get("full_name"), out[:180])
            continue
        if not gpid:
            failed_mdm += 1
            print("MDM empty", g.get("full_name"), out[:180])
            continue
        gid = g["id"].replace("'", "''")
        gpid_sql = gpid.replace("'", "''")
        psql(
            "era_hotel_pms",
            f"""UPDATE "Guest" SET "globalPersonId" = '{gpid_sql}' WHERE id = '{gid}';""",
        )
        created += 1
    print("mdm already", linked, "newly linked", created, "failed", failed_mdm)

    rows = json.loads(
        psql(
            "era_hotel_pms",
            """
SELECT COALESCE(json_agg(t), '[]'::json) FROM (
  SELECT r.id AS reservation_id,
         r."medicalPackageCode" AS res_pkg,
         COALESCE(rm."roomNumber", '') AS room_number,
         r."checkInDate" AS check_in,
         r."checkOutDate" AS check_out,
         rg.id AS pax_key,
         rg."medicalPackageCode" AS pax_pkg,
         COALESCE(rg."firstName", gg."firstName", rgg."firstName") AS first_name,
         COALESCE(rg."lastName", gg."lastName", rgg."lastName") AS last_name,
         COALESCE(gg."fullName", rgg."fullName", '') AS full_name,
         COALESCE(gg."globalPersonId", rgg."globalPersonId") AS global_person_id
  FROM "Reservation" r
  LEFT JOIN "Room" rm ON rm.id = r."roomId"
  LEFT JOIN "ReservationGuest" rg ON rg."reservationId" = r.id
  LEFT JOIN "Guest" gg ON gg.id = rg."guestId"
  LEFT JOIN "Guest" rgg ON rgg.id = r."guestId"
  WHERE r.status = 'IN_HOUSE'
    AND (
      rg.id IS NOT NULL
      OR NOT EXISTS (
        SELECT 1 FROM "ReservationGuest" x WHERE x."reservationId" = r.id
      )
    )
) t;
""",
        )
        or "[]"
    )
    print("in-house pax rows", len(rows))
    sent = 0
    skipped = 0
    failed_ev = 0
    seen_pax = set()
    now = datetime.now(timezone.utc).isoformat()
    for row in rows:
        pkg = (row.get("pax_pkg") or row.get("res_pkg") or "").strip()
        if not pkg.upper().startswith("PKG-"):
            skipped += 1
            continue
        pax_key = row.get("pax_key") or row["reservation_id"]
        if pax_key in seen_pax:
            continue
        seen_pax.add(pax_key)
        name = (
            " ".join(
                x for x in [row.get("first_name"), row.get("last_name")] if x
            ).strip()
            or row.get("full_name")
            or "Guest"
        )
        gpid = row.get("global_person_id") or None
        ev = {
            "type": "SATELLITE_HOTEL_GUEST_CHECKED_IN",
            "organizationId": org,
            "correlationId": str(uuid.uuid4()),
            "occurredAt": now,
            "payload": {
                "reservationId": row["reservation_id"],
                "roomNumber": row.get("room_number") or None,
                "programCode": pkg,
                "guestName": name,
                "checkInDate": row.get("check_in"),
                "checkOutDate": row.get("check_out"),
                "paxKey": pax_key,
            },
        }
        if gpid:
            ev["globalPersonId"] = gpid
            ev["payload"]["globalPersonId"] = gpid
        out = orch_post("/api/v1/satellite-events", token, ev)
        if "EXIT:0" in out and ("jobId" in out or "queue" in out or "correlation" in out.lower()):
            sent += 1
        else:
            failed_ev += 1
            print("event fail", name, out[:220])
    print("events sent", sent, "skipped no PKG", skipped, "failed", failed_ev)
    time.sleep(5)
    clinic = psql(
        "era_clinic",
        """SELECT 'episodes=' || count(*) FROM "ClinicalEpisode";
           SELECT 'patients=' || count(*) FROM "PatientRef";""",
    )
    mdm = psql("era_mdm", "SELECT count(*) FROM global_natural_persons;")
    print("clinic", clinic.replace("\n", " "))
    print("mdm persons", mdm)


if __name__ == "__main__":
    main()
