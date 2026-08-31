"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FORM_STACK_CLASS,
  ListPaginationFooter,
  MODAL_CHECKBOX_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type LookupRow = {
  id: string;
  kind: string;
  code: string;
  name: string;
  active: boolean;
  sortOrder: number;
};

export default function ClinicLookupsAdminPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const formId = useId();
  const [rows, setRows] = useState<LookupRow[]>([]);
  const [edit, setEdit] = useState<LookupRow | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/lookups?kind=BODY_PART");
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title={t("lookupsTitle", { defaultValue: "Clinic lookups" })}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => {
              setEdit(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {tc("add")}
          </button>
        }
      />
      <p className="text-[13px] text-[#7F8C8D]">
        {t("lookupsBodyPartHint", {
          defaultValue: "BodyPart catalog (SatAdmin T1). Seeded codes match clinical UI.",
        })}
      </p>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code", { defaultValue: "Code" })}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("name", { defaultValue: "Name" })}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>
                {t("active", { defaultValue: "Active" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => (
              <tr
                key={row.id}
                className={`${DATA_TABLE_TR_CLASS} cursor-pointer`}
                onClick={() => {
                  setEdit(row);
                  setOpen(true);
                }}
              >
                <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.name}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.active ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListPaginationFooter
        page={page}
        pageSize={pageSize}
        total={rows.length}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        labels={{
          rowsPerPage: tc("rowsPerPage"),
          pageOf: tc("pageOf"),
          prev: tc("prev"),
          next: tc("next"),
        }}
      />

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title={edit ? tc("edit") : tc("add")}
        footer={
          <ModalFooter
            formId={formId}
            onCancel={() => setOpen(false)}
            busy={busy}
            submitLabel={edit ? tc("save") : tc("add")}
          />
        }
      >
        <form
          id={formId}
          className={FORM_STACK_CLASS}
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setBusy(true);
            try {
              if (edit) {
                await fetch(`/api/admin/lookups/${edit.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: String(fd.get("name") ?? ""),
                    active: fd.get("active") === "on",
                    sortOrder: Number(fd.get("sortOrder") ?? 0),
                  }),
                });
              } else {
                await fetch("/api/admin/lookups", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    kind: "BODY_PART",
                    code: String(fd.get("code") ?? ""),
                    name: String(fd.get("name") ?? ""),
                    sortOrder: Number(fd.get("sortOrder") ?? 0),
                  }),
                });
              }
              setOpen(false);
              await load();
            } finally {
              setBusy(false);
            }
          }}
        >
          {!edit ? (
            <Field label="Code" preset="code" name="code" required defaultValue="" />
          ) : (
            <Field label="Code" preset="code" value={edit.code} readOnly />
          )}
          <Field
            label="Name"
            preset="shortText"
            name="name"
            required
            defaultValue={edit?.name ?? ""}
          />
          <Field
            label="Sort"
            preset="count"
            name="sortOrder"
            type="number"
            defaultValue={edit?.sortOrder ?? 0}
          />
          {edit ? (
            <label className="flex items-center gap-2 text-[13px]">
              <input
                name="active"
                type="checkbox"
                className={MODAL_CHECKBOX_CLASS}
                defaultChecked={edit.active}
              />
              Active
            </label>
          ) : null}
        </form>
      </ModalShell>
    </div>
  );
}
