"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldSelect } from "@era/satellite-kit/ui";
import { PageHeader } from "../../../components/layout/page-header";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useLedger } from "../../../lib/ledger-context";

type Book = {
  id: string;
  code: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  gaapKind: string;
  status: string;
  isSystem: boolean;
  billingSlotKind: string;
};

type Slots = {
  included: number;
  extra: number;
  ifrsBundleSlot: number;
  maxActive: number;
  usedActive: number;
};

const INITIAL_FORM = {
  code: "",
  nameAz: "",
  nameRu: "",
  nameEn: "",
  gaapKind: "MANAGEMENT",
  coaStrategy: "TEMPLATE",
  translateFromStatutory: false,
};

export default function AccountingBooksPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { user } = useAuth();
  const { refreshBooks } = useLedger();
  const [books, setBooks] = useState<Book[]>([]);
  const [slots, setSlots] = useState<Slots | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const canCreate =
    user?.role === "OWNER" ||
    user?.role === "ADMIN" ||
    user?.role === "ACCOUNTANT";

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const [booksResponse, slotsResponse] = await Promise.all([
      apiFetch("/api/accounting/books"),
      apiFetch("/api/accounting/books/slots"),
    ]);
    if (!booksResponse.ok || !slotsResponse.ok) {
      setError(t("accountingBooks.loadError"));
      setLoading(false);
      return;
    }
    setBooks((await booksResponse.json()) as Book[]);
    setSlots((await slotsResponse.json()) as Slots);
    setLoading(false);
  }, [t, token]);

  useEffect(() => {
    if (ready && token) void load();
  }, [ready, token, load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await apiFetch("/api/accounting/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        code?: string;
        message?: string;
      } | null;
      setError(
        response.status === 402 ||
          payload?.code === "ACCOUNTING_BOOK_SLOT_REQUIRED"
          ? t("accountingBooks.slotRequired")
          : payload?.message ?? t("accountingBooks.createError"),
      );
      return;
    }
    setForm(INITIAL_FORM);
    setOpen(false);
    await load();
    await refreshBooks();
  }

  async function retire(book: Book) {
    if (!window.confirm(t("accountingBooks.retireConfirm", { code: book.code }))) {
      return;
    }
    setBusy(true);
    setError(null);
    const response = await apiFetch(`/api/accounting/books/${book.id}/retire`, {
      method: "PATCH",
    });
    setBusy(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(payload?.message ?? t("accountingBooks.retireError"));
      return;
    }
    await load();
    await refreshBooks();
  }

  if (!ready) return <p>{t("common.loading")}</p>;
  if (!token) return null;

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title={t("accountingBooks.title")}
        subtitle={
          slots
            ? t("accountingBooks.slots", {
                used: slots.usedActive,
                max: slots.maxActive,
              })
            : t("accountingBooks.subtitle")
        }
        actions={
          <div className="flex gap-2">
            <Link href="/accounting/chart" className={SECONDARY_BUTTON_CLASS}>
              {t("accountingBooks.openChart")}
            </Link>
            {canCreate ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => setOpen(true)}
              >
                {t("accountingBooks.add")}
              </button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}
      {slots && slots.usedActive > 5 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {t("accountingBooks.manyBooksWarning")}
        </p>
      ) : null}
      {loading ? (
        <p>{t("common.loading")}</p>
      ) : (
        <div className={CARD_CONTAINER_CLASS}>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="p-3 text-left">{t("accountingBooks.code")}</th>
                <th className="p-3 text-left">{t("accountingBooks.name")}</th>
                <th className="p-3 text-left">{t("accountingBooks.gaapKind")}</th>
                <th className="p-3 text-left">{t("accountingBooks.status")}</th>
                <th className="p-3 text-right">{t("accountingBooks.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.id} className="border-t border-slate-100">
                  <td className="p-3 font-mono">{book.code}</td>
                  <td className="p-3">{book.nameEn}</td>
                  <td className="p-3">{book.gaapKind}</td>
                  <td className="p-3">{book.status}</td>
                  <td className="p-3 text-right">
                    {canCreate &&
                    book.status === "ACTIVE" &&
                    !book.isSystem &&
                    book.billingSlotKind === "EXTRA" ? (
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        disabled={busy}
                        onClick={() => void retire(book)}
                      >
                        {t("accountingBooks.retire")}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${CARD_CONTAINER_CLASS} w-full max-w-xl bg-white p-5`}>
            <h2 className="mb-4 text-lg font-semibold">
              {t("accountingBooks.add")}
            </h2>
            <form onSubmit={(event) => void submit(event)} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t("accountingBooks.code")}
                  preset="code"
                  required
                  value={form.code}
                  onChange={(event) =>
                    setForm({ ...form, code: event.target.value.toUpperCase() })
                  }
                />
                <FieldSelect
                  label={t("accountingBooks.gaapKind")}
                  preset="selectWide"
                  value={form.gaapKind}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      gaapKind: event.target.value,
                      coaStrategy:
                        event.target.value === "MANAGEMENT"
                          ? "TEMPLATE"
                          : "EMPTY",
                    })
                  }
                >
                  {["MANAGEMENT", "TAX", "CUSTOM", "IFRS"].map((kind) => (
                    <option key={kind} value={kind}>
                      {t(`accountingBooks.kind.${kind}`)}
                    </option>
                  ))}
                </FieldSelect>
                {(["nameAz", "nameRu", "nameEn"] as const).map((key) => (
                  <Field
                    key={key}
                    label={t(`accountingBooks.${key}`)}
                    preset="shortText"
                    required
                    value={form[key]}
                    onChange={(event) =>
                      setForm({ ...form, [key]: event.target.value })
                    }
                  />
                ))}
              </div>
              <FieldSelect
                label={t("accountingBooks.coaStrategy")}
                preset="selectWide"
                value={form.coaStrategy}
                onChange={(event) =>
                  setForm({ ...form, coaStrategy: event.target.value })
                }
              >
                {form.gaapKind === "MANAGEMENT" ? (
                  <option value="TEMPLATE">
                    {t("accountingBooks.strategy.TEMPLATE")}
                  </option>
                ) : null}
                <option value="EMPTY">
                  {t("accountingBooks.strategy.EMPTY")}
                </option>
                <option value="NAS_CLONE">
                  {t("accountingBooks.strategy.NAS_CLONE")}
                </option>
              </FieldSelect>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.translateFromStatutory}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      translateFromStatutory: event.target.checked,
                    })
                  }
                />
                {t("accountingBooks.translateFromStatutory")}
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => setOpen(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={busy}
                >
                  {busy ? "…" : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
