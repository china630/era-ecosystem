"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  FieldRow,
  FORM_STACK_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Project = {
  id: string;
  code: string;
  name: string;
  progressActs: { id: string; amountNet: string | number; status: string }[];
};

const projectFormId = "construction-project-form";

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [projectCode, setProjectCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [amountNet, setAmountNet] = useState("0");
  const [boqItemCode, setBoqItemCode] = useState("");
  const [boqDescription, setBoqDescription] = useState("");
  const [boqQty, setBoqQty] = useState("");
  const [message, setMessage] = useState("");

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data ?? [];
      setProjects(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const boqLines = boqItemCode.trim()
        ? [
            {
              itemCode: boqItemCode.trim(),
              description: boqDescription.trim() || boqItemCode.trim(),
              plannedQty: Number(boqQty) || 1,
            },
          ]
        : undefined;
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectCode: projectCode.trim(),
          projectName: projectName.trim(),
          amountNet: Number(amountNet) || 0,
          boqLines,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? tc("error"));
      setMessage(t("created", { code: data.project.code }));
      setModalOpen(false);
      setProjectCode("");
      setProjectName("");
      setAmountNet("0");
      setBoqItemCode("");
      setBoqDescription("");
      setBoqQty("");
      await loadProjects();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : tc("error"));
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
              {t("addProject")}
            </button>
            <Link href="/material-requisitions" className={PRIMARY_BUTTON_CLASS}>
              {t("requisitions")}
            </Link>
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6`}>
        {message ? <p className="mb-3 text-[13px]">{message}</p> : null}
        {loading ? (
          <p className="text-[13px] text-[#7F8C8D]">{tc("loading")}</p>
        ) : projects.length === 0 ? (
          <p className="text-[13px] text-[#7F8C8D]">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block rounded border p-3 text-[13px] hover:border-[#2980B9]"
                >
                  <span className="font-semibold">{p.code}</span> — {p.name}
                  <span className="ml-2 text-[#7F8C8D]">
                    {t("progressActs", { count: p.progressActs.length })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ModalShell
        open={modalOpen}
        title={t("addProject")}
        onClose={() => setModalOpen(false)}
        closeLabel={tc("cancel")}
        footer={
          <ModalFooter
            formId={projectFormId}
            onCancel={() => setModalOpen(false)}
            busy={loading}
            submitLabel={t("createProject")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={projectFormId} onSubmit={createProject} className={FORM_STACK_CLASS}>
          <FieldRow cols={2}>
            <Field
              label={t("projectCode")}
              preset="code"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              required
            />
            <Field
              label={t("projectName")}
              preset="shortText"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
            />
          </FieldRow>
          <Field
            label={t("amountNet")}
            preset="amount"
            type="number"
            value={amountNet}
            onChange={(e) => setAmountNet(e.target.value)}
            required
          />
          <FieldRow cols={2}>
            <Field
              label={t("boqItemCode")}
              preset="code"
              value={boqItemCode}
              onChange={(e) => setBoqItemCode(e.target.value)}
            />
            <Field
              label={t("boqQty")}
              preset="count"
              value={boqQty}
              onChange={(e) => setBoqQty(e.target.value)}
            />
          </FieldRow>
          <Field
            label={t("boqDescription")}
            preset="shortText"
            value={boqDescription}
            onChange={(e) => setBoqDescription(e.target.value)}
          />
        </form>
      </ModalShell>
    </>
  );
}
