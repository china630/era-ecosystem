"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  EraDataGrid,
  FieldSelect,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  type EraDataGridColumn,
} from "@era/satellite-kit/ui";

type CensusRow = {
  admissionId: string;
  patientRefId: string;
  patientName: string;
  patientRefCode: string;
  wardCode: string;
  wardName: string;
  bedCode: string;
  admittedAt: string;
};

export default function InpatientCensusPage() {
  const t = useTranslations("inpatient");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<CensusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
    admissionId: "",
    newBedId: "",
    patientName: "",
  });
  const [availableBeds, setAvailableBeds] = useState<Array<{ id: string; label: string }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inpatient?view=census");
      const json = await res.json();
      const payload = json.data ?? json;
      setRows(payload.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<EraDataGridColumn<CensusRow>[]>(
    () => [
      {
        key: "patientName",
        header: t("colPatient"),
        render: (r) => (
          <div>
            <div className="font-medium">{r.patientName}</div>
            <div className="text-xs text-[#7F8C8D]">{r.patientRefCode}</div>
          </div>
        ),
      },
      { key: "wardCode", header: t("colWard"), render: (r) => `${r.wardCode} · ${r.wardName}` },
      { key: "bedCode", header: t("colBed") },
      {
        key: "admittedAt",
        header: t("colAdmittedAt"),
        render: (r) => new Date(r.admittedAt).toLocaleString(),
      },
      {
        key: "actions",
        header: tc("actions"),
        render: (r) => (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              className={TABLE_ROW_ICON_BTN_CLASS}
              aria-label={t("transfer")}
              onClick={() => void openTransfer(r)}
            >
              <ArrowRightLeft className="h-4 w-4 text-[#2980B9]" aria-hidden />
            </button>
            <button
              type="button"
              className={TABLE_ROW_ICON_BTN_CLASS}
              aria-label={t("discharge")}
              onClick={() => void discharge(r.admissionId)}
            >
              <LogOut className="h-4 w-4 text-[#E74C3C]" aria-hidden />
            </button>
          </div>
        ),
      },
    ],
    [t, tc],
  );

  async function openTransfer(row: CensusRow) {
    const wardRes = await fetch("/api/inpatient");
    const wardJson = await wardRes.json();
    const wards = (wardJson.data?.wards ?? wardJson.wards ?? []) as Array<{
      code: string;
      beds: Array<{ id: string; code: string; status: string; assignments: unknown[] }>;
    }>;
    const beds: Array<{ id: string; label: string }> = [];
    for (const ward of wards) {
      for (const bed of ward.beds) {
        if (bed.status === "AVAILABLE" && bed.assignments.length === 0) {
          beds.push({ id: bed.id, label: `${ward.code} / ${bed.code}` });
        }
      }
    }
    setAvailableBeds(beds);
    setTransferForm({
      admissionId: row.admissionId,
      newBedId: "",
      patientName: row.patientName,
    });
    setTransferOpen(true);
  }

  async function submitTransfer() {
    setMsg(null);
    const res = await fetch("/api/inpatient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "transfer",
        admissionId: transferForm.admissionId,
        newBedId: transferForm.newBedId,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? tc("failed"));
      return;
    }
    setTransferOpen(false);
    setMsg(t("transferred"));
    await load();
  }

  async function discharge(admissionId: string) {
    setMsg(null);
    const res = await fetch("/api/inpatient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "discharge", admissionId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setMsg(json.error ?? tc("failed"));
      return;
    }
    setMsg(t("discharged"));
    await load();
  }

  return (
    <>
      <PageHeader
        title={t("censusTitle")}
        subtitle={t("censusSubtitle")}
        actions={
          <Link href="/inpatient" className={PRIMARY_BUTTON_CLASS}>
            {t("censusBack")}
          </Link>
        }
      />
      {msg ? <p className="mb-3 text-[13px]">{msg}</p> : null}
      <div className={`${CARD_CONTAINER_CLASS} overflow-hidden`}>
        <EraDataGrid
          columns={columns}
          rows={rows}
          rowKey={(r) => r.admissionId}
          emptyMessage={loading ? tc("loading") : t("censusEmpty")}
        />
      </div>

      <ModalShell open={transferOpen} title={t("transfer")} onClose={() => setTransferOpen(false)}>
        <p className="mb-2 text-[13px]">{transferForm.patientName}</p>
        <FieldSelect
          label={t("selectBed")}
          preset="selectWide"
          value={transferForm.newBedId}
          onChange={(e) => setTransferForm({ ...transferForm, newBedId: e.target.value })}
        >
          <option value="">{t("selectBed")}</option>
          {availableBeds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </FieldSelect>
        <ModalFooter
          onCancel={() => setTransferOpen(false)}
          onSubmit={() => void submitTransfer()}
          submitLabel={t("transfer")}
        />
      </ModalShell>
    </>
  );
}
