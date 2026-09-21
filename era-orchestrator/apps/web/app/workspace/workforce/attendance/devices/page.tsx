"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Ban, Plus } from "lucide-react";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";
import { WorkforceAttendanceSubnav } from "../../../../../components/workspace/workforce-attendance-subnav";
import type { DeviceRow, PlaceRow } from "../_lib/types";

export default function WorkforceAttendanceDevicesPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceAttendance");
  const tCommon = useTranslations("common");

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [deviceModal, setDeviceModal] = useState(false);
  const [devName, setDevName] = useState("");
  const [devPlaceId, setDevPlaceId] = useState("");
  const [devHmac, setDevHmac] = useState(false);
  const [shownToken, setShownToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [devRes, placeRes] = await Promise.all([
      wfFetch("attendance/devices"),
      wfFetch("places?status=ACTIVE"),
    ]);
    if (await isWorkforceGate403(devRes)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (!devRes.ok) {
      setError(t("loadError"));
      setLoading(false);
      return;
    }
    setDevices(await devRes.json());
    if (placeRes.ok) {
      const p = await placeRes.json();
      setPlaces(Array.isArray(p) ? p : p.items ?? []);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  async function createDevice() {
    if (!devName.trim() || !devPlaceId) return;
    setBusy(true);
    const res = await wfFetch("attendance/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: devName.trim(),
        placeId: devPlaceId,
        requireHmac: devHmac,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t("saveError"));
      return;
    }
    const created = await res.json();
    setShownToken(created.token ?? null);
    setDeviceModal(false);
    setDevName("");
    setDevPlaceId("");
    setDevHmac(false);
    await load();
  }

  async function revokeDevice(id: string) {
    setBusy(true);
    await wfFetch(`attendance/devices/${id}/revoke`, { method: "POST" });
    setBusy(false);
    await load();
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("devicesTitle")} subtitle={t("subtitle")} />
      <WorkforceAttendanceSubnav />
      {error ? <p className="text-sm text-[var(--era-danger)]">{error}</p> : null}
      {shownToken ? (
        <div className={`${CARD_CONTAINER_CLASS} space-y-2`}>
          <p className="text-sm font-medium">{t("tokenOnce")}</p>
          <code className="block break-all text-xs">{shownToken}</code>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={() => setShownToken(null)}
          >
            {tCommon("close")}
          </button>
        </div>
      ) : null}

      <section className={CARD_CONTAINER_CLASS}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t("devicesTitle")}</h2>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => setDeviceModal(true)}
          >
            {t("addDevice")}
          </button>
        </div>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPlace")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colHmac")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{d.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {d.place?.name ?? d.placeId}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{d.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {d.hmacSecretHash ? t("hmacOn") : t("hmacOff")}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {d.status === "ACTIVE" ? (
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        disabled={busy}
                        title={t("revoke")}
                        aria-label={t("revoke")}
                        onClick={() => void revokeDevice(d.id)}
                      >
                        <Ban className="h-4 w-4 text-[#C0392B]" aria-hidden />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!loading && devices.length === 0 ? (
                <tr>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={5}>
                    {t("emptyDevices")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {deviceModal ? (
        <ModalShell
          title={t("addDevice")}
          onClose={() => setDeviceModal(false)}
        >
          <div className="space-y-3">
            <label className="block text-sm">
              {t("colName")}
              <input
                className="mt-1 w-full rounded border px-2 py-1"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
              />
            </label>
            <CatalogField
              kind="ENTITY_REF"
              label={t("colPlace")}
              value={devPlaceId}
              onChange={(v) => setDevPlaceId(String(v))}
              options={places.map((p) => ({
                value: p.id,
                label: `${p.code} — ${p.name}`,
              }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={devHmac}
                onChange={(e) => setDevHmac(e.target.checked)}
              />
              {t("requireHmac")}
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => setDeviceModal(false)}
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy}
                onClick={() => void createDevice()}
              >
                {tCommon("save")}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
