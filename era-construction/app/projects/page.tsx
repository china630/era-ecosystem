"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

type Project = {
  id: string;
  code: string;
  name: string;
  progressActs: { id: string; amountNet: string | number; status: string }[];
};

export default function ProjectsPage() {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.data ?? [];
        setProjects(list);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/material-requisitions" className={PRIMARY_BUTTON_CLASS}>
            {t("requisitions")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6`}>
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
    </>
  );
}
