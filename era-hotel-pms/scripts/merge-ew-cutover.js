/**
 * Cutover merge for D:\ERA-BACKUP\EW:
 *   Guest Cards + FOCP/Reservations + Folio Transactions
 * Includes previous .merged.xlsx so July archive is not dropped.
 *
 *   node era-hotel-pms/scripts/merge-ew-cutover.js
 *   node era-hotel-pms/scripts/merge-ew-cutover.js --dir "D:\\ERA-BACKUP\\NAFTA-START\\hotel" --delete
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const X = require("xlsx");

const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const next = args[i + 1];
  if (!next || next.startsWith("--")) return true;
  return next;
}

const EW = path.resolve(String(flag("--dir", "D:\\ERA-BACKUP\\NAFTA-START\\hotel")));
const DO_DELETE = Boolean(flag("--delete", false));
const scriptsDir = __dirname;

function list(prefix) {
  return fs
    .readdirSync(EW)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".xlsx"))
    .sort()
    .map((f) => path.join(EW, f));
}

function run(script, argv) {
  console.log("\n>> node", path.basename(script), argv.map((a) => path.basename(a)).join(" "));
  const r = spawnSync(process.execPath, [script, ...argv], {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
    windowsHide: true,
  });
  if (r.status !== 0) {
    throw new Error(`${path.basename(script)} exited ${r.status}`);
  }
}

function excelDate(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && v >= 1000 && v < 80000) {
    const d = X.SSF.parse_date_code(v);
    if (!d || d.y < 1901 || d.y > 2100) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof v === "string") {
    const m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
  }
  return null;
}

function sheetRows(file) {
  const wb = X.readFile(file, { cellDates: false });
  return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });
}

function gapsFromDates(days) {
  const gaps = [];
  for (let i = 0; i < days.length - 1; i += 1) {
    const a = Date.parse(`${days[i]}T00:00:00Z`);
    const b = Date.parse(`${days[i + 1]}T00:00:00Z`);
    const delta = Math.round((b - a) / 86400000);
    if (delta > 1) {
      gaps.push({
        from: new Date(a + 86400000).toISOString().slice(0, 10),
        to: new Date(b - 86400000).toISOString().slice(0, 10),
        days: delta - 1,
      });
    }
  }
  return gaps;
}

function chunkRisk(file) {
  const rows = sheetRows(file);
  return {
    file: path.basename(file),
    rows: rows.length,
    nearCap: rows.length >= 850,
    likelyTruncated: rows.length >= 990,
  };
}

function main() {
  if (!fs.existsSync(EW)) {
    console.error("Missing EW dir", EW);
    process.exit(1);
  }

  function pick(...names) {
    for (const n of names) {
      const p = path.join(EW, n);
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  const guestMerged = pick("10-Guest-Cards.xlsx", "10-Guest-Cards.merged.xlsx", "Guest Cards.merged.xlsx");
  const resMerged = pick("11-Reservations.xlsx", "11-Reservations.merged.xlsx", "Reservations.merged.xlsx");
  const folioMerged = pick(
    "13-Folio-Transactions.merged.xlsx",
    "12-Folio-Transactions.merged.xlsx",
    "Folio Transactions.merged.xlsx",
  );
  const fnbMerged = pick(
    path.join("..", "fnb", "32-FnB-Transactions.xlsx"),
    "32-FnB-Transactions.xlsx",
    "16-FnB-Transactions.merged.xlsx",
    "FnB Transactions.merged.xlsx",
  );

  const guestSources = [
    guestMerged,
    ...list("Guest Cards.").filter((f) => !path.basename(f).includes(".merged.")),
  ].filter(Boolean);

  const resSources = [
    resMerged,
    ...list("Front Office Control Panel.").filter((f) => !path.basename(f).includes(".merged.")),
  ].filter(Boolean);

  const folioSources = [
    folioMerged,
    fnbMerged,
    ...list("Folio Transactions.").filter((f) => !path.basename(f).includes(".merged.")),
  ].filter(Boolean);

  const chunkAudit = {
    guests: guestSources.filter((f) => !path.basename(f).includes(".merged.")).map(chunkRisk),
    reservations: resSources.filter((f) => !path.basename(f).includes(".merged.")).map(chunkRisk),
    folio: folioSources.filter((f) => !path.basename(f).includes(".merged.")).map(chunkRisk),
  };

  const guestFinal = path.join(EW, "10-Guest-Cards.xlsx");
  const guestOut = path.join(EW, "10-Guest-Cards.next.xlsx");
  run(path.join(scriptsDir, "merge-guest-cards-files.js"), [
    "--out",
    guestOut,
    ...guestSources,
  ]);
  if (fs.existsSync(guestFinal)) fs.unlinkSync(guestFinal);
  fs.renameSync(guestOut, guestFinal);
  const guestSummaryNext = guestOut.replace(/\.xlsx$/i, ".summary.json");
  const guestSummaryFinal = guestFinal.replace(/\.xlsx$/i, ".summary.json");
  if (fs.existsSync(guestSummaryNext)) {
    if (fs.existsSync(guestSummaryFinal)) fs.unlinkSync(guestSummaryFinal);
    fs.renameSync(guestSummaryNext, guestSummaryFinal);
  }

  run(path.join(scriptsDir, "merge-reservations.js"), [
    "--files",
    ...resSources,
    "--out",
    path.join(EW, "11-Reservations.xlsx"),
  ]);

  console.log("\n>> enrich Guest Id on reservations (FOCP export has Guest Name only)");
  {
    const enrichArgs = [
      "tsx",
      path.join(scriptsDir, "enrich-reservations-guest-id.ts"),
      path.join(EW, "10-Guest-Cards.xlsx"),
      path.join(EW, "11-Reservations.xlsx"),
      path.join(EW, "11-Reservations.xlsx"),
    ];
    const r = spawnSync("npx", enrichArgs, {
      cwd: path.join(scriptsDir, ".."),
      stdio: "inherit",
      shell: true,
      windowsHide: true,
    });
    if (r.status !== 0) {
      throw new Error(`enrich-reservations-guest-id.ts exited ${r.status}`);
    }
  }

  fs.mkdirSync(path.join(EW, "..", "fnb"), { recursive: true });
  run(path.join(scriptsDir, "merge-folio-transactions.js"), [
    "--files",
    ...folioSources,
    "--out",
    path.join(EW, "13-Folio-Transactions.merged.xlsx"),
    "--fnb-out",
    path.join(EW, "..", "fnb", "32-FnB-Transactions.xlsx"),
  ]);

  const guests = sheetRows(path.join(EW, "10-Guest-Cards.xlsx"));
  const reservations = sheetRows(path.join(EW, "11-Reservations.xlsx"));
  const folios = sheetRows(path.join(EW, "13-Folio-Transactions.merged.xlsx"));

  const guestIds = new Set(guests.map((r) => String(r["Guest Id"] ?? "").trim()).filter(Boolean));
  const resByState = {};
  const arrivalDays = [];
  let inHouse = 0;
  let future = 0;
  let tRooms = 0;
  const unmatchedGuestNames = [];
  for (const r of reservations) {
    const st = String(r.State ?? "(empty)");
    resByState[st] = (resByState[st] || 0) + 1;
    if (st === "InHouse") inHouse += 1;
    const arr = excelDate(r.Arrival || r["Arrival Date"] || r["Check In"]);
    if (arr) arrivalDays.push(arr);
    if (arr && arr > "2026-08-17" && st === "Reservation") future += 1;
    if (String(r["Room No"] ?? "").startsWith("T")) tRooms += 1;
  }
  arrivalDays.sort();
  const arrivalUnique = [...new Set(arrivalDays)];

  const folioDays = folios.map((r) => excelDate(r.Date)).filter(Boolean).sort();
  const folioUnique = [...new Set(folioDays)];
  const folioGaps = gapsFromDates(folioUnique).filter((g) => g.days >= 3);

  const completeGuest = (r) => {
    const id = String(r["Guest Id"] ?? "").trim();
    const name = String(r.Name ?? r["First Name"] ?? "").trim();
    const last = String(r["Last Name"] ?? r.Surname ?? "").trim();
    const passport = String(r.Passport ?? r["Passport No"] ?? r["Passport Number"] ?? "").trim();
    const nid = String(r["National Id"] ?? r.FIN ?? r["National ID"] ?? "").trim();
    const phone = String(r.Phone ?? r["Phone Number"] ?? r.Telephone ?? "").trim();
    return Boolean(id && name && last && (passport || nid || phone));
  };

  const audit = {
    cutoverDate: "2026-08-17",
    dir: EW,
    guests: {
      unique: guests.length,
      completeCards: guests.filter(completeGuest).length,
      columns: Object.keys(guests[0] || {}),
    },
    reservations: {
      unique: reservations.length,
      byState: resByState,
      inHouse,
      futureAfterCutover: future,
      tRooms,
      arrivalMin: arrivalUnique[0] || null,
      arrivalMax: arrivalUnique[arrivalUnique.length - 1] || null,
    },
    folioHotel: {
      unique: folios.length,
      dateMin: folioUnique[0] || null,
      dateMax: folioUnique[folioUnique.length - 1] || null,
      uniqueDays: folioUnique.length,
      gapsGte3: folioGaps,
    },
    scrapeRisk: {
      note: "Elektraweb export cap ~1000 rows. Chunks >=990 likely truncated — more rows exist in EW for that filter.",
      guests: chunkAudit.guests,
      reservations: chunkAudit.reservations,
      folio: chunkAudit.folio,
      truncatedChunks: [...chunkAudit.guests, ...chunkAudit.reservations, ...chunkAudit.folio].filter(
        (c) => c.likelyTruncated,
      ),
    },
  };

  const auditPath = path.join(EW, "CUTOVER_AUDIT_2026-08-17.json");
  fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  console.log("\n=== CUTOVER AUDIT ===");
  console.log(JSON.stringify(audit, null, 2));

  const stale = [
    ...list("Guest Cards.").filter((f) => !path.basename(f).includes(".merged.")),
    ...list("Front Office Control Panel."),
    ...list("Folio Transactions.").filter((f) => !path.basename(f).includes(".merged.")),
    ...fs
      .readdirSync(EW)
      .filter((f) => f.startsWith("AUDIT_"))
      .map((f) => path.join(EW, f)),
  ];

  if (DO_DELETE) {
    for (const f of stale) {
      fs.unlinkSync(f);
      console.log("deleted", path.basename(f));
    }
  } else {
    console.log("\nStale files (pass --delete to remove):");
    for (const f of stale) console.log(" -", path.basename(f));
  }
}

main();
