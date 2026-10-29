"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  type CatalogFieldKind,
  Field,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { CARD_CLASS } from "@/lib/design-system";
import { bandsOverlap, duplicateSkuCodes } from "@/lib/buffet-forecast-bands";

const FORECAST_UNITS = ["kg", "L", "pcs", "g", "ml"] as const;
const FORECAST_BAND_CODES = ["LOW", "MID", "HIGH"] as const;

type NormRow = {
  sku: string;
  name: string;
  unit: string;
  qtyPerGuestNight: number;
  aznPerGuestNight: number;
};

type BandRow = {
  code: string;
  minGuestNights: number;
  maxGuestNights: number | null;
};

type GuestNightEntry = {
  serviceDate: string;
  guestNights: number;
  source: string;
};

type ForecastReport = {
  guestNights: number;
  guestNightsStored: number;
  bandCode: string | null;
  totalForecastAzn: number;
  daysWithGuestNightData: number;
  lines: Array<{
    sku: string;
    name: string;
    unit: string;
    qtyPerGuestNight: number;
    aznPerGuestNight: number;
    forecastQty: number;
    forecastAzn: number;
  }>;
  forecastPack: { keySkuNorms: NormRow[]; bands: BandRow[] };
  entries: GuestNightEntry[];
};

type Props = {
  outletId: string;
  fromDate: string;
  toDate: string;
  /** nights = Proqnoz calendar; norms = Normalar editor; both = legacy full panel */
  mode?: "nights" | "norms" | "both";
};

function emptyNorm(): NormRow {
  return { sku: "", name: "", unit: "kg", qtyPerGuestNight: 0, aznPerGuestNight: 0 };
}

function emptyBand(): BandRow {
  return { code: "LOW", minGuestNights: 0, maxGuestNights: null };
}

