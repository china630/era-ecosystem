/**
 * Build Nafta WO vs ERA matrix canvases from a fresh WebOnly calendar dump.
 * Writes Cursor canvas files (no PII: guest labels are P{patientId}).
 *
 *   node era-clinic/scripts/build-nafta-matrix-canvas.cjs
 */
const fs = require("fs");
const path = require("path");

const DUMP = path.join("D:", "ERA-BACKUP", "NAFTA-START", "clinic", "dump", "calendar");
const OUT = path.join(
  process.env.USERPROFILE || "",
  ".cursor",
  "projects",
  "d-My-Projects-era-ecosystem",
  "canvases",
);
const DATES = [
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  "2026-08-23",
  "2026-08-24",
  "2026-08-25",
  "2026-08-26",
];

const CATALOG_MIN = {
  "4 kamera hidroqalvanizasiya": 15,
  "4 kamera vanna": 20,
  Amplipuls: 10,
  Bükmə: 20,
  Darsonval: 10,
  Elektroforez: 10,
  "Əzələ iynəsi": 10,
  "Hidromasaj vanna": 15,
  İnfraqırmızı: 10,
  İnqalyasiya: 10,
  "Qısa dalğa terapiya UVÇ": 10,
  Lazerterapiya: 8,
  Limfodrenaj: 30,
  Maqnitoterapiya: 10,
  "Massaj 15": 15,
  "Massaj 30": 30,
  "Massaj 30 (test)": 30,
  "Naftalan vannası (Kişi)": 20,
  "Naftalan vannası (Qadın)": 20,
  Ozonterapiya: 10,
  "Parafin Aşağı nahiyə": 20,
  "Parafin Kürək - onurğa": 20,
  "Parafin Yuxarı nahiyə": 20,
  Solyuks: 10,
  "Super induktiv terapiya": 15,
  "Trunda burun": 10,
  "Turunda qulaq": 10,
  "UFB terapiya": 1,
  "Ultrafonoforez (Gellə)": 10,
  "Ultrafonoforez (Naftalan yağıyla)": 10,
  Vakumterapiya: 10,
  "Yod-brom vanna": 15,
  "Zərbə dalğa": 10,
};

function parseHm(t) {
  const p = String(t || "00:00:00").split(":");
  return Number(p[0] || 0) * 60 + Number(p[1] || 0);
}

function fileFor(date) {
  if (date === "2026-08-21") return "nafta-wo-vs-era-matrix.canvas.tsx";
  return `nafta-wo-vs-era-matrix-${date}.canvas.tsx`;
}

function buildData(date, roomsById) {
  const day = JSON.parse(fs.readFileSync(path.join(DUMP, "by-date", `${date}.json`), "utf8"));
  const rows = (day.data || []).filter((r) => r.treatmentName && r.roomId);
  const roomNames = [
    ...new Set(rows.map((r) => roomsById.get(r.roomId) || `Room ${r.roomId}`)),
  ].sort((a, b) => a.localeCompare(b, "az"));
  const treatNames = [...new Set(rows.map((r) => r.treatmentName))].sort((a, b) =>
    a.localeCompare(b, "az"),
  );
  const nameIds = [...new Set(rows.map((r) => r.patientId))];
  const names = nameIds.map((id) => `P${id}`);
  const nameIx = new Map(nameIds.map((id, i) => [id, i]));
  const roomIx = new Map(roomNames.map((n, i) => [n, i]));
  const treatIx = new Map(treatNames.map((n, i) => [n, i]));
  const hours = {};
  let peakEnd = 1020;
  const items = [];
  for (const r of rows) {
    const roomName = roomsById.get(r.roomId) || `Room ${r.roomId}`;
    const ri = roomIx.get(roomName);
    const ti = treatIx.get(r.treatmentName);
    const ni = nameIx.get(r.patientId);
    if (ri == null || ti == null || ni == null) continue;
    const a = parseHm(r.startTime);
    const b = parseHm(r.endTime) || a + 10;
    const h = Math.floor(a / 60);
    hours[h] = (hours[h] || 0) + 1;
    peakEnd = Math.max(peakEnd, b);
    items.push([a, b, ri, ti, ni]);
  }
  return {
    date,
    slot: 5,
    dayStart: 480,
    dayEnd: 1080,
    lunch: [780, 840],
    peakEnd,
    rooms: roomNames,
    treats: treatNames,
    names,
    hours,
    items,
  };
}

