const fs = require("fs");
const file = "D:/My Projects/era-ecosystem/era-clinic/app/nurse/page.tsx";
let src = fs.readFileSync(file, "utf8");
if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);

if (!src.includes('import { useClinicAuth }')) {
  src = src.replace(
    'import { PageHeader } from "@era/satellite-kit/ui";\n',
    'import { PageHeader } from "@era/satellite-kit/ui";\nimport { useClinicAuth } from "@/hooks/useClinicAuth";\n',
  );
}

if (!src.includes("const { auth } = useClinicAuth()")) {
  src = src.replace(
    `export default function NursePage() {
  const t = useTranslations("nurse");
  const tc = useTranslations("common");
  const [orders, setOrders] = useState<Proc[]>([]);`,
    `export default function NursePage() {
  const t = useTranslations("nurse");
  const tc = useTranslations("common");
  const { auth } = useClinicAuth();
  const [orders, setOrders] = useState<Proc[]>([]);
  const [mineOn, setMineOn] = useState(false);
  const [mineUnlinked, setMineUnlinked] = useState(false);
  const [mineDefaultApplied, setMineDefaultApplied] = useState(false);`,
  );
}

// Default mineOn for NURSE once auth loads
if (!src.includes("mineDefaultApplied")) {
  console.error("mine state not inserted");
  process.exit(1);
}

if (!src.includes("setMineDefaultApplied(true)")) {
  src = src.replace(
    `  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date });
    if (status) params.set("status", status);
    if (patient.trim()) params.set("patient", patient.trim());
    if (procedure.trim()) params.set("procedure", procedure.trim());
    if (overdueOnly) params.set("overdueOnly", "1");

    const res = await fetch(\`/api/procedures?\${params}\`);
    const d = await res.json();
    const payload = d.data ?? d;
    const rows = (Array.isArray(payload) ? payload : (payload.orders ?? [])) as Proc[];
    setOrders(rows);

    const overdueRes = await fetch("/api/nurse/overdue");
    if (overdueRes.ok) {
      const od = await overdueRes.json();
      setOverdue((od.data ?? od) as Proc[]);
    }
    setLoading(false);
  }, [date, status, patient, procedure, overdueOnly]);

  useEffect(() => {
    void load();
  }, [load]);`,
    `  useEffect(() => {
    if (mineDefaultApplied || !auth?.role) return;
    if (auth.role === "NURSE") setMineOn(true);
    setMineDefaultApplied(true);
  }, [auth?.role, mineDefaultApplied]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date });
    if (status) params.set("status", status);
    if (patient.trim()) params.set("patient", patient.trim());
    if (procedure.trim()) params.set("procedure", procedure.trim());
    if (overdueOnly) params.set("overdueOnly", "1");
    if (mineOn) params.set("mine", "1");

    const res = await fetch(\`/api/procedures?\${params}\`);
    const d = await res.json();
    const payload = d.data ?? d;
    const rows = (Array.isArray(payload) ? payload : (payload.orders ?? [])) as Proc[];
    setOrders(rows);
    setMineUnlinked(payload?.mineUnlinked === true);

    const overdueRes = await fetch("/api/nurse/overdue");
    if (overdueRes.ok) {
      const od = await overdueRes.json();
      setOverdue((od.data ?? od) as Proc[]);
    }
    setLoading(false);
  }, [date, status, patient, procedure, overdueOnly, mineOn]);

  useEffect(() => {
    void load();
  }, [load]);`,
  );
}

// Toggle UI after overdue checkbox
if (!src.includes('t("filterMine")')) {
  src = src.replace(
    `        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
            />
            {t("filterOverdueOnly")}
          </label>
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            {t("applyFilters")}
          </button>`,
    `        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-[13px] text-[#34495E]">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
            />
            {t("filterOverdueOnly")}
          </label>
          <div className="inline-flex overflow-hidden rounded-lg border border-[#D5DADF] text-[12px]">
            <button
              type="button"
              className={\`px-3 py-1.5 \${mineOn ? "bg-[#2980B9] text-white" : "bg-white text-[#34495E]"}\`}
              onClick={() => setMineOn(true)}
            >
              {t("filterMine")}
            </button>
            <button
              type="button"
              className={\`px-3 py-1.5 \${!mineOn ? "bg-[#2980B9] text-white" : "bg-white text-[#34495E]"}\`}
              onClick={() => setMineOn(false)}
            >
              {t("filterAll")}
            </button>
          </div>
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
            {t("applyFilters")}
          </button>`,
  );
}

if (!src.includes('t("mineUnlinked")')) {
  src = src.replace(
    `          <span className="text-[12px] text-[#7F8C8D]">
            {loading ? tc("loading") : t("resultCount", { count: orders.length })}
          </span>
        </div>
        <p className="text-[12px] text-[#7F8C8D]">{t("lifecycleHint")}</p>`,
    `          <span className="text-[12px] text-[#7F8C8D]">
            {loading ? tc("loading") : t("resultCount", { count: orders.length })}
          </span>
        </div>
        {mineUnlinked ? (
          <p className="text-[12px] text-amber-800">{t("mineUnlinked")}</p>
        ) : null}
        <p className="text-[12px] text-[#7F8C8D]">{t("lifecycleHint")}</p>`,
  );
}

// Reset should restore nurse default
src = src.replace(
  `            onClick={() => {
              setDate(todayBakuYmd());
              setStatus("ACTIVE");
              setPatient("");
              setProcedure("");
              setOverdueOnly(false);
            }}`,
  `            onClick={() => {
              setDate(todayBakuYmd());
              setStatus("ACTIVE");
              setPatient("");
              setProcedure("");
              setOverdueOnly(false);
              setMineOn(auth?.role === "NURSE");
              setMineUnlinked(false);
            }}`,
);

fs.writeFileSync(file, src, "utf8");
console.log("nurse page patched byte0=", fs.readFileSync(file)[0]);