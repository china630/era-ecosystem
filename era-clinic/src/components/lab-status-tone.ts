/** Pipeline color for a lab order: ordered, in flight, done, cancelled. */
export function labStatusTone(status: string): { dot: string; text: string } {
  if (status === "ORDERED") return { dot: "bg-[#E74C3C]", text: "text-[#E74C3C]" };
  if (status === "COLLECTED" || status === "IN_PROGRESS" || status === "RESULT_READY") {
    return { dot: "bg-[#F1C40F]", text: "text-[#B7950B]" };
  }
  if (status === "PUBLISHED" || status === "COMPLETED") {
    return { dot: "bg-[#27AE60]", text: "text-[#27AE60]" };
  }
  return { dot: "bg-slate-300", text: "text-slate-400" };
}
