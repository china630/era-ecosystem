"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { orchFetch } from "../../lib/orch-api";
import { EARLY_ACCESS_MODULES, type EarlyAccessModuleKey } from "./modules.config";

type Step = "landing" | "survey" | "thanks";

export function EarlyAccessLandingModal({
  moduleKey,
  onClose,
}: {
  moduleKey: EarlyAccessModuleKey;
  onClose: () => void;
}) {
  const cfg = EARLY_ACCESS_MODULES[moduleKey];
  const { token } = useAuth();
  const [step, setStep] = useState<Step>("landing");
  const [busy, setBusy] = useState(false);
  const [industry, setIndustry] = useState("");
  const [surveyAnswer, setSurveyAnswer] = useState("");
  const [onWaitlist, setOnWaitlist] = useState(false);
  const sessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now());

  const postEvent = useCallback(
    async (eventType: string) => {
      try {
        await orchFetch("/v1/early-access/events", {
          method: "POST",
          token,
          body: JSON.stringify({ moduleKey, eventType, sessionId }),
        });
      } catch {
        /* non-blocking */
      }
    },
    [moduleKey, sessionId, token],
  );

  useEffect(() => {
    void postEvent("MODAL_OPEN");
    void (async () => {
      const res = await orchFetch("/v1/early-access/me", { token });
      if (res.ok) {
        const rows = (await res.json()) as Array<{ moduleKey: string }>;
        setOnWaitlist(rows.some((r) => r.moduleKey === moduleKey));
      }
    })();
  }, [moduleKey, postEvent, token]);

  async function signup() {
    setBusy(true);
    try {
      const res = await orchFetch("/v1/early-access/signup", {
        method: "POST",
        token,
        body: JSON.stringify({
          moduleKey,
          industry: industry || "other",
          surveyAnswer: surveyAnswer.trim() || undefined,
        }),
      });
      if (!res.ok) return;
      setStep("thanks");
      setOnWaitlist(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      open
      title={cfg.title}
      subtitle="Early access — join the waitlist"
      onClose={onClose}
      footer={
        step === "landing" ? (
          <ModalFooter
            cancelLabel="Close"
            submitLabel={onWaitlist ? "On waitlist" : `Preorder from ${cfg.priceAzn} AZN/mo`}
            submitDisabled={onWaitlist}
            onCancel={onClose}
            onSubmit={() => {
              void postEvent("CTA_CLICK");
              setStep("survey");
            }}
          />
        ) : step === "survey" ? (
          <ModalFooter
            cancelLabel="Back"
            submitLabel="Join waitlist"
            busy={busy}
            onCancel={() => setStep("landing")}
            onSubmit={() => void signup()}
          />
        ) : (
          <ModalFooter cancelLabel="Close" onCancel={onClose} />
        )
      }
    >
      {step === "landing" ? (
        <p className="text-sm text-[#7F8C8D]">
          This module is not on your plan yet. Join the waitlist for early access and
          pricing updates.
        </p>
      ) : null}
      {step === "survey" ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium">Your industry</label>
          <select
            className="h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            <option value="">Select…</option>
            <option value="hospitality">Hospitality</option>
            <option value="retail">Retail</option>
            <option value="services">Services</option>
            <option value="other">Other</option>
          </select>
          <label className="block text-sm font-medium">What do you need most?</label>
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-[#D5DADF] p-3 text-sm"
            value={surveyAnswer}
            onChange={(e) => setSurveyAnswer(e.target.value)}
          />
        </div>
      ) : null}
      {step === "thanks" ? (
        <p className="text-sm text-[#34495E]">Thank you — we will notify your organization.</p>
      ) : null}
    </ModalShell>
  );
}
