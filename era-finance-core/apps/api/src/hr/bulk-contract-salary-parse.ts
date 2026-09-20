export type BulkSalarySkipReason =
  | "bad_uuid"
  | "salary_not_positive"
  | "too_few_columns";

const UUID_RE = /^[0-9a-f-]{36}$/i;

export function parseBulkContractSalaryCsv(text: string): {
  items: Array<{
    employeeId: string;
    salary: number;
    internalRate?: number | null;
  }>;
  skipped: Array<{ line: number; reason: BulkSalarySkipReason; raw: string }>;
} {
  const lines = text.split(/\r?\n/);
  const items: Array<{
    employeeId: string;
    salary: number;
    internalRate?: number | null;
  }> = [];
  const skipped: Array<{
    line: number;
    reason: BulkSalarySkipReason;
    raw: string;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const raw = lines[i] ?? "";
    const line = raw.trim();
    if (!line) continue;

    const lower = line.toLowerCase();
    if (lower.startsWith("employeeid") || lower.startsWith("employee_id")) {
      continue;
    }

    const parts = line
      .split(/[,;\t]/)
      .map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2) {
      skipped.push({ line: lineNum, reason: "too_few_columns", raw });
      continue;
    }

    const employeeId = parts[0]!;
    const salary = Number(String(parts[1]).replace(",", "."));

    if (!UUID_RE.test(employeeId)) {
      skipped.push({ line: lineNum, reason: "bad_uuid", raw });
      continue;
    }

    if (!Number.isFinite(salary) || salary <= 0) {
      skipped.push({ line: lineNum, reason: "salary_not_positive", raw });
      continue;
    }

    const item: {
      employeeId: string;
      salary: number;
      internalRate?: number | null;
    } = { employeeId, salary };
    if (parts[2] != null && parts[2] !== "") {
      const ir = Number(String(parts[2]).replace(",", "."));
      if (Number.isFinite(ir) && ir >= 0) item.internalRate = ir;
    }
    items.push(item);
  }

  return { items, skipped };
}
