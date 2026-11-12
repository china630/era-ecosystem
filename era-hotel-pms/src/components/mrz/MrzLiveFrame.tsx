"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { parseMrz, type MrzDocument } from "@/lib/mrz/parse";

/**
 * Live MRZ frame: red until check digits match, then one green capture.
 * No shutter button. Candidate text can come from OCR or a scanner stream.
 */
export function MrzLiveFrame({
  onCaptured,
  captureKey = "default",
}: {
  onCaptured: (doc: MrzDocument) => void;
  captureKey?: string;
}) {
  const t = useTranslations("mrzLive");
  const [candidate, setCandidate] = useState("");
  const [reason, setReason] = useState<string>("empty");
  const [green, setGreen] = useState(false);
  const capturedRef = useRef(false);

  useEffect(() => {
    capturedRef.current = false;
    setGreen(false);
    setCandidate("");
    setReason("empty");
  }, [captureKey]);

  useEffect(() => {
    if (capturedRef.current) return;
    const text = candidate.trim();
    if (!text) {
      setReason("empty");
      setGreen(false);
      return;
    }
    const doc = parseMrz(text);
    if (!doc) {
      setReason("cannot_read");
      setGreen(false);
      return;
    }
    if (!doc.checksOk) {
      setReason("check_digits");
      setGreen(false);
      return;
    }
    setReason("");
    setGreen(true);
    capturedRef.current = true;
    onCaptured(doc);
  }, [candidate, onCaptured]);

  return (
    <div className="space-y-2">
      <div
        className={`rounded border-4 p-3 ${green ? "border-green-600 bg-green-50" : "border-red-600 bg-red-50"}`}
      >
        <p className="text-sm font-medium">{green ? t("green") : t("red")}</p>
        {!green && reason ? <p className="text-xs">{t(`reason_${reason}` as "reason_empty")}</p> : null}
        <textarea
          className="mt-2 w-full rounded border bg-white p-2 font-mono text-xs"
          rows={3}
          value={candidate}
          onChange={(e) => {
            if (capturedRef.current) return;
            setCandidate(e.target.value);
          }}
          placeholder={t("placeholder")}
          readOnly={green}
        />
      </div>
    </div>
  );
}
