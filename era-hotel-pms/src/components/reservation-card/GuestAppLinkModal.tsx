"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { EraModal } from "@/components/EraModal";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, showApiError } from "@era/satellite-kit/ui";

type LinkPayload = {
  code: string;
  qrPayload: string;
  expiresAt: string;
  deviceLinked: boolean;
};

export function GuestAppLinkModal({
  open,
  reservationId,
  paxId,
  onClose,
}: {
  open: boolean;
  reservationId: string;
  paxId: string;
  onClose: () => void;
}) {
  const t = useTranslations("reservationCard");
  const [payload, setPayload] = useState<LinkPayload | null>(null);
  const [busy, setBusy] = useState(false);

  async function mint() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/guest-app/reservations/${reservationId}/pax/${paxId}/link`,
        { method: "POST" },
      );
      if (!res.ok) {
        showApiError(await res.text());
        return;
      }
      setPayload((await res.json()) as LinkPayload);
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/guest-app/reservations/${reservationId}/pax/${paxId}/unlink`,
        { method: "POST" },
      );
      if (!res.ok) {
        showApiError(await res.text());
        return;
      }
      await mint();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (open) void mint();
    else setPayload(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reservationId, paxId]);

  return (
    <EraModal
      open={open}
      onClose={onClose}
      title={t("guestAppLinkTitle")}
      footer={
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
            {t("guestAppLinkClose")}
          </button>
          <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void unlink()}>
            {t("guestAppUnlink")}
          </button>
          <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void mint()}>
            {t("guestAppLinkRefresh")}
          </button>
        </div>
      }
    >
      {payload ? (
        <div className="space-y-3 text-sm">
          <p>{t("guestAppLinkHint")}</p>
          <div className="rounded border bg-white p-4 text-center font-mono text-3xl tracking-[0.3em]">
            {payload.code}
          </div>
          <p className="break-all font-mono text-xs text-[#7F8C8D]">{payload.qrPayload}</p>
          <p className="text-xs text-[#7F8C8D]">
            {t("guestAppLinkExpires")}: {payload.expiresAt}
          </p>
          {payload.deviceLinked ? <p>{t("guestAppDeviceLinked")}</p> : null}
        </div>
      ) : (
        <p className="text-sm">{busy ? t("guestAppLinkMinting") : "…"}</p>
      )}
    </EraModal>
  );
}
