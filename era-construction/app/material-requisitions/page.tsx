"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type Requisition = {
  id: string;
  itemCode: string;
  description: string;
  qty: string | number;
  status: string;
  project: { code: string; name: string };
};

const formId = "new-requisition-form";

export default function MaterialRequisitionsPage() {
  const t = useTranslations("materialRequisitions");
  const tc = useTranslations("common");
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [projectCode, setProjectCode] = useState("PRJ-001");
  const [itemCode, setItemCode] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/material-requisitions");
    const data = await res.json();
    setRequisitions(Array.isArray(data) ? data : data.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createRequisition(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/material-requisitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectCode,
        itemCode,
        description,
        qty: Number(qty),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? t("createFailed"));
      return;
    }
    setMessage(t("created", { code: data.project?.code ?? projectCode }));
    setItemCode("");
    setDescription("");
    setQty("");
    setModalOpen(false);
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
        <ul className="space-y-2 text-[13px]">
          {requisitions.map((r) => (
            <li key={r.id} className="rounded border p-2">
              {r.project.code}: {r.itemCode} — {r.description} ({Number(r.qty)})
            </li>
          ))}
        </ul>
      </div>

      <ModalShell
        open={modalOpen}
        title={t("newRequisition")}
        onClose={() => setModalOpen(false)}
        closeLabel={tc("close")}
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
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("projectCode")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("itemCode")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={itemCode}
              onChange={(e) => setItemCode(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("description")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>{t("qty")}</label>
            <input
              className={MODAL_INPUT_CLASS}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>
        </form>
      </ModalShell>
    </>
  );
}
