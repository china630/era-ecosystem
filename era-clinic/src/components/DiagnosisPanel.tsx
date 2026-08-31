"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  FieldSelect,
  FieldTextarea,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import { IcdPicker } from "@/components/IcdPicker";

type DxRow = {
  id: string;
  role?: string;
  kind?: string;
  note?: string | null;
  icdCodeId?: string;
  icdCode: {
    id?: string;
    code: string;
    titleEn: string;
    titleRu: string;
    titleAz?: string | null;
  };
};

type Props = {
  apiBase: string;
  title: string;
  showKind?: boolean;
  showRole?: boolean;
  readOnly?: boolean;
  /** When true, render title outside (parent provides header). */
  hideTitle?: boolean;
  /** When true, parent renders the add button (use ref.openCreate). */
  hideAddButton?: boolean;
};

export type DiagnosisPanelHandle = {
  openCreate: () => void;
};

function titleFor(
  row: DxRow["icdCode"],
  locale: string,
): string {
  if (locale.startsWith("ru")) return row.titleRu;
  if (locale.startsWith("az")) return row.titleAz?.trim() || row.titleRu;
  return row.titleEn;
}

export const DiagnosisPanel = forwardRef<DiagnosisPanelHandle, Props>(
  function DiagnosisPanel(
    {
      apiBase,
      title,
      showKind,
      showRole = true,
      readOnly = false,
      hideTitle = false,
      hideAddButton = false,
    },
    ref,
  ) {
    const t = useTranslations("icd");
    const tc = useTranslations("common");
    const locale = useLocale();
    const [items, setItems] = useState<DxRow[]>([]);
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [icdCodeId, setIcdCodeId] = useState("");
    const [note, setNote] = useState("");
    const [role, setRole] = useState("PRIMARY");
    const [kind, setKind] = useState("ADMISSION");
    const [chapter, setChapter] = useState("");
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
      const res = await fetch(apiBase);
      const data = await res.json();
      setItems(data.items ?? data.data?.items ?? []);
    }, [apiBase]);

    useEffect(() => {
      void load();
    }, [load]);

    function openCreate() {
      setEditingId(null);
      setIcdCodeId("");
      setNote("");
      setRole("PRIMARY");
      setKind("ADMISSION");
      setChapter("");
      setMsg("");
      setOpen(true);
    }

    useImperativeHandle(ref, () => ({ openCreate }), []);

    function openEdit(row: DxRow) {
      setEditingId(row.id);
      setIcdCodeId(row.icdCodeId ?? row.icdCode.id ?? "");
      setNote(row.note ?? "");
      setRole(row.role ?? "PRIMARY");
      setKind(row.kind ?? "ADMISSION");
      setChapter("");
      setMsg("");
      setOpen(true);
    }

    async function save() {
      if (!icdCodeId) {
        setMsg(t("codeRequired"));
        return;
      }
      setBusy(true);
      setMsg("");
      if (editingId) {
        const res = await fetch(apiBase, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingId,
            icdCodeId,
            note: note || null,
          }),
        });
        setBusy(false);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMsg(data.error ?? tc("failed"));
          return;
        }
      } else {
        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            icdCodeId,
            note: note || null,
            ...(showRole ? { role } : {}),
            ...(showKind ? { kind } : {}),
          }),
        });
        setBusy(false);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setMsg(data.error ?? tc("failed"));
          return;
        }
      }
      setOpen(false);
      setEditingId(null);
      setIcdCodeId("");
      setNote("");
      await load();
    }

    async function remove(id: string) {
      const res = await fetch(`${apiBase}?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) await load();
    }

    const showHeaderRow = !hideTitle || (!readOnly && !hideAddButton);

    return (
      <div className="space-y-2">
        {showHeaderRow ? (
          <div className="flex items-center justify-between gap-2">
            {!hideTitle ? <h3 className="font-semibold">{title}</h3> : <span />}
            {!readOnly && !hideAddButton ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
                {t("addDiagnosis")}
              </button>
            ) : null}
          </div>
        ) : null}
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.map((d) => (
            <li key={d.id} className="flex flex-wrap items-baseline gap-2">
              <span>
                {d.icdCode.code} — {titleFor(d.icdCode, locale)}
                {d.role ? ` (${d.role})` : ""}
                {d.kind ? ` · ${d.kind}` : ""}
                {d.note ? ` — ${d.note}` : ""}
              </span>
              {!readOnly ? (
                <>
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    aria-label={tc("edit")}
                    onClick={() => openEdit(d)}
                  >
                    <Pencil className="h-4 w-4 text-[#2980B9]" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    aria-label={tc("delete")}
                    onClick={() => void remove(d.id)}
                  >
                    <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                  </button>
                </>
              ) : null}
            </li>
          ))}
          {items.length === 0 ? (
            <li className={`list-none ${TEXT_MUTED_CLASS}`}>—</li>
          ) : null}
        </ul>
        {msg ? <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{msg}</p> : null}
        <ModalShell
          open={open}
          title={editingId ? tc("edit") : t("addDiagnosis")}
          onClose={() => setOpen(false)}
          footer={
            <ModalFooter
              onCancel={() => setOpen(false)}
              onSubmit={() => void save()}
              busy={busy}
              submitLabel={tc("save")}
            />
          }
        >
          <div className="space-y-3">
            <IcdPicker
              label={t("code")}
              valueId={icdCodeId}
              required
              showChapterFilter
              chapter={chapter}
              onChapterChange={setChapter}
              onChange={(id) => setIcdCodeId(id)}
            />
            {showRole && !editingId ? (
              <FieldSelect
                label={t("role")}
                preset="select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="PRIMARY">{t("rolePrimary")}</option>
                <option value="SECONDARY">{t("roleSecondary")}</option>
              </FieldSelect>
            ) : null}
            {showKind && !editingId ? (
              <FieldSelect
                label={t("admissionKind")}
                preset="select"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="ADMISSION">{t("kindAdmission")}</option>
                <option value="DISCHARGE">{t("kindDischarge")}</option>
              </FieldSelect>
            ) : null}
            <FieldTextarea
              label={t("note")}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </ModalShell>
      </div>
    );
  },
);
