const fs = require("fs");

// Fix procedures print fragment keys
const proc = "era-clinic/app/print/procedures/[patientId]/page.tsx";
let s = fs.readFileSync(proc, "utf8");
if (!s.includes("Fragment")) {
  s = s.replace(
    'import { notFound } from "next/navigation";',
    'import { Fragment } from "react";\nimport { notFound } from "next/navigation";',
  );
  s = s.replace(
    `{doc.rowsByDate.map((group) => (
            <>
              <tr key={\`d-\${group.date}\`} className="bg-neutral-100">`,
    `{doc.rowsByDate.map((group) => (
            <Fragment key={group.date}>
              <tr className="bg-neutral-100">`,
  );
  s = s.replace(
    `              ))}
            </>
          ))}`,
    `              ))}
            </Fragment>
          ))}`,
  );
  fs.writeFileSync(proc, s, "utf8");
  console.log("procedures fragment fixed");
}

// Admin analyte form fields
const admin = "era-clinic/app/admin/diagnostic-catalog/page.tsx";
let a = fs.readFileSync(admin, "utf8");
if (!a.includes("valueType")) {
  a = a.replace(
    `type DiagnosticAnalyte = {
  id: string;
  serviceId: string;
  code: string;
  unit?: string | null;
  labelEn: string;
  labelRu: string;
  labelAz: string;
  refMin?: string | null;
  refMax?: string | null;
  sortOrder: number;
};`,
    `type DiagnosticAnalyte = {
  id: string;
  serviceId: string;
  code: string;
  unit?: string | null;
  labelEn: string;
  labelRu: string;
  labelAz: string;
  refMin?: string | null;
  refMax?: string | null;
  section?: string | null;
  valueType?: string;
  sortOrder: number;
  valueOptions?: Array<{
    code: string;
    labelEn: string;
    labelRu: string;
    labelAz: string;
    sortOrder?: number;
  }>;
};`,
  );
  a = a.replace(
    `setForm({
      code: row.code,
      unit: row.unit ?? "",
      labelEn: row.labelEn,
      labelRu: row.labelRu,
      labelAz: row.labelAz,
      refMin: row.refMin ?? "",
      refMax: row.refMax ?? "",
      sortOrder: String(row.sortOrder),
    });`,
    `setForm({
      code: row.code,
      unit: row.unit ?? "",
      labelEn: row.labelEn,
      labelRu: row.labelRu,
      labelAz: row.labelAz,
      refMin: row.refMin ?? "",
      refMax: row.refMax ?? "",
      section: row.section ?? "",
      valueType: row.valueType ?? "NUMERIC",
      valueOptionsJson: row.valueOptions?.length
        ? JSON.stringify(row.valueOptions, null, 2)
        : "",
      sortOrder: String(row.sortOrder),
    });`,
  );
  a = a.replace(
    `const payload = {
        code: form.code?.trim(),
        unit: form.unit?.trim() || null,
        labelEn: form.labelEn?.trim(),
        labelRu: form.labelRu?.trim(),
        labelAz: form.labelAz?.trim(),
        refMin: form.refMin?.trim() || null,
        refMax: form.refMax?.trim() || null,
        sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
      };`,
    `let valueOptions;
      if (form.valueOptionsJson?.trim()) {
        try {
          valueOptions = JSON.parse(form.valueOptionsJson);
        } catch {
          setMsg("Invalid valueOptions JSON");
          return;
        }
      }
      const payload = {
        code: form.code?.trim(),
        unit: form.unit?.trim() || null,
        labelEn: form.labelEn?.trim(),
        labelRu: form.labelRu?.trim(),
        labelAz: form.labelAz?.trim(),
        refMin: form.refMin?.trim() || null,
        refMax: form.refMax?.trim() || null,
        section: form.section?.trim() || null,
        valueType: form.valueType === "QUALITATIVE" ? "QUALITATIVE" : "NUMERIC",
        sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
        ...(valueOptions ? { valueOptions } : {}),
      };`,
  );
  a = a.replace(
    `{tab === "analytes" && (
            <>
              <Field
                label={t("code")}
                preset="code"
                value={form.code ?? ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <Field
                label={t("unit")}
                preset="shortText"
                value={form.unit ?? ""}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />`,
    `{tab === "analytes" && (
            <>
              <Field
                label={t("code")}
                preset="code"
                value={form.code ?? ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <Field
                label={t("unit")}
                preset="shortText"
                value={form.unit ?? ""}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
              <Field
                label="Section"
                preset="shortText"
                value={form.section ?? ""}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
              />
              <FieldSelect
                label="Value type"
                preset="select"
                value={form.valueType ?? "NUMERIC"}
                onChange={(e) => setForm({ ...form, valueType: e.target.value })}
              >
                <option value="NUMERIC">NUMERIC</option>
                <option value="QUALITATIVE">QUALITATIVE</option>
              </FieldSelect>
              <FieldTextarea
                label="Value options JSON"
                hint='[{"code":"neg","labelEn":"Negative","labelRu":"Отриц.","labelAz":"Neqativ"}]'
                value={form.valueOptionsJson ?? ""}
                onChange={(e) => setForm({ ...form, valueOptionsJson: e.target.value })}
              />`,
  );
  fs.writeFileSync(admin, a, "utf8");
  console.log("admin analytes patched");
} else {
  console.log("admin already has valueType");
}
