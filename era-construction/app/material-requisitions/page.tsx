"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  FieldRow,
  FORM_STACK_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { apiJson } from "@/lib/client-api";
import { requisitionStatusOptions } from "@/lib/requisition-status";

type Requisition = {
  id: string;
  itemCode: string;
  description: string;
  qty: string | number;
  status: string;
  project: { code: string; name: string };
};

type Project = { id: string; code: string; name: string };

const formId = "new-requisition-form";

export default function MaterialRequisitionsPage() {
  const t = useTranslations("materialRequisitions");
  const tc = useTranslations("common");
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectCode, setProjectCode] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.code, label: `${p.code} — ${p.name}` })),
    [projects],
  );

  async function load() {
    const [reqRes, projRes] = await Promise.all([
      apiJson<Requisition[] | { data?: Requisition[] }>("/api/material-requisitions"),
      apiJson<Project[] | { data?: Project[] }>("/api/projects"),
    ]);
    if (!reqRes.ok) {
      setMessage(reqRes.error);
      setRequisitions([]);
    } else {
      const reqData = reqRes.data;
      setRequisitions(Array.isArray(reqData) ? reqData : reqData.data ?? []);
    }
    if (projRes.ok) {
      const projData = projRes.data;
      const list = Array.isArray(projData) ? projData : projData.data ?? [];
      setProjects(list);
      if (!projectCode && list[0]?.code) setProjectCode(list[0].code);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount load only
  }, []);

  async function createRequisition(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await apiJson<{ project?: { code?: string } }>("/api/material-requisitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectCode,
        itemCode,
        description,
        qty: Number(qty),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(res.error || t("createFailed"));
      return;
    }
    setMessage(t("created", { code: res.data.project?.code ?? projectCode }));
    setItemCode("");
    setDescription("");
    setQty("");
    setModalOpen(false);
    await load();
  }

  async function updateStatus(requisitionId: string, status: string) {
    const res = await apiJson("/api/material-requisitions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requisitionId, status }),
    });
    if (!res.ok) {
      setMessage(res.error);
      return;
    }
    await load();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
              {tc("create")}
            </button>
            <Link href="/projects" className={PRIMARY_BUTTON_CLASS}>
              {t("projects")}
            </Link>
          </>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} space-y-6 p-6`}>
        {message && <p className="text-[13px]">{message}</p>}
        {requisitions.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("empty")}</p>
        ) : (
          <ul className="space-y-2 text-[13px]">
            {requisitions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-end justify-between gap-2 rounded border p-2">
                <span>
                  {r.project.code}: {r.itemCode} — {r.description} ({Number(r.qty)})
                </span>
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={tc("status")}
                  value={r.status}
                  onChange={(v) => {
                    const next = String(v);
                    if (next === r.status) return;
                    void updateStatus(r.id, next);
                  }}
                  options={requisitionStatusOptions(r.status)}
                  hideLabel
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <ModalShell
        open={modalOpen}
        title={t("newRequisition")}
        onClose={() => setModalOpen(false)}
        closeLabel={tc("cancel")}
        footer={
          <ModalFooter
            formId={formId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={tc("create")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={formId} onSubmit={createRequisition} className={FORM_STACK_CLASS}>
          <CatalogField
            kind={projectOptions.length > 12 ? "SEARCHABLE" : "CLOSED_MEDIUM"}
            label={t("projectCode")}
            value={projectCode}
            onChange={(v) => setProjectCode(String(v))}
            options={projectOptions}
            required
          />
          <FieldRow cols={2}>
            <Field
              label={t("itemCode")}
              preset="code"
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              required
            />
            <Field
              label={t("qty")}
              preset="count"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </FieldRow>
          <Field
            label={t("description")}
            preset="shortText"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </form>
      </ModalShell>
    </>
  );
}
