"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, GHOST_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { cpAdminFetch } from "@/lib/cp-admin-fetch";

type DedupPerson = {
  id: string;
  fullName: string;
  birthDate: string | null;
  nationality: string | null;
  phoneMasked: string | null;
};

type DedupGroup = {
  matchType: string;
  nameClash: boolean;
  persons: DedupPerson[];
};

export default function MdmPersonDedupPage() {
  const t = useTranslations("superAdmin.mdmPersons");
  const [groups, setGroups] = useState<DedupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cpAdminFetch("mdm/persons/dedup");
      if (!res.ok) {
        setMessage(t("loadFailed", { status: res.status }));
        return;
      }
      const body = (await res.json()) as { groups?: DedupGroup[] };
      setGroups(body.groups ?? []);
      setMessage("");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function keep(survivorId: string, others: DedupPerson[]) {
    setMessage("");
    for (const other of others) {
      if (other.id === survivorId) continue;
      const res = await cpAdminFetch("mdm/persons/merge", {
        method: "POST",
        body: JSON.stringify({ sourcePersonId: other.id, targetPersonId: survivorId }),
      });
      if (!res.ok) {
        setMessage(t("mergeFailed", { status: res.status }));
        return;
      }
    }
    await reload();
  }

  async function dismiss(a: string, b: string) {
    setMessage("");
    const res = await cpAdminFetch("mdm/persons/dedup/dismiss", {
      method: "POST",
      body: JSON.stringify({ personIdA: a, personIdB: b }),
    });
    if (!res.ok) {
      setMessage(t("dismissFailed", { status: res.status }));
      return;
    }
    await reload();
  }

  return (
    <div className="space-y-4">
      <Link href="/mdm/persons" className="text-sm text-[#2980B9]">
        ← {t("title")}
      </Link>
      <h1 className="text-xl font-semibold text-[#34495E]">{t("dedupTitle")}</h1>
      <p className="text-sm text-[#7F8C8D]">{t("dedupHint")}</p>
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      {message ? <p className="text-sm text-red-700">{message}</p> : null}
      {!loading && groups.length === 0 ? <p className="text-sm text-[#7F8C8D]">{t("dedupEmpty")}</p> : null}
      {groups.map((group) => (
        <section key={`${group.matchType}:${group.persons.map((p) => p.id).join()}`} className={`${CARD_CONTAINER_CLASS} space-y-2 p-4`}>
          <h2 className="text-sm font-medium text-[#34495E]">
            {t(`match_${group.matchType}` as "match_PHONE")}
          </h2>
          {group.nameClash ? <p className="text-xs text-amber-700">{t("dedupNameClash")}</p> : null}
          <ul className="space-y-2">
            {group.persons.map((person) => (
              <li key={person.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{person.fullName || person.id}</span>
                <span className="text-[#7F8C8D]">
                  {[person.birthDate, person.nationality, person.phoneMasked].filter(Boolean).join(" · ")}
                </span>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  onClick={() => void keep(person.id, group.persons)}
                >
                  {t("dedupKeep")}
                </button>
              </li>
            ))}
          </ul>
          {group.persons.length >= 2 ? (
            <button
              type="button"
              className={GHOST_BUTTON_CLASS}
              onClick={() => void dismiss(group.persons[0]!.id, group.persons[1]!.id)}
            >
              {t("dedupDismiss")}
            </button>
          ) : null}
        </section>
      ))}
    </div>
  );
}
