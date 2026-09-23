"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  CatalogField,
  EraDataGrid,
  LIST_PAGE_SHELL_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";
import { WorkforceShiftsSubnav } from "../../../../../components/workspace/workforce-shifts-subnav";
import type { Brigade, Employment } from "../_lib/types";

export default function WorkforceBrigadesPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceRoster");
  const tCommon = useTranslations("common");

  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [employments, setEmployments] = useState<Employment[]>([]);
  const [persons, setPersons] = useState<
    Record<string, { displayName: string | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [brigadeOpen, setBrigadeOpen] = useState(false);
  const [brigadeEditId, setBrigadeEditId] = useState<string | null>(null);
  const [brigadeCode, setBrigadeCode] = useState("");
  const [brigadeName, setBrigadeName] = useState("");
  const [brigadeMemberIds, setBrigadeMemberIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [bRes, eRes] = await Promise.all([
      wfFetch("brigades"),
      wfFetch("employments?status=ACTIVE&pageSize=200"),
    ]);
    if (await isWorkforceGate403(bRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (bRes.ok) setBrigades(await bRes.json());
    else setError(t("loadError"));
    if (eRes.ok) {
      const body = await eRes.json();
      const items = Array.isArray(body) ? body : (body.items ?? []);
      setEmployments(items);
      if (!Array.isArray(body) && body.persons) setPersons(body.persons);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function saveBrigade() {
    if (!brigadeName.trim() || (!brigadeEditId && !brigadeCode.trim())) {
      setFormError(t("requiredFields"));
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = brigadeEditId
      ? await wfFetch(`brigades/${brigadeEditId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: brigadeName.trim(),
            employmentIds: brigadeMemberIds,
          }),
        })
      : await wfFetch("brigades", {
          method: "POST",
          body: JSON.stringify({
            code: brigadeCode.trim(),
            name: brigadeName.trim(),
            employmentIds: brigadeMemberIds,
          }),
        });
    setBusy(false);
    if (!res.ok) {
      setFormError(t("saveError"));
      return;
    }
    setBrigadeOpen(false);
    await load();
  }

  function openCreateBrigade() {
    setBrigadeEditId(null);
    setBrigadeCode("");
    setBrigadeName("");
    setBrigadeMemberIds([]);
    setFormError(null);
    setBrigadeOpen(true);
  }

  function openEditBrigade(row: Brigade) {
    setBrigadeEditId(row.id);
    setBrigadeCode(row.code);
    setBrigadeName(row.name);
    setBrigadeMemberIds((row.members ?? []).map((m) => m.employmentId));
    setFormError(null);
    setBrigadeOpen(true);
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  const empOptions = employments.map((e) => ({
    value: e.id,
    label:
      (e.globalPersonId && persons[e.globalPersonId]?.displayName?.trim()) ||
      e.staffCode ||
      tCommon("unnamedPerson"),
  }));

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("brigadesHeading")}
          subtitle={t("brigadesHint")}
          actions={
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreateBrigade}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {t("addBrigade")}
            </button>
          }
        />
      </div>
      <div className="shrink-0">
        <WorkforceShiftsSubnav />
      </div>

      {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}
      <div className="flex min-h-0 flex-1 flex-col">
        <EraDataGrid
          layout="fill"
          columns={[
            { key: "code", header: t("colCode") },
            { key: "name", header: t("colName") },
            {
              key: "members",
              header: t("colMembers"),
              render: (row) => String(row._count?.members ?? row.members?.length ?? 0),
            },
            {
              key: "actions",
              header: "",
              className: "w-24",
              render: (row) => (
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => openEditBrigade(row)}
                >
                  {tCommon("edit")}
                </button>
              ),
            },
          ]}
          rows={brigades}
          rowKey={(row) => row.id}
          emptyMessage={loading ? tCommon("loading") : t("brigadesEmpty")}
          paginationLabels={{
            rowsPerPage: tCommon("paginationRowsPerPage"),
            pageOf: tCommon("paginationPageOf"),
            prev: tCommon("paginationPrev"),
            next: tCommon("paginationNext"),
          }}
        />
      </div>

      <ModalShell
        open={brigadeOpen}
        onClose={() => setBrigadeOpen(false)}
        title={brigadeEditId ? t("editBrigade") : t("addBrigade")}
        closeLabel={tCommon("close")}
        footer={
          <ModalFooter
            onCancel={() => setBrigadeOpen(false)}
            onSubmit={() => void saveBrigade()}
            busy={busy}
            cancelLabel={tCommon("cancel")}
            submitLabel={tCommon("save")}
          />
        }
      >
        <div className="space-y-3">
          {!brigadeEditId ? (
            <CatalogField
              kind="FREE_TEXT"
              label={t("colCode")}
              value={brigadeCode}
              onChange={(v) => setBrigadeCode(String(v))}
              options={[]}
            />
          ) : null}
          <CatalogField
            kind="FREE_TEXT"
            label={t("colName")}
            value={brigadeName}
            onChange={(v) => setBrigadeName(String(v))}
            options={[]}
          />
          <CatalogField
            kind="MULTI"
            label={t("colMembers")}
            value={brigadeMemberIds}
            onChange={(v) =>
              setBrigadeMemberIds(Array.isArray(v) ? v.map(String) : [])
            }
            options={empOptions}
          />
          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </div>
      </ModalShell>
    </div>
  );
}
