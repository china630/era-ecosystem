const fs = require("fs");
const p =
  "D:/My Projects/era-ecosystem/era-clinic/src/components/sanatorium/ResourceDayMatrix.tsx";
let s = fs.readFileSync(p, "utf8");

const old = `        <div className="relative max-h-[70vh] overflow-auto rounded border border-[#D5DADF]">
          <div
            className="relative min-w-max"
            style={{ display: "grid", gridTemplateColumns: gridCols }}
          >`;

const neu = `        <div className="relative max-h-[70vh] overflow-auto rounded border border-[#D5DADF]">
          <div className="relative min-w-max">
          <div
            style={{ display: "grid", gridTemplateColumns: gridCols }}
          >`;

if (!s.includes(old)) {
  console.error("wrapper start not found");
  process.exit(1);
}
s = s.replace(old, neu);

const oldEnd = `            {nowLinePct != null ? (
              <div
                className="pointer-events-none absolute bottom-0 top-8 z-40 w-0.5 bg-red-500"
                style={{
                  left: \`calc(10rem + (100% - 10rem) * \${nowLinePct / 100})\`,
                }}
                title={labels.now}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-500 px-1 text-[9px] text-white">
                  {labels.now}
                </span>
              </div>
            ) : null}
          </div>
        </div>`;

const newEnd = `          </div>
            {nowLinePct != null ? (
              <div
                className="pointer-events-none absolute bottom-0 top-8 z-40 w-0.5 bg-red-500"
                style={{
                  left: \`calc(10rem + (100% - 10rem) * \${nowLinePct / 100})\`,
                }}
                title={labels.now}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-500 px-1 text-[9px] text-white">
                  {labels.now}
                </span>
              </div>
            ) : null}
          </div>
        </div>`;

if (!s.includes("nowLinePct != null")) {
  console.error("nowline missing");
  process.exit(1);
}
if (!s.includes(oldEnd)) {
  // try without exact match - read file around nowline
  console.error("exact end not found, dumping snippet");
  const i = s.indexOf("nowLinePct");
  console.log(JSON.stringify(s.slice(i, i + 500)));
  process.exit(1);
}
s = s.replace(oldEnd, newEnd);
fs.writeFileSync(p, s, "utf8");
console.log("nowline fixed", fs.readFileSync(p)[0]);