"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Ban, Plus } from "lucide-react";
import {
  CatalogField,
  CARD_CONTAINER_CLASS,
  EraDataGrid,
  LIST_PAGE_SHELL_CLASS,
  ModalFooter,
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
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("devicesTitle")}
          subtitle={t("devicesHint")}
          actions={
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              onClick={() => {
                setDevName("");
                setDevPlaceId("");
                setDevHmac(false);
                setDeviceModal(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {t("addDevice")}
            </button>
          }
        />
      </div>
      <div className="shrink-0">
        <WorkforceAttendanceSubnav />
      </div>
      {error ? <p className="shrink-0 text-sm text-[var(--era-danger)]">{error}</p> : null}
      {shownToken ? (
        <div className={`${CARD_CONTAINER_CLASS} shrink-0 space-y-2`}>
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

      <div className="flex min-h-0 flex-1 flex-col">
        <EraDataGrid
          layout="fill"
          columns={[
            { key: "name", header: t("colName") },
            {
              key: "place",
              header: t("colPlace"),
              render: (row) => row.place?.name ?? "—",
            },
            { key: "status", header: t("colStatus"),
              render: (row) =>
                row.status === "ACTIVE"
                  ? t("statusActive")
                  : row.status === "REVOKED"
                    ? t("statusRevoked")
                    : row.status,
            },
            {
              key: "hmac",
              header: t("colHmac"),
              render: (row) => (row.hmacSecretHash ? t("hmacOn") : t("hmacOff")),
            },
            {
              key: "actions",
              header: "",
              className: "w-12",
              render: (row) =>
                row.status === "ACTIVE" ? (
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    disabled={busy}
                    title={t("revoke")}
                    aria-label={t("revoke")}
                    onClick={() => void revokeDevice(row.id)}
                  >
                    <Ban className="h-4 w-4 text-[#C0392B]" aria-hidden />
                  </button>
                ) : null,
            },
          ]}
          rows={devices}
          rowKey={(row) => row.id}
          emptyMessage={loading ? tCommon("loading") : t("devicesEmpty")}
          paginationLabels={{
            rowsPerPage: tCommon("paginationRowsPerPage"),
            pageOf: tCommon("paginationPageOf"),
            prev: tCommon("paginationPrev"),
            next: tCommon("paginationNext"),
          }}
        />
      </div>

      {deviceModal ? (
        <ModalShell
          open
          title={t("addDevice")}
          onClose={() => setDeviceModal(false)}
          closeLabel={tCommon("close")}
          footer={
            <ModalFooter
              onCancel={() => setDeviceModal(false)}
              onSubmit={() => void createDevice()}
              busy={busy}
              submitDisabled={!devName.trim() || !devPlaceId}
              cancelLabel={tCommon("cancel")}
              submitLabel={tCommon("save")}
            />
          }
        >
          <div className="grid gap-3">
            <CatalogField
              kind="FREE_TEXT"
              label={t("colName")}
              value={devName}
              onChange={(v) => setDevName(String(v))}
              options={[]}
            />
            <CatalogField
              kind="ENTITY_REF"
              label={t("colPlace")}
              value={devPlaceId}
              onChange={(v) => setDevPlaceId(String(v))}
              options={places.map((p) => ({
                value: p.id,
                label: `${p.code} — ${p.name}`,
              }))}
              emptyLabel={tCommon("select")}
            />
            <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
              <input
                type="checkbox"
                checked={devHmac}
                onChange={(e) => setDevHmac(e.target.checked)}
              />
              {t("requireHmac")}
            </label>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
