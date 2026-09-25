"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Plus, Trash2, Unlink } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  FORM_INPUT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  parseApiError,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { getOrchAccessToken, orchFetch } from "../../lib/orch-api";
import { useRequireAuth } from "../../lib/use-require-auth";

type HoldingOrg = { id: string; name: string };
type Holding = {
  id: string;
  name: string;
  baseCurrency: string;
  ownerId: string;
  organizations: HoldingOrg[];
};
type HoldingMember = {
  userId: string;
  role: string;
  user: { id: string; email: string };
};

export default function HoldingsPage() {
  const { ready, user } = useRequireAuth();
  const { memberships } = useAuth();
  const t = useTranslations("holdings");
  const tCommon = useTranslations("common");

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<HoldingMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCurrency, setCreateCurrency] = useState("AZN");

  const [attachOrgId, setAttachOrgId] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("VIEWER");
  const [memberNotice, setMemberNotice] = useState<string | null>(null);
  const [memberCandidates, setMemberCandidates] = useState<
    Array<{ userId: string; email: string }>
  >([]);

  const token = getOrchAccessToken();
  const selected = holdings.find((h) => h.id === selectedId) ?? null;
  const isOwner = selected != null && user?.id === selected.ownerId;

  const attachedIds = new Set(
    holdings.flatMap((h) => h.organizations.map((o) => o.id)),
  );
  const attachableOrgs = memberships.filter(
    (m) =>
      (m.role === "OWNER" || m.isOwner) &&
      !attachedIds.has(m.organizationId),
  );

  const loadHoldings = useCallback(async () => {
    if (!token) return;
    const res = await orchFetch("/v1/holdings", { token });
    if (!res.ok) {
      setError(parseApiError(await res.text().catch(() => null), t("loadFailed")));
      return;
    }
    const data = (await res.json()) as Holding[];
    setHoldings(data);
    setSelectedId((prev) => {
      if (prev && data.some((h) => h.id === prev)) return prev;
      return data[0]?.id ?? null;
    });
  }, [token, t]);

  const loadMembers = useCallback(async (holdingId: string) => {
    if (!token) return;
    const [memRes, candRes] = await Promise.all([
      orchFetch(`/v1/holdings/${holdingId}/members`, { token }),
      orchFetch(`/v1/holdings/${holdingId}/member-candidates`, { token }),
    ]);
    if (!memRes.ok) {
      setMembers([]);
    } else {
      setMembers((await memRes.json()) as HoldingMember[]);
    }
    if (candRes.ok) {
      setMemberCandidates(
        (await candRes.json()) as Array<{ userId: string; email: string }>,
      );
    } else {
      setMemberCandidates([]);
    }
  }, [token]);

  useEffect(() => {
    if (!ready || !token) return;
    void loadHoldings();
  }, [ready, token, loadHoldings]);

  useEffect(() => {
    if (!selectedId || !isOwner) {
      setMembers([]);
      return;
    }
    void loadMembers(selectedId);
  }, [selectedId, isOwner, loadMembers]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || busy || !createName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch("/v1/holdings", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: createName.trim(),
          baseCurrency: createCurrency,
        }),
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), t("createFailed")));
        return;
      }
      const created = (await res.json()) as Holding;
      setCreateOpen(false);
      setCreateName("");
      await loadHoldings();
      setSelectedId(created.id);
    } finally {
      setBusy(false);
    }
  }

  async function attachOrg() {
    if (!token || !selectedId || !attachOrgId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch(
        `/v1/holdings/${selectedId}/organizations/${attachOrgId}`,
        { method: "POST", token },
      );
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), t("attachFailed")));
        return;
      }
      setAttachOrgId("");
      await loadHoldings();
    } finally {
      setBusy(false);
    }
  }

  async function detachOrg(organizationId: string) {
    if (!token || !selectedId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch(
        `/v1/holdings/${selectedId}/organizations/${organizationId}`,
        { method: "DELETE", token },
      );
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), t("detachFailed")));
        return;
      }
      await loadHoldings();
    } finally {
      setBusy(false);
    }
  }

  async function addMember() {
    if (!token || !selectedId || busy) return;
    if (!memberUserId.trim() && !memberEmail.trim()) return;
    setBusy(true);
    setError(null);
    setMemberNotice(null);
    try {
      const res = await orchFetch(`/v1/holdings/${selectedId}/members`, {
        method: "POST",
        token,
        body: JSON.stringify({
          ...(memberUserId.trim()
            ? { userId: memberUserId.trim() }
            : { email: memberEmail.trim().toLowerCase() }),
          role: memberRole,
        }),
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), t("memberFailed")));
        return;
      }
      const body = (await res.json()) as { invited?: boolean; email?: string };
      setMemberUserId("");
      setMemberEmail("");
      if (body.invited) {
        setMemberNotice(t("memberInvited", { email: body.email ?? memberEmail }));
      }
      await loadMembers(selectedId);
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    if (!token || !selectedId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch(
        `/v1/holdings/${selectedId}/members/${userId}`,
        { method: "DELETE", token },
      );
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), t("memberFailed")));
        return;
      }
      await loadMembers(selectedId);
    } finally {
      setBusy(false);
    }
  }

  async function deleteHolding() {
    if (!token || !selectedId || busy) return;
    if (!window.confirm(t("deleteConfirm"))) return;
    setBusy(true);
    setError(null);
    try {
      const res = await orchFetch(`/v1/holdings/${selectedId}`, {
        method: "DELETE",
        token,
      });
      if (!res.ok) {
        setError(parseApiError(await res.text().catch(() => null), t("deleteFailed")));
        return;
      }
      setSelectedId(null);
      await loadHoldings();
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-[#7F8C8D]">{tCommon("loading")}</p>;
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("create")}
          </button>
        }
      />

      {error ? (
        <p className="mb-4 text-sm text-[#C0392B]" role="alert">
          {error}
        </p>
      ) : null}

      {holdings.length === 0 ? (
        <div
          className={`${CARD_CONTAINER_CLASS} flex min-h-[16rem] w-full flex-col items-center justify-center p-8 text-center`}
        >
          <Building2 className="h-10 w-10 text-[#95A5A6]" aria-hidden />
          <h2 className="mt-4 text-lg font-semibold text-[#34495E]">{t("emptyTitle")}</h2>
          <p className="mt-2 max-w-md text-sm text-[#7F8C8D]">{t("emptyHint")}</p>
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} mt-6`}
            onClick={() => setCreateOpen(true)}
          >
            {t("create")}
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className={`${CARD_CONTAINER_CLASS} p-3`}>
            <ul className="space-y-1">
              {holdings.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                      h.id === selectedId
                        ? "bg-[#2980B9]/10 font-medium text-[#2980B9]"
                        : "text-[#34495E] hover:bg-[#ECF0F1]"
                    }`}
                    onClick={() => setSelectedId(h.id)}
                  >
                    <span className="block truncate">{h.name}</span>
                    <span className="text-xs text-[#7F8C8D]">
                      {h.baseCurrency} · {h.organizations.length} {t("orgCount")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {selected ? (
            <div className="space-y-4">
              <div className={`${CARD_CONTAINER_CLASS} p-5`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[#34495E]">
                      {selected.name}
                    </h2>
                    <p className="text-sm text-[#7F8C8D]">
                      {t("baseCurrency")}: {selected.baseCurrency}
                    </p>
                  </div>
                  {isOwner ? (
                    <button
                      type="button"
                      className={`${SECONDARY_BUTTON_CLASS} text-[#C0392B]`}
                      onClick={() => void deleteHolding()}
                      disabled={busy}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                      {t("delete")}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={`${CARD_CONTAINER_CLASS} p-5`}>
                <h3 className="mb-3 font-semibold text-[#34495E]">{t("orgsTitle")}</h3>
                {selected.organizations.length === 0 ? (
                  <p className="text-sm text-[#7F8C8D]">{t("orgsEmpty")}</p>
                ) : (
                  <ul className="divide-y divide-[#ECF0F1]">
                    {selected.organizations.map((o) => (
                      <li
                        key={o.id}
                        className="flex items-center justify-between gap-2 py-2 text-sm"
                      >
                        <span className="text-[#34495E]">{o.name}</span>
                        {isOwner ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-[#7F8C8D] hover:text-[#C0392B]"
                            onClick={() => void detachOrg(o.id)}
                            disabled={busy}
                          >
                            <Unlink className="h-3.5 w-3.5" aria-hidden />
                            {t("detach")}
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {isOwner ? (
                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <label className="min-w-[200px] flex-1">
                      <span className={MODAL_FIELD_LABEL_CLASS}>{t("attachOrg")}</span>
                      <select
                        className={FORM_INPUT_CLASS}
                        value={attachOrgId}
                        onChange={(e) => setAttachOrgId(e.target.value)}
                      >
                        <option value="">{t("selectOrg")}</option>
                        {attachableOrgs.map((m) => (
                          <option key={m.organizationId} value={m.organizationId}>
                            {m.organizationName ?? m.organizationId}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={!attachOrgId || busy}
                      onClick={() => void attachOrg()}
                    >
                      {t("attach")}
                    </button>
                  </div>
                ) : null}
              </div>

              {isOwner ? (
                <div className={`${CARD_CONTAINER_CLASS} p-5`}>
                  <h3 className="mb-3 font-semibold text-[#34495E]">
                    {t("membersTitle")}
                  </h3>
                  {memberNotice ? (
                    <p className="mb-2 text-sm text-emerald-700">{memberNotice}</p>
                  ) : null}
                  {members.length === 0 ? (
                    <p className="text-sm text-[#7F8C8D]">{t("membersEmpty")}</p>
                  ) : (
                    <ul className="divide-y divide-[#ECF0F1]">
                      {members.map((m) => (
                        <li
                          key={m.userId}
                          className="flex items-center justify-between gap-2 py-2 text-sm"
                        >
                          <span>
                            {m.user.email}{" "}
                            <span className="text-[#7F8C8D]">({m.role})</span>
                          </span>
                          <button
                            type="button"
                            className="text-[#7F8C8D] hover:text-[#C0392B]"
                            onClick={() => void removeMember(m.userId)}
                            disabled={busy}
                          >
                            {t("removeMember")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex flex-wrap items-end gap-2">
                    <div className="min-w-[200px] flex-1">
                      <CatalogField
                        kind="SEARCHABLE"
                        label={t("memberPick")}
                        value={memberUserId}
                        onChange={(v) => {
                          setMemberUserId(String(v));
                          setMemberEmail("");
                        }}
                        options={memberCandidates.map((c) => ({
                          value: c.userId,
                          label: c.email,
                        }))}
                        emptyLabel={t("memberPickEmpty")}
                      />
                    </div>
                    <label className="min-w-[180px] flex-1">
                      <span className={MODAL_FIELD_LABEL_CLASS}>{t("memberEmail")}</span>
                      <input
                        className={FORM_INPUT_CLASS}
                        type="email"
                        value={memberEmail}
                        onChange={(e) => {
                          setMemberEmail(e.target.value);
                          setMemberUserId("");
                        }}
                        placeholder="name@company.az"
                      />
                    </label>
                    <div className="min-w-[140px]">
                      <CatalogField
                        kind="CLOSED_SMALL"
                        label={t("memberRole")}
                        value={memberRole}
                        onChange={(v) => setMemberRole(String(v))}
                        options={[
                          { value: "VIEWER", label: t("roleViewer") },
                          { value: "ACCOUNTANT", label: t("roleAccountant") },
                          { value: "ADMIN", label: t("roleAdmin") },
                        ]}
                      />
                    </div>
                    <button
                      type="button"
                      className={PRIMARY_BUTTON_CLASS}
                      disabled={(!memberUserId.trim() && !memberEmail.trim()) || busy}
                      onClick={() => void addMember()}
                    >
                      {t("addMember")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <ModalShell
        open={createOpen}
        onClose={() => !busy && setCreateOpen(false)}
        title={t("createTitle")}
      >
        <form id="create-holding-form" onSubmit={onCreate} className="space-y-4">
          <p className="text-sm text-[#7F8C8D]">{t("createHint")}</p>
          <label className="block">
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("name")}</span>
            <input
              className={FORM_INPUT_CLASS}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              maxLength={255}
            />
          </label>
          <label className="block">
            <span className={MODAL_FIELD_LABEL_CLASS}>{t("baseCurrency")}</span>
            <select
              className={FORM_INPUT_CLASS}
              value={createCurrency}
              onChange={(e) => setCreateCurrency(e.target.value)}
            >
              <option value="AZN">AZN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <ModalFooter
            formId="create-holding-form"
            onCancel={() => setCreateOpen(false)}
            cancelLabel={tCommon("cancel")}
            submitLabel={t("create")}
            busy={busy}
          />
        </form>
      </ModalShell>
    </>
  );
}
