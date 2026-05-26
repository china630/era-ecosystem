export type ResultLineInput = {
  code: string;
  value: string;
  unit?: string;
  refMin?: string;
  refMax?: string;
  flag?: "NORMAL" | "HIGH" | "LOW" | "CRITICAL";
};

export function enrichResultLines(lines: ResultLineInput[]): ResultLineInput[] {
  return lines.map((line) => {
    if (line.flag === "CRITICAL") return line;
    const num = parseFloat(line.value);
    const min = line.refMin != null ? parseFloat(line.refMin) : NaN;
    const max = line.refMax != null ? parseFloat(line.refMax) : NaN;
    let flag: ResultLineInput["flag"] = line.flag ?? "NORMAL";
    if (!Number.isNaN(num) && !Number.isNaN(min) && num < min) {
      flag = num < min * 0.5 ? "CRITICAL" : "LOW";
    }
    if (!Number.isNaN(num) && !Number.isNaN(max) && num > max) {
      flag = num > max * 1.5 ? "CRITICAL" : "HIGH";
    }
    return { ...line, flag };
  });
}

export function hasCriticalFlag(lines: ResultLineInput[]): boolean {
  return lines.some((l) => l.flag === "CRITICAL");
}
