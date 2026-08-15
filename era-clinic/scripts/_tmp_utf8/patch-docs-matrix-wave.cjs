const fs = require("fs");

function read(p) {
  let s = fs.readFileSync(p, "utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s;
}
function write(p, s) {
  fs.writeFileSync(p, s, "utf8");
  const b = fs.readFileSync(p);
  if (b[0] === 0) throw new Error("UTF-16 " + p);
  console.log("ok", p, "byte0=", b[0]);
}

// ADR consequences
{
  const p = "D:/My Projects/era-ecosystem/docs/adr/clinic-multi-resource-scheduling.md";
  let s = read(p);
  const oldExplicit = `### Explicitly not in this wave

- Reception matrix visual redesign (Location projection API only gains staff fields).
- Staff timeline / nurse "my queue" filter.
- Merging \`Practitioner\` into \`Resource\` kind=STAFF.
- Soft-staff concurrency enforcement.

## Consequences

- Master data: SatAdmin maintains skills and procedure requirements.
- FIFO planner, available-slots, and reschedule must assign STAFF allocations.
- Future Staff timeline = projection of STAFF allocations (same SoR).`;
  const newExplicit = `### Explicitly not in this wave

- Merging \`Practitioner\` into \`Resource\` kind=STAFF.
- Soft-staff concurrency enforcement.
- Staff timeline board (nurse/staff projection) — future; Location board UX is shipped.

## Consequences

- Master data: SatAdmin maintains skills and procedure requirements.
- FIFO planner, available-slots, and reschedule must assign STAFF allocations.
- **Location board UX shipped** — \`/sanatorium/resources\` sticky matrix with merged bars, status colors, DnD; calendar slots carry \`endsAt\` / \`status\` / \`procedureCode\`; nurse \`GET /api/procedures?mine=1\` filters STAFF allocations.
- **Staff timeline** remains future = projection of STAFF allocations (same SoR).`;
  if (!s.includes(oldExplicit)) {
    if (s.includes("Location board UX shipped")) {
      console.log("ADR already updated");
    } else {
      console.error("ADR block not found");
      process.exit(1);
    }
  } else {
    s = s.replace(oldExplicit, newExplicit);
    write(p, s);
  }
}

// module map
{
  const p = "D:/My Projects/era-ecosystem/era-clinic/.cursor/rules/era-clinic-module-map.mdc";
  let s = read(p);
  const old = `| \`/nurse\` | \`POST /api/nurse/qr-scan\`, \`GET /api/nurse/overdue\`; \`POST /api/procedures/[id]/check-in\\|complete\\|no-show\` |
| \`/sanatorium/resources\` | \`GET …/calendar\` matrix; \`GET …/available-slots\`; reception DnD / move / cancel — nav under Sanatorium module |`;
  const neu = `| \`/nurse\` | \`POST /api/nurse/qr-scan\`, \`GET /api/nurse/overdue\`; \`GET /api/procedures?mine=1\` (STAFF allocation filter); \`POST /api/procedures/[id]/check-in\\|complete\\|no-show\` |
| \`/sanatorium/resources\` | Location **day matrix board** (\`ResourceDayMatrix\`); \`GET …/calendar\` (endsAt/status/procedureCode); \`GET …/available-slots\`; reception DnD / move / cancel — nav under Sanatorium module |`;
  if (!s.includes("ResourceDayMatrix") && s.includes("/sanatorium/resources")) {
    s = s.replace(
      `| \`/nurse\` | \`POST /api/nurse/qr-scan\`, \`GET /api/nurse/overdue\`; \`POST /api/procedures/[id]/check-in\\|complete\\|no-show\` |`,
      `| \`/nurse\` | \`POST /api/nurse/qr-scan\`, \`GET /api/nurse/overdue\`; \`GET /api/procedures?mine=1\` (STAFF allocation filter); \`POST /api/procedures/[id]/check-in\\|complete\\|no-show\` |`,
    );
    s = s.replace(
      `| \`/sanatorium/resources\` | \`GET …/calendar\` matrix; \`GET …/available-slots\`; reception DnD / move / cancel — nav under Sanatorium module |`,
      `| \`/sanatorium/resources\` | Location **day matrix board** (\`ResourceDayMatrix\`); \`GET …/calendar\` (endsAt/status/procedureCode); \`GET …/available-slots\`; reception DnD / move / cancel — nav under Sanatorium module |`,
    );
    write(p, s);
  } else {
    console.log("module-map skip or already", s.includes("ResourceDayMatrix"));
  }
}

// UAT-SMOKE
{
  const p = "D:/My Projects/era-ecosystem/era-clinic/doc/UAT-SMOKE.md";
  let s = read(p);
  const old3 = `3. **\`/nurse\`** — paste guest QR → verify → **Check-in** (same QR, time window) **auto-completes** the order (\`COMPLETED\`; short ≈10–15 min cabin procedures — attendance = executed). No separate Finish step on the happy path. Overdue list: **No-show** or late check-in. Stuck \`CHECKED_IN\` (auto-complete failure) can still use manual Finish. Filters: date (default today), status, patient, procedure, overdue-only.
4. **\`/sanatorium/resources\`** — reception **day matrix**: free slots green / occupied blocked; payload may include assigned staff; **drag** SCHEDULED onto free cell or **Move** picker (\`available-slots\` — staff+cabin AND); **Cancel** frees inventory. Episode chart links to matrix (no nurse complete on chart).`;
  const new3 = `3. **\`/nurse\`** — paste guest QR → verify → **Check-in** (same QR, time window) **auto-completes** the order (\`COMPLETED\`; short ≈10–15 min cabin procedures — attendance = executed). No separate Finish step on the happy path. Overdue list: **No-show** or late check-in. Stuck \`CHECKED_IN\` (auto-complete failure) can still use manual Finish. Filters: date (default today), status, patient, procedure, overdue-only; NURSE default **Mine** (\`GET /api/procedures?mine=1\` STAFF allocation) with **All** toggle; unlinked practitioner shows \`mineUnlinked\` message.
4. **\`/sanatorium/resources\`** — reception **Location day board** (sticky resource column + time header, merged bars by \`procedureOrderId\`, status colors, now-line Asia/Baku): free cells emerald / SCHEDULED blue tint; **drag** SCHEDULED bar onto free cell or **Move** picker (\`available-slots\` — staff+cabin AND); **Cancel** frees inventory. Episode chart links to matrix (no nurse complete on chart).`;
  if (s.includes(old3)) {
    s = s.replace(old3, new3);
    write(p, s);
  } else if (s.includes("Location day board")) {
    console.log("UAT already updated");
  } else {
    console.error("UAT block not found");
    process.exit(1);
  }
}

// DELIVERY
{
  const p = "D:/My Projects/era-ecosystem/era-clinic/doc/DELIVERY-CLINIC.md";
  let s = read(p);
  const line = `- [x] Reception Location matrix UX + nurse mine filter — sticky day board (\`ResourceDayMatrix\`), calendar \`endsAt\`/status/procedureCode; \`GET /api/procedures?mine=1\` STAFF allocation filter on nurse queue`;
  if (!s.includes("ResourceDayMatrix")) {
    // insert after procedure inventory matrix line
    const anchor = `- [x] Procedure inventory matrix — \`/sanatorium/resources\` + \`available-slots\` (hotel-like free/blocked)`;
    if (!s.includes(anchor)) {
      console.error("DELIVERY anchor missing");
      process.exit(1);
    }
    s = s.replace(anchor, anchor + "\n" + line);
    write(p, s);
  } else {
    console.log("DELIVERY already has ResourceDayMatrix");
  }
}

// COVERAGE_MATRIX CLI-26
{
  const p = "D:/My Projects/era-ecosystem/docs/COVERAGE_MATRIX.md";
  let s = read(p);
  const old =
    `| CLI-26 | Procedure day-ops (reception matrix + nurse attendance) | ADR clinic-procedure-day-ops | Y check-in/no-show/cancel/reschedule/available-slots; check-in auto-completes | Y \`/nurse\`, \`/sanatorium/resources\` | — | — | — | SHIPPED | RECEPTION matrix; NURSE QR check-in = executed (short procs); stuck CHECKED_IN rare |`;
  const neu =
    `| CLI-26 | Procedure day-ops (reception matrix + nurse attendance) | ADR clinic-procedure-day-ops | Y check-in/no-show/cancel/reschedule/available-slots; check-in auto-completes; procedures?mine=1 | Y \`/nurse\` (Mine/All), \`/sanatorium/resources\` Location board | — | — | — | SHIPPED | RECEPTION sticky matrix bars; NURSE QR + mine STAFF filter; stuck CHECKED_IN rare |`;
  if (s.includes(old)) {
    s = s.replace(old, neu);
    // changelog
    if (!s.includes("Location board UX")) {
      s = s.replace(
        `| 2026-07-18 | CLI-26: nurse check-in auto-completes short procedures (no separate Tamamla on happy path) |`,
        `| 2026-07-19 | CLI-26: Location board UX (\`ResourceDayMatrix\`) + nurse \`mine=1\` STAFF filter |\n| 2026-07-18 | CLI-26: nurse check-in auto-completes short procedures (no separate Tamamla on happy path) |`,
      );
    }
    write(p, s);
  } else if (s.includes("Location board")) {
    console.log("COVERAGE already updated");
  } else {
    console.error("CLI-26 row not found exact; trying softer");
    // softer: just append note in notes column if row exists
    if (s.includes("| CLI-26 |") && !s.includes("Location board")) {
      s = s.replace(
        /( \| CLI-26 \|[^\n]+)/,
        (m) => m.replace("| SHIPPED |", "| SHIPPED |").replace(
          /\| SHIPPED \| ([^\n|]+) \|/,
          "| SHIPPED | Location board UX + nurse mine=1; $1 |",
        ),
      );
      write(p, s);
    } else {
      process.exit(1);
    }
  }
}