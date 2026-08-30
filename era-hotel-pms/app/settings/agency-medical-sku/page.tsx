"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FieldRow,
  FORM_STACK_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { EraModal, EraModalFooter } from "@/components/EraModal";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";

type RuleRow = {
  id: string;
  agencyNamePrefix: string;
  packageCode: string;
  sortOrder: number;
  active: boolean;
};

const PKG_OPTIONS = [
  { value: "PKG-STANDART", label: "PKG-STANDART" },
  { value: "PKG-PREMIUM", label: "PKG-PREMIUM" },
  { value: "PKG-DERMO", label: "PKG-DERMO" },
  { value: "PKG-DETOKS", label: "PKG-DETOKS" },
];

export default function AgencyMedicalSkuRulesPage() {
  const { can } = useAuth();
  const t = useTranslations("agencyMedicalSku");
  const tc = useTranslations("common");
  const canWrite = can(PERMISSIONS.MASTER_DATA_MANAGE);
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [prefix, setPrefix] = useState("");
  const [packageCode, setPackageCode] = useState("PKG-STANDART");
  const [sortOrder, setSortOrder] = useState("0");
  const formId = "agency-sku-rule-form";

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/agency-medical-sku-rules");
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc("loadError"));
        return;
      }
      setRows(Array.isArray(data) ? data : data.data ?? []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc("loadError") });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditId(undefined);
    setPrefix("");
    setPackageCode("PKG-STANDART");
    setSortOrder("0");
    setModalOpen(true);
  }

  function openEdit(row: RuleRow) {
    setEditId(row.id);
    setPrefix(row.agencyNamePrefix);
    setPackageCode(row.packageCode);
    setSortOrder(String(row.sortOrder));
    setModalOpen(true);
  }

  async function save() {
    if (!canWrite) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/agency-medical-sku-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editId,
          agencyNamePrefix: prefix.trim(),
          packageCode,
          sortOrder: Number(sortOrder) || 0,
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc("failed"));
        return;
      }
      showSuccess(tc("success"));
      setModalOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function retire(id: string) {
    if (!canWrite) return;
    const res = await fetch(`/api/admin/agency-medical-sku-rules?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      showApiError(data, tc("failed"));
      return;
    }
    showSuccess(tc("success"));
    await load();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              className="text-[13px] text-[#2980B9] hover:underline"
              href="/settings/package-prices"
            >
              {tc("back")}
            </Link>
            {canWrite ? (
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
                {t("add")}
              </button>
            ) : null}
          </div>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} ${DATA_TABLE_VIEWPORT_CLASS}`}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("prefix")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("packageCode")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("sortOrder")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{row.agencyNamePrefix}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.packageCode}</td>
                <td className={DATA_TABLE_TD_CLASS}>{row.sortOrder}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {canWrite ? (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => openEdit(row)}
                      >
                        {tc("edit")}
                      </button>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => void retire(row.id)}
                      >
                        {t("retire")}
                      </button>
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EraModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? tc("edit") : t("add")}
        footer={
          <EraModalFooter
            formId={formId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={tc("save")}
          />
        }
      >
        <form
          id={formId}
          className={FORM_STACK_CLASS}
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <FieldRow>
            <Field
              label={t("prefix")}
              name="agencyNamePrefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              preset="shortText"
              required
            />
            <Field
              label={t("sortOrder")}
              name="sortOrder"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              preset="code"
            />
          </FieldRow>
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("packageCode")}
            value={packageCode}
            onChange={(v) => setPackageCode(String(v))}
            options={PKG_OPTIONS}
            required
          />
        </form>
      </EraModal>
    </>
  );
}