function canvasSource(DATA) {
  const dataLit = JSON.stringify(DATA);
  return `import {
  BarChart,
  Button,
  Callout,
  Divider,
  Grid,
  H1,
  H2,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useHostTheme,
} from "cursor/canvas";
import { useState } from "react";

type Mode = "wo" | "era" | "opt";

const DATA = ${dataLit} as {
  date: string;
  slot: number;
  dayStart: number;
  dayEnd: number;
  lunch: [number, number];
  peakEnd: number;
  rooms: string[];
  treats: string[];
  names: string[];
  hours: Record<string, number>;
  items: number[][];
};

const CATALOG_MIN: Record<string, number> = {
  "4 kamera hidroqalvanizasiya": 15,
  "4 kamera vanna": 20,
  Amplipuls: 10,
  Bükmə: 20,
  Darsonval: 10,
  Elektroforez: 10,
  "Əzələ iynəsi": 10,
  "Hidromasaj vanna": 15,
  İnfraqırmızı: 10,
  İnqalyasiya: 10,
  "Qısa dalğa terapiya UVÇ": 10,
  Lazerterapiya: 8,
  Limfodrenaj: 30,
  Maqnitoterapiya: 10,
  "Massaj 15": 15,
  "Massaj 30": 30,
  "Massaj 30 (test)": 30,
  "Naftalan vannası (Kişi)": 20,
  "Naftalan vannası (Qadın)": 20,
  Ozonterapiya: 10,
  "Parafin Aşağı nahiyə": 20,
  "Parafin Kürək - onurğa": 20,
  "Parafin Yuxarı nahiyə": 20,
  Solyuks: 10,
  "Super induktiv terapiya": 15,
  "Trunda burun": 10,
  "Turunda qulaq": 10,
  "UFB terapiya": 1,
  "Ultrafonoforez (Gellə)": 10,
  "Ultrafonoforez (Naftalan yağıyla)": 10,
  Vakumterapiya: 10,
  "Yod-brom vanna": 15,
  "Zərbə dalğa": 10,
};

const PATIENT_GAP_MIN: Record<string, number> = {
  "4 kamera hidroqalvanizasiya": 15,
  "4 kamera vanna": 40,
  Amplipuls: 15,
  Darsonval: 15,
  Elektroforez: 15,
  Lazerterapiya: 15,
  "Naftalan vannası (Kişi)": 40,
  "Naftalan vannası (Qadın)": 40,
  "Parafin Aşağı nahiyə": 15,
  "Parafin Kürək - onurğa": 15,
  "Parafin Yuxarı nahiyə": 15,
  "UFB terapiya": 15,
  "Ultrafonoforez (Gellə)": 15,
  "Ultrafonoforez (Naftalan yağıyla)": 15,
};

const RESOURCE_GAP_MIN: Record<string, number> = {
  "Ultrafonoforez (Gellə)": 0,
  Darsonval: 0,
  Lazerterapiya: 0,
  "Parafin Aşağı nahiyə": 0,
  "Parafin Kürək - onurğa": 0,
  "Parafin Yuxarı nahiyə": 0,
};

const GAP_MIN = 5;
const SOLUX_FOUR_FROM = "2026-08-24";

function alignMin(raw: number) {
  return Math.max(5, Math.ceil(raw / 5) * 5);
}
function catalogDur(treatIdx: number) {
  return alignMin(CATALOG_MIN[DATA.treats[treatIdx]] ?? 20);
}
function resourceGapFor(treatIdx: number) {
  return RESOURCE_GAP_MIN[DATA.treats[treatIdx]] ?? GAP_MIN;
}
function fmt(m: number) {
  const wrap = ((m % 1440) + 1440) % 1440;
  return String(Math.floor(wrap / 60)).padStart(2, "0") + ":" + String(wrap % 60).padStart(2, "0");
}
function kabinaIdx(n: number) {
  if (n === 5) return DATA.rooms.indexOf("Kabina 5 (Düz)");
  if (n === 6) return DATA.rooms.indexOf("Kabina 6 (Halqa)");
  return DATA.rooms.indexOf("Kabina " + n);
}
function isPhysioCabin(name: string) {
  return /^Kabina \\d/.test(name) && name.indexOf("Parafin") < 0;
}
function isFourChamber(name: string) {
  return /4 kameralı|4 kamera vanna|4 kamera hidro/i.test(name);
}
function treatGender(name: string): "F" | "M" | null {
  if (/Qadın|qadın|женщин/i.test(name)) return "F";
  if (/Kişi|kişi|мужчин/i.test(name)) return "M";
  return null;
}

const ELECTRO = [7, 8, 10, 11, 12, 13, 14].map(kabinaIdx).filter((i) => i >= 0);
const SOLUX =
  DATA.date >= SOLUX_FOUR_FROM
    ? [2, 3, 21, 22].map(kabinaIdx).filter((i) => i >= 0)
    : [2, 3].map(kabinaIdx).filter((i) => i >= 0);

const TREAT_POOL: Record<string, number[]> = {
  Vakumterapiya: [kabinaIdx(1), kabinaIdx(20)].filter((i) => i >= 0),
  Solyuks: SOLUX,
  İnfraqırmızı: [kabinaIdx(4)].filter((i) => i >= 0),
  Maqnitoterapiya: [kabinaIdx(5), kabinaIdx(6)].filter((i) => i >= 0),
  Elektroforez: ELECTRO,
  Amplipuls: ELECTRO,
  "Ultrafonoforez (Naftalan yağıyla)": [kabinaIdx(15), kabinaIdx(16)].filter((i) => i >= 0),
  "Ultrafonoforez (Gellə)": [kabinaIdx(17)].filter((i) => i >= 0),
  Lazerterapiya: [kabinaIdx(18)].filter((i) => i >= 0),
  Darsonval: [kabinaIdx(19)].filter((i) => i >= 0),
  "Super induktiv terapiya": [kabinaIdx(23)].filter((i) => i >= 0),
  Limfodrenaj: [kabinaIdx(24)].filter((i) => i >= 0),
  "Qısa dalğa terapiya UVÇ": [kabinaIdx(25)].filter((i) => i >= 0),
};

const ROOM_ROLE: Record<string, string> = {
  "Kabina 1": "Vakum",
  "Kabina 2": "Solyuks",
  "Kabina 3": "Solyuks",
  "Kabina 4": "İnfraqırmızı",
  "Kabina 5 (Düz)": "Maqnit düz",
  "Kabina 6 (Halqa)": "Maqnit halqa",
  "Kabina 7": "Elektro / Ampli",
  "Kabina 8": "Elektro / Ampli",
  "Kabina 10": "Elektro / Ampli",
  "Kabina 11": "Elektro / Ampli",
  "Kabina 12": "Elektro / Ampli",
  "Kabina 13": "Elektro / Ampli",
  "Kabina 14": "Elektro / Ampli",
  "Kabina 15": "UFF масло",
  "Kabina 16": "UFF масло",
  "Kabina 17": "UFF gel",
  "Kabina 18": "Lazer",
  "Kabina 19": "Darsonval",
  "Kabina 20": "Vakum",
  "Kabina 21": "Solyuks",
  "Kabina 22": "Solyuks",
  "Kabina 23": "Superinduktiv",
  "Kabina 24": "Limfodrenaj",
  "Kabina 25": "UVC",
};

const PACKED: { a: number; b: number; r: number }[] = DATA.items.map((it) => ({
  a: it[0],
  b: it[1],
  r: it[2],
}));

function roomWindow(roomName: string) {
  if (isFourChamber(roomName)) return { start: 480, lunch0: 780, lunch1: 840, end: 1080 };
  return { start: 540, lunch0: 780, lunch1: 840, end: 1020 };
}

function packRoomTimes(idxs: number[], roomName: string) {
  const win = roomWindow(roomName);
  const durs = idxs.map((i) => catalogDur(DATA.items[i]![3]));
  const after = idxs.map((i) => resourceGapFor(DATA.items[i]![3]));
  const genders = idxs.map((i) => treatGender(DATA.treats[DATA.items[i]![3]] ?? ""));
  let cursor = win.start;
  const overflow: number[] = [];
  idxs.forEach((idx, i) => {
    const slot = PACKED[idx];
    if (!slot) return;
    const d = durs[i] ?? 10;
    const g = genders[i];
    let t = cursor;
    if (g === "F" && isFourChamber(roomName)) {
      t = Math.max(t, win.start);
      if (t + d > win.lunch0) {
        overflow.push(idx);
        return;
      }
    } else if (g === "M" && isFourChamber(roomName)) {
      t = Math.max(t, win.lunch1);
    } else if (t < win.lunch1 && t + d > win.lunch0) {
      t = win.lunch1;
    }
    if (t + d > win.end) {
      overflow.push(idx);
      return;
    }
    slot.a = t;
    slot.b = t + d;
    cursor = t + d + (after[i] ?? 0);
    if (cursor > win.lunch0 && cursor < win.lunch1) cursor = win.lunch1;
  });
  let ov = win.end;
  overflow.forEach((idx) => {
    const slot = PACKED[idx];
    if (!slot) return;
    const d = catalogDur(DATA.items[idx]![3]);
    slot.a = ov;
    slot.b = ov + d;
    ov += d + resourceGapFor(DATA.items[idx]![3]);
  });
}

(function buildPacked() {
  const load = DATA.rooms.map(() => 0);
  DATA.items.forEach((it, idx) => {
    const pool = TREAT_POOL[DATA.treats[it[3]]];
    if (!pool || !pool.length) {
      PACKED[idx].r = it[2];
      return;
    }
    let best = pool[0];
    let bestScore = Infinity;
    for (const ri of pool) {
      const score = load[ri] - (ri === it[2] ? 0.1 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = ri;
      }
    }
    PACKED[idx].r = best;
    load[best] += catalogDur(it[3]);
  });
  const byRoom: Record<number, number[]> = {};
  PACKED.forEach((p, idx) => {
    (byRoom[p.r] ??= []).push(idx);
  });
  for (const key of Object.keys(byRoom)) {
    const ri = Number(key);
    const idxs = byRoom[ri].slice().sort((i, j) => DATA.items[i][0] - DATA.items[j][0]);
    packRoomTimes(idxs, DATA.rooms[ri]);
  }
})();

const WORK_STD = 420;
const TREAT_N: Record<string, number> = {};
DATA.items.forEach((it) => {
  const t = DATA.treats[it[3]];
  TREAT_N[t] = (TREAT_N[t] ?? 0) + 1;
});
const PACKED_LATE = PACKED.filter((p) => p.a >= 1020).length;
const GEL_LATE = PACKED.filter(
  (p, i) => p.a >= 1020 && DATA.treats[DATA.items[i][3]] === "Ultrafonoforez (Gellə)",
).length;

function capSlots(dur: number, rooms: number, gap: number, work = WORK_STD) {
  const cycle = dur + gap;
  return cycle <= 0 ? 0 : Math.floor((work + gap) / cycle) * rooms;
}

const CAP_DEFS = [
  { label: "UFF gel · каб. 17", rooms: 1, treats: ["Ultrafonoforez (Gellə)"] },
  { label: "UFF масло · каб. 15–16", rooms: 2, treats: ["Ultrafonoforez (Naftalan yağıyla)"] },
  { label: "Darsonval · каб. 19 · gap 0", rooms: 1, treats: ["Darsonval"] },
  { label: "Lazer · каб. 18 · gap 0", rooms: 1, treats: ["Lazerterapiya"] },
  {
    label: DATA.date >= SOLUX_FOUR_FROM ? "Solyuks · 4 юнита (2, 3, 21, 22)" : "Solyuks · каб. 2–3",
    rooms: DATA.date >= SOLUX_FOUR_FROM ? 4 : 2,
    treats: ["Solyuks"],
  },
  { label: "UFB · 1 мин → сетка 5", rooms: 1, treats: ["UFB terapiya"] },
  {
    label: "Parafin · цикл 20 (gap 0)",
    rooms: 5,
    treats: ["Parafin Aşağı nahiyə", "Parafin Kürək - onurğa", "Parafin Yuxarı nahiyə"],
  },
  { label: "4-kamera · 8–18, Ж до обеда / М после", rooms: 1, treats: ["4 kamera vanna"] },
  { label: "Naftalan Ж · до 13:00", rooms: 4, treats: ["Naftalan vannası (Qadın)"] },
  { label: "Naftalan М · с 14:00", rooms: 4, treats: ["Naftalan vannası (Kişi)"] },
];

const CAP_ROWS = CAP_DEFS.map((d) => {
  const first = d.treats[0] ?? "";
  const ti = DATA.treats.indexOf(first);
  const dur = ti >= 0 ? catalogDur(ti) : 20;
  const gap = ti >= 0 ? resourceGapFor(ti) : GAP_MIN;
  const rest = PATIENT_GAP_MIN[first] ?? 15;
  const today = d.treats.reduce((s, t) => s + (TREAT_N[t] ?? 0), 0);
  const work = d.label.indexOf("4-kamera") >= 0 ? 540 : WORK_STD;
  const cap = capSlots(dur, d.rooms, gap, work);
  return { label: d.label, rooms: d.rooms, dur, gap, rest, today, cap, over: today > cap };
}).filter((r) => r.today > 0);

function itemRoom(idx: number, mode: Mode) {
  return mode === "opt" ? PACKED[idx].r : DATA.items[idx][2];
}
function spanAt(idx: number, mode: Mode) {
  const item = DATA.items[idx];
  if (mode === "wo") return { a: item[0], b: item[1] };
  if (mode === "opt") return { a: PACKED[idx].a, b: PACKED[idx].b };
  const a = Math.floor(item[0] / 5) * 5;
  return { a, b: a + catalogDur(item[3]) };
}

function hourCats() {
  return Object.keys(DATA.hours).sort((a, b) => Number(a) - Number(b));
}

function DayStrip({ mode }: { mode: Mode }) {
  const theme = useHostTheme();
  const t0 = 480;
  const t1 = 1080;
  const span = t1 - t0;
  const labelW = 168;
  const plotW = 720;
  const rowH = 14;
  const rows = DATA.rooms
    .map((room, ri) => ({
      room,
      idxs: DATA.items.map((_, i) => i).filter((i) => itemRoom(i, mode) === ri),
    }))
    .filter((r) => r.idxs.length > 0);
  const h = 22 + rows.length * rowH;
  const xAt = (m: number) => labelW + ((Math.max(t0, Math.min(t1, m)) - t0) / span) * plotW;
  return (
    <svg width="100%" viewBox={"0 0 " + (labelW + plotW + 8) + " " + h} role="img">
      <rect
        x={xAt(780)}
        y={18}
        width={xAt(840) - xAt(780)}
        height={rows.length * rowH}
        fill={theme.fill.tertiary}
      />
      {rows.map((row, yi) => {
        const y = 18 + yi * rowH;
        return (
          <g key={row.room}>
            <text x={0} y={y + 10} fill={theme.text.secondary} fontSize="9">
              {row.room.length > 26 ? row.room.slice(0, 24) + "…" : row.room}
            </text>
            {row.idxs.map((i) => {
              const s = spanAt(i, mode);
              const x = xAt(s.a);
              const w = Math.max(1, xAt(s.b) - x);
              const late = s.a >= 1020;
              return (
                <rect
                  key={i}
                  x={x}
                  y={y + 2}
                  width={w}
                  height={10}
                  fill={late ? theme.accent.primary : theme.fill.secondary}
                />
              );
            })}
          </g>
        );
      })}
      {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((hh) => (
        <text
          key={hh}
          x={xAt(hh * 60)}
          y={12}
          fill={theme.text.tertiary}
          fontSize="9"
        >
          {String(hh).padStart(2, "0")}
        </text>
      ))}
    </svg>
  );
}

export default function NaftaMatrix() {
  const [mode, setMode] = useState<Mode>("opt");
  const cats = hourCats();
  return (
    <Stack gap={16}>
      <H1>Nafta · {DATA.date} · WebOnly vs ERA слои</H1>
      <Text tone="secondary">
        Источник: nafta-clinic.webonly.io Reservations {DATA.date} ({DATA.items.length} слотов).
        Физио 09:00–17:00, обед 13–14. 4-камерная 08:00–18:00, женщины до обеда, мужчины после.
        UFF gel occupancy 10 + gap 0. UFB 1 мин → сетка 5. Лазер/дарсонваль gap 0. Парафин цикл 20.
        Solyuks с 24.08 — 4 юнита.
      </Text>
      <Grid columns={4} gap={12}>
        <Stat value={String(DATA.items.length)} label="Слотов WO" />
        <Stat value={String(DATA.names.length)} label="Гостей" />
        <Stat value={String(PACKED_LATE)} label="Вынос после 17:00 (opt)" />
        <Stat value={String(GEL_LATE)} label="Gel после 17:00" />
      </Grid>
      <Row gap={8} align="center">
        <Button variant={mode === "wo" ? "primary" : "secondary"} onClick={() => setMode("wo")}>
          1 · как в WO
        </Button>
        <Button variant={mode === "era" ? "primary" : "secondary"} onClick={() => setMode("era")}>
          2 · сетка 5
        </Button>
        <Button variant={mode === "opt" ? "primary" : "secondary"} onClick={() => setMode("opt")}>
          3 · слои + окна
        </Button>
      </Row>
      <Callout tone="warning" title="Правила 22.08">
        Gel Excel 10 (не 5). UFB 1 мин. Лазер и дарсонваль — пауза аппарата 0. Парафин 20 включая
        паузу. Остальные кабинеты 9–17. 4-камерная 8–18 + пол.
      </Callout>
      <H2>Лента дня · {mode}</H2>
      <DayStrip mode={mode} />
      <H2>Ёмкость vs спрос дня</H2>
      <Table
        headers={["Пул", "Юниты", "Occ", "Gap", "Rest", "Сегодня", "Потолок", "Овер"]}
        rows={CAP_ROWS.map((r) => [
          r.label,
          String(r.rooms),
          String(r.dur),
          String(r.gap),
          String(r.rest),
          String(r.today),
          String(r.cap),
          r.over ? "да" : "",
        ])}
      />
      <H2>Старт по часам (WO)</H2>
      <BarChart
        categories={cats}
        series={[
          {
            name: "Старты",
            data: cats.map((h) => DATA.hours[h] ?? 0),
          },
        ]}
        height={180}
      />
      <Divider />
      <Text tone="tertiary" size="small">
        Серая колонка на ленте — обед 13–14. Синие полосы — слоты после 17:00.
      </Text>
    </Stack>
  );
}
`;
}

function main() {
  const roomsJson = JSON.parse(fs.readFileSync(path.join(DUMP, "rooms.json"), "utf8"));
  const roomsById = new Map(roomsJson.data.map((r) => [r.id, r.name]));
  fs.mkdirSync(OUT, { recursive: true });
  for (const date of DATES) {
    const data = buildData(date, roomsById);
    const dest = path.join(OUT, fileFor(date));
    fs.writeFileSync(dest, canvasSource(data), "utf8");
    console.log(date, "items", data.items.length, "->", dest);
  }
}

main();
