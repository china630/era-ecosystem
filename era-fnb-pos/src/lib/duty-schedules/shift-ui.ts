/** Visual helpers for F&B WEEK_PERSON cədvəl (not catalog SoR). */

export function shiftChipClass(code: string, orphaned?: boolean): string {
  if (orphaned) {
    return "bg-amber-100 text-amber-900 border-amber-300";
  }
  switch (code) {
    case "E":
      return "bg-sky-50 text-sky-900 border-sky-200";
    case "A":
      return "bg-cyan-50 text-cyan-900 border-cyan-200";
    case "L":
      return "bg-violet-50 text-violet-900 border-violet-200";
    case "P":
      return "bg-indigo-50 text-indigo-900 border-indigo-200";
    case "N":
      return "bg-slate-800 text-slate-50 border-slate-700";
    case "OFF":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "EG":
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
    case "IB":
      return "bg-rose-50 text-rose-900 border-rose-200";
    default:
      return "bg-white text-slate-800 border-slate-200";
  }
}

export function dayHeaderClass(ymd: string, todayYmd: string): string {
  const dow = new Date(`${ymd}T12:00:00.000Z`).getUTCDay();
  const weekend = dow === 0 || dow === 6;
  const isToday = ymd === todayYmd;
  if (isToday) return "bg-sky-50 text-sky-900";
  if (weekend) return "bg-slate-50 text-slate-500";
  return "";
}