export default function BuffetForecastPanel({
  outletId,
  fromDate,
  toDate,
  mode = "both",
}: Props) {
  const showNights = mode === "nights" || mode === "both";
  const showNorms = mode === "norms" || mode === "both";
  const t = useTranslations("admin.buffet");
  const [report, setReport] = useState<ForecastReport | null>(null);
  const [norms, setNorms] = useState<NormRow[]>([]);
  const [bands, setBands] = useState<BandRow[]>([]);
  const [overrideNights, setOverrideNights] = useState("");
  const [manualDate, setManualDate] = useState(fromDate);
  const [manualNights, setManualNights] = useState("0");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editNights, setEditNights] = useState("0");
  const [skuSearchOptions, setSkuSearchOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const unitOptions = useMemo(
    () => FORECAST_UNITS.map((u) => ({ value: u, label: u })),
    [],
  );

  const bandCodeOptions = useMemo(() => {
    const codes = new Set<string>(FORECAST_BAND_CODES);
    for (const b of bands) {
      const c = b.code.trim().toUpperCase();
      if (c) codes.add(c);
    }
    return [...codes].map((c) => ({ value: c, label: c }));
  }, [bands]);

  const normSkuOptions = useMemo(() => {
    const byValue = new Map<string, { value: string; label: string }>();
    for (const n of norms) {
      const sku = n.sku.trim().toUpperCase();
      if (!sku) continue;
      byValue.set(sku, {
        value: sku,
        label: n.name.trim() ? `${sku} — ${n.name.trim()}` : sku,
      });
    }
    for (const o of skuSearchOptions) {
      const sku = o.value.trim().toUpperCase();
      if (!sku || byValue.has(sku)) continue;
      byValue.set(sku, { value: sku, label: o.label || sku });
    }
    return [...byValue.values()];
  }, [norms, skuSearchOptions]);

  const load = useCallback(
    (opts?: { overrideNights: string }) => {
      if (!fromDate || !toDate) {
        setReport(null);
        setDateError(false);
        return;
      }
      if (fromDate > toDate) {
        setDateError(true);
        setReport(null);
        return;
      }
      setDateError(false);
      setLoading(true);
      const q = new URLSearchParams({ from: fromDate, to: toDate });
      const override = (opts?.overrideNights ?? overrideNights).trim();
      if (override !== "") q.set("guestNights", override);
      return fetch(`/api/admin/buffet/forecast-pack?${q}`)
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            showApiError(data, t("forecastLoadFailed"));
            setReport(null);
            return;
          }
          const pack = data as ForecastReport;
          setReport(pack);
          setNorms(pack.forecastPack?.keySkuNorms ?? []);
          setBands(pack.forecastPack?.bands ?? []);
        })
        .catch(() => setReport(null))
        .finally(() => setLoading(false));
    },
    [fromDate, toDate, overrideNights, t],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- override applies via Refresh
  }, [fromDate, toDate]);

  useEffect(() => {
    setManualDate(fromDate);
  }, [fromDate]);

  async function savePack(nextNorms: NormRow[], nextBands: BandRow[]) {
    const skus = nextNorms.map((n) => n.sku);
    if (skus.some((s) => !s.trim()) || duplicateSkuCodes(skus)) {
      showApiError(null, t("forecastSkuInvalid"));
      return false;
    }
    if (bandsOverlap(nextBands)) {
      showApiError(null, t("forecastBandsOverlap"));
      return false;
    }
    if (nextBands.some((b) => !b.code.trim())) {
      showApiError(null, t("forecastBandCodeRequired"));
      return false;
    }
    setSaving(true);
    const res = await fetch("/api/admin/buffet/forecast-pack", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        forecastPack: {
          keySkuNorms: nextNorms.map((n) => ({
            ...n,
            sku: n.sku.trim().toUpperCase(),
            qtyPerGuestNight: Math.max(0, Number(n.qtyPerGuestNight) || 0),
            aznPerGuestNight: Math.max(0, Number(n.aznPerGuestNight) || 0),
          })),
          bands: nextBands.map((b) => ({
            code: b.code.trim().toUpperCase(),
            minGuestNights: Math.max(0, Math.floor(Number(b.minGuestNights) || 0)),
            maxGuestNights:
              b.maxGuestNights == null || Number.isNaN(Number(b.maxGuestNights))
                ? null
                : Math.max(0, Math.floor(Number(b.maxGuestNights))),
          })),
        },
      }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      showApiError(data, t("forecastSaveFailed"));
      return false;
    }
    showSuccess(t("forecastSaved"));
    await load();
    return true;
  }

  async function saveGuestNight(serviceDate: string, guestNights: number): Promise<boolean> {
    if (!serviceDate) return false;
    const res = await fetch("/api/admin/buffet/guest-nights", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceDate,
        guestNights: Math.max(0, Math.floor(guestNights)),
        source: "MANUAL",
        outletId: outletId || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("forecastGuestNightSaveFailed"));
      return false;
    }
    showSuccess(t("forecastGuestNightSaved"));
    await load();
    return true;
  }

  async function deleteGuestNight(serviceDate: string) {
    const q = new URLSearchParams({ serviceDate });
    const res = await fetch(`/api/admin/buffet/guest-nights?${q}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("forecastGuestNightDeleteFailed"));
      return;
    }
    showSuccess(t("forecastGuestNightDeleted"));
    await load();
  }

  const entries = report?.entries ?? [];
  const normsAllZero =
    norms.length === 0 || norms.every((n) => (Number(n.aznPerGuestNight) || 0) <= 0);

  async function syncFromHotel() {
    if (!fromDate || !toDate || fromDate > toDate) return;
    const res = await fetch("/api/admin/buffet/guest-nights/sync-hotel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromDate,
        to: toDate,
        outletId: outletId || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("forecastHotelSyncFailed"));
      return;
    }
    showSuccess(t("forecastHotelSynced", { count: data?.count ?? 0 }));
    await load();
  }

  return (
    <div className="space-y-4">
      {showNights ? (
        <>
          <p className="m-0 text-sm text-[#6B7280]">{t("forecastHint")}</p>
          <p className="m-0 text-xs text-[#95A5A6]">{t("forecastManualHonesty")}</p>
        </>
      ) : (
        <p className="m-0 text-sm text-[#6B7280]">{t("normsHint")}</p>
      )}
      {dateError ? (
        <p className="m-0 text-sm text-red-600">{t("costRunDateOrder")}</p>
      ) : null}

      {showNights ? (
      <div className={`${CARD_CLASS} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-semibold text-[#2C3E50]">{t("forecastGuestNights")}</h3>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={loading || !fromDate || !toDate}
            onClick={() => void syncFromHotel()}
          >
            {t("forecastSyncHotel")}
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="m-0 text-sm text-[#E67E22]">{t("forecastNoGuestNights")}</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left text-[#6B7280]">
                <th className="py-2 pr-2">{t("forecastManualDate")}</th>
                <th className="py-2 pr-2">{t("forecastManualNights")}</th>
                <th className="py-2 pr-2">{t("forecastNightSource")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.serviceDate} className="border-b border-[#F3F4F6]">
                  <td className="py-2 pr-2 tabular-nums">{row.serviceDate.slice(0, 10)}</td>
                  <td className="py-2 pr-2 tabular-nums">{row.guestNights}</td>
                  <td className="py-2 pr-2">{row.source}</td>
                  <td className="py-2 text-right space-x-2">
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() => {
                        setEditDate(row.serviceDate.slice(0, 10));
                        setEditNights(String(row.guestNights));
                        setEditOpen(true);
                      }}
                    >
                      {t("forecastEditNight")}
                    </button>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() => void deleteGuestNight(row.serviceDate.slice(0, 10))}
                    >
                      {t("forecastDeleteNight")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field
            label={t("forecastManualDate")}
            preset="shortText"
            type="date"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
          />
          <Field
            label={t("forecastManualNights")}
            preset="shortText"
            type="number"
            min={0}
            value={manualNights}
            onChange={(e) => setManualNights(e.target.value)}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => void saveGuestNight(manualDate, Number(manualNights) || 0)}
          >
            {t("forecastSaveNight")}
          </button>
          <Field
            label={t("forecastOverrideTotal")}
            preset="shortText"
            type="number"
            min={0}
            value={overrideNights}
            onChange={(e) => setOverrideNights(e.target.value)}
            placeholder={t("forecastOverridePh")}
          />
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "…" : t("forecastRefresh")}
          </button>
        </div>
        {report ? (
          <p className="m-0 text-sm text-[#34495E]">
            {t("forecastSummary", {
              nights: report.guestNights,
              band: report.bandCode ?? "—",
              days: report.daysWithGuestNightData,
              azn: report.totalForecastAzn.toFixed(2),
            })}
          </p>
        ) : null}
        {normsAllZero ? (
          <p className="m-0 text-sm text-[#E67E22]">{t("forecastNormsAllZero")}</p>
        ) : null}
      </div>
      ) : null}

      {showNorms ? (
      <>
      <div className={`${CARD_CLASS} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-semibold text-[#2C3E50]">{t("forecastKeySku")}</h3>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setNorms((rows) => [...rows, emptyNorm()])}
          >
            {t("forecastAddSku")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left text-[#6B7280]">
                <th className="py-2 pr-2">{t("forecastSku")}</th>
                <th className="py-2 pr-2">{t("forecastName")}</th>
                <th className="py-2 pr-2">{t("forecastUnit")}</th>
                <th className="py-2 pr-2">{t("forecastQtyPerNight")}</th>
                <th className="py-2 pr-2">{t("forecastAznPerNight")}</th>
                <th className="py-2 pr-2 text-right">{t("forecastQty")}</th>
                <th className="py-2 text-right">{t("forecastAzn")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {norms.map((row, idx) => {
                const line = report?.lines.find(
                  (l) => l.sku === row.sku.trim().toUpperCase(),
                );
                return (
                  <tr key={`norm-${idx}`} className="border-b border-[#F3F4F6]">
                    <td className="py-2 pr-2 min-w-[10rem]">
                      <CatalogField
                        kind={"SEARCHABLE" as CatalogFieldKind}
                        label={t("forecastSku")}
                        value={row.sku}
                        options={
                          row.sku &&
                          !normSkuOptions.some(
                            (o) => o.value === row.sku.trim().toUpperCase(),
                          )
                            ? [
                                {
                                  value: row.sku.trim().toUpperCase(),
                                  label: row.sku,
                                },
                                ...normSkuOptions,
                              ]
                            : normSkuOptions
                        }
                        serverSearch
                        onQueryChange={(q) => {
                          void fetch(
                            `/api/admin/finance-products?limit=50&q=${encodeURIComponent(q)}`,
                          )
                            .then((r) => (r.ok ? r.json() : null))
                            .then((parsed) => {
                              const payload = (parsed?.data ?? parsed) as {
                                items?: Array<{ value: string; label: string }>;
                              } | null;
                              setSkuSearchOptions(payload?.items ?? []);
                            })
                            .catch(() => setSkuSearchOptions([]));
                        }}
                        onChange={(next) => {
                          const sku = Array.isArray(next)
                            ? next[0] ?? ""
                            : String(next ?? "");
                          const upper = sku.trim().toUpperCase();
                          const hit = normSkuOptions.find((o) => o.value === upper);
                          const nameFromLabel =
                            hit?.label.includes("—")
                              ? hit.label.split("—").slice(1).join("—").trim()
                              : "";
                          const nextRows = [...norms];
                          nextRows[idx] = {
                            ...row,
                            sku: upper,
                            name: row.name.trim() || nameFromLabel || row.name,
                          };
                          setNorms(nextRows);
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Field
                        label={t("forecastName")}
                        preset="shortText"
                        value={row.name}
                        onChange={(e) => {
                          const next = [...norms];
                          next[idx] = { ...row, name: e.target.value };
                          setNorms(next);
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2 min-w-[6rem]">
                      <CatalogField
                        kind={"CLOSED_SMALL" as CatalogFieldKind}
                        label={t("forecastUnit")}
                        value={row.unit}
                        options={
                          row.unit &&
                          !unitOptions.some((o) => o.value === row.unit)
                            ? [{ value: row.unit, label: row.unit }, ...unitOptions]
                            : unitOptions
                        }
                        onChange={(next) => {
                          const nextRows = [...norms];
                          nextRows[idx] = {
                            ...row,
                            unit: Array.isArray(next)
                              ? next[0] ?? "kg"
                              : String(next ?? "kg"),
                          };
                          setNorms(nextRows);
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Field
                        label={t("forecastQtyPerNight")}
                        preset="shortText"
                        type="number"
                        min={0}
                        step="0.001"
                        value={String(row.qtyPerGuestNight)}
                        onChange={(e) => {
                          const next = [...norms];
                          next[idx] = {
                            ...row,
                            qtyPerGuestNight: Number(e.target.value) || 0,
                          };
                          setNorms(next);
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Field
                        label={t("forecastAznPerNight")}
                        preset="shortText"
                        type="number"
                        min={0}
                        step="0.01"
                        value={String(row.aznPerGuestNight)}
                        onChange={(e) => {
                          const next = [...norms];
                          next[idx] = {
                            ...row,
                            aznPerGuestNight: Number(e.target.value) || 0,
                          };
                          setNorms(next);
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {line ? line.forecastQty.toFixed(3) : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {line ? line.forecastAzn.toFixed(2) : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() =>
                          setNorms((rows) => rows.filter((_, i) => i !== idx))
                        }
                      >
                        {t("forecastRemoveSku")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`${CARD_CLASS} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-semibold text-[#2C3E50]">{t("forecastBands")}</h3>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setBands((rows) => [...rows, emptyBand()])}
          >
            {t("forecastAddBand")}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-left text-[#6B7280]">
                <th className="py-2 pr-2">{t("forecastBandCode")}</th>
                <th className="py-2 pr-2">{t("forecastBandMin")}</th>
                <th className="py-2 pr-2">{t("forecastBandMax")}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {bands.map((row, idx) => (
                <tr
                  key={`band-${idx}`}
                  className={`border-b border-[#F3F4F6] ${
                    report?.bandCode === row.code.trim().toUpperCase()
                      ? "bg-[#ECF9F1]"
                      : ""
                  }`}
                >
                  <td className="py-2 pr-2 min-w-[7rem]">
                    <CatalogField
                      kind={"CLOSED_SMALL" as CatalogFieldKind}
                      label={t("forecastBandCode")}
                      value={row.code.trim().toUpperCase()}
                      options={bandCodeOptions}
                      onChange={(next) => {
                        const nextRows = [...bands];
                        nextRows[idx] = {
                          ...row,
                          code: Array.isArray(next)
                            ? next[0] ?? ""
                            : String(next ?? ""),
                        };
                        setBands(nextRows);
                      }}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Field
                      label={t("forecastBandMin")}
                      preset="shortText"
                      type="number"
                      min={0}
                      value={String(row.minGuestNights)}
                      onChange={(e) => {
                        const next = [...bands];
                        next[idx] = {
                          ...row,
                          minGuestNights: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        };
                        setBands(next);
                      }}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Field
                      label={t("forecastBandMax")}
                      preset="shortText"
                      type="number"
                      min={0}
                      value={row.maxGuestNights == null ? "" : String(row.maxGuestNights)}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const next = [...bands];
                        next[idx] = {
                          ...row,
                          maxGuestNights:
                            raw === "" ? null : Math.max(0, Math.floor(Number(raw) || 0)),
                        };
                        setBands(next);
                      }}
                      placeholder={t("forecastBandMaxOpen")}
                    />
                  </td>
                  <td className="py-2 text-right">
                    {report?.bandCode === row.code.trim().toUpperCase() ? (
                      <span className="mr-2 text-xs text-[#27AE60]">
                        {t("forecastActiveBand")}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      onClick={() =>
                        setBands((rows) => rows.filter((_, i) => i !== idx))
                      }
                    >
                      {t("forecastRemoveBand")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={saving}
          onClick={() => void savePack(norms, bands)}
        >
          {saving ? "…" : t("forecastSaveNorms")}
        </button>
      </div>
      </>
      ) : null}

      <ModalShell
        open={editOpen}
        title={t("forecastEditNight")}
        onClose={() => setEditOpen(false)}
      >
        <Field
          label={t("forecastManualDate")}
          preset="shortText"
          type="date"
          value={editDate}
          disabled
          onChange={() => undefined}
        />
        <Field
          label={t("forecastManualNights")}
          preset="shortText"
          type="number"
          min={0}
          value={editNights}
          onChange={(e) => setEditNights(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setEditOpen(false)}
          onSubmit={() => {
            void saveGuestNight(editDate, Number(editNights) || 0).then((ok) => {
              if (ok) setEditOpen(false);
            });
          }}
          submitLabel={t("forecastSaveNight")}
        />
      </ModalShell>
    </div>
  );
}
