import { reconcileClinicStays } from "@/lib/stay-reconcile";

const HOURS = new Set(["06", "18"]);

function bakuHourKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}`;
}

let lastSlot = "";
let timer: ReturnType<typeof setInterval> | undefined;

export function startClinicStayReconcile(): void {
  if (timer) return;
  const tick = () => {
    const key = bakuHourKey();
    const hour = key.slice(-2);
    if (!HOURS.has(hour) || key === lastSlot) return;
    lastSlot = key;
    void reconcileClinicStays()
      .then((result) => console.info("[clinic] stay reconcile", JSON.stringify(result)))
      .catch((err) => console.error("clinic stay reconcile failed", err));
  };
  timer = setInterval(tick, 30_000);
  if (typeof timer.unref === "function") timer.unref();
  setTimeout(() => {
    void reconcileClinicStays()
      .then((result) => console.info("[clinic] stay reconcile boot", JSON.stringify(result)))
      .catch((err) => console.error("clinic stay reconcile failed", err));
  }, 20_000).unref?.();
}
