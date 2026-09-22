"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FORM_INPUT_CLASS } from "./design-system";
import { AUTH_FIELD_GROUP_CLASS, AUTH_FIELD_LABEL_CLASS } from "./auth-login-card";
import { readLoginOrgNoPrefill } from "../auth/staff-login-org-storage";

export function useStaffLoginOrgNo(searchParams: {
  get: (key: string) => string | null;
}): {
  orgNo: string;
  setOrgNo: (value: string) => void;
  hostBound: boolean;
} {
  const [orgNo, setOrgNo] = useState("");
  const [hostBound, setHostBound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/login", { method: "GET", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { hostBound?: boolean; orgNo?: string } | null) => {
        if (cancelled) return;
        if (j?.hostBound) {
          setHostBound(true);
          if (j.orgNo) setOrgNo(j.orgNo);
          return;
        }
        setHostBound(false);
        setOrgNo(readLoginOrgNoPrefill(searchParams));
      })
      .catch(() => {
        if (!cancelled) setOrgNo(readLoginOrgNoPrefill(searchParams));
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return { orgNo, setOrgNo, hostBound };
}

export function StaffLoginOrgNoField(props: {
  orgNo: string;
  onOrgNoChange: (value: string) => void;
  hostBound: boolean;
  label: string;
  placeholder: string;
  hint?: string;
}): ReactNode {
  if (props.hostBound) return null;
  const hint = props.hint?.trim();
  return (
    <label className={AUTH_FIELD_GROUP_CLASS}>
      <span className={AUTH_FIELD_LABEL_CLASS}>{props.label}</span>
      <input
        className={`${FORM_INPUT_CLASS} font-mono text-sm`}
        value={props.orgNo}
        onChange={(e) => props.onOrgNoChange(e.target.value)}
        placeholder={props.placeholder}
        autoComplete="off"
        spellCheck={false}
        name="orgNo"
        inputMode="numeric"
        maxLength={6}
      />
      {hint ? <span className="block text-xs text-[#7F8C8D]">{hint}</span> : null}
    </label>
  );
}
