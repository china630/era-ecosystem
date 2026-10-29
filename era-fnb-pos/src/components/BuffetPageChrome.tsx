"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  type CatalogFieldKind,
  Field,
} from "@era/satellite-kit/ui";
import { CARD_CLASS } from "@/lib/design-system";

export type BuffetOutletOption = { id: string; code: string; name: string };

type Props = {
  outlets: BuffetOutletOption[];
  outletId: string;
  onOutletChange: (id: string) => void;
  fromDate?: string;
  toDate?: string;
  onFromDate?: (ymd: string) => void;
  onToDate?: (ymd: string) => void;
  showDates?: boolean;
  kindFilter?: "GUEST" | "STAFF";
  onKindFilter?: (kind: "GUEST" | "STAFF") => void;
  showKind?: boolean;
  statusFilter?: string;
  statusOptions?: Array<{ value: string; label: string }>;
  onStatusFilter?: (status: string) => void;
  showStatus?: boolean;
  actions?: ReactNode;
  banner?: ReactNode;
  hint?: string;
};

/**
 * Shared buffet toolbar: fixed outlet width, equal date/filter cols, CTAs right.
 */
export default function BuffetPageChrome({
  outlets,
  outletId,
  onOutletChange,
  fromDate,
  toDate,
  onFromDate,
  onToDate,
  showDates = true,
  kindFilter,
  onKindFilter,
  showKind = false,
  statusFilter,
  statusOptions,
  onStatusFilter,
  showStatus = false,
  actions,
  banner,
  hint,
}: Props) {
  const t = useTranslations("admin.buffet");
  const outletOptions = outlets.map((o) => ({
    value: o.id,
    label: `${o.code} — ${o.name}`,
  }));

  return (
    <div className={`${CARD_CLASS} space-y-3 p-4`}>
      {hint ? <p className="m-0 text-sm text-[#7F8C8D]">{hint}</p> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full max-w-[16rem] shrink-0 sm:w-[16rem]">
          <CatalogField
            kind={"ENTITY_REF" as CatalogFieldKind}
            label={t("outlet")}
            value={outletId}
            options={outletOptions}
            onChange={(next) =>
              onOutletChange(Array.isArray(next) ? next[0] ?? "" : String(next ?? ""))
            }
          />
        </div>
        {showDates && onFromDate && onToDate ? (
          <>
            <div className="w-[9.5rem] shrink-0">
              <Field
                label={t("fromDate")}
                preset="date"
                type="date"
                value={fromDate ?? ""}
                onChange={(e) => onFromDate(e.target.value)}
              />
            </div>
            <div className="w-[9.5rem] shrink-0">
              <Field
                label={t("toDate")}
                preset="date"
                type="date"
                value={toDate ?? ""}
                onChange={(e) => onToDate(e.target.value)}
              />
            </div>
          </>
        ) : null}
        {showKind && kindFilter && onKindFilter ? (
          <div className="w-[9rem] shrink-0">
            <CatalogField
              kind={"CLOSED_SMALL" as CatalogFieldKind}
              label={t("kindFilter")}
              value={kindFilter}
              options={[
                { value: "GUEST", label: t("kind.GUEST") },
                { value: "STAFF", label: t("kind.STAFF") },
              ]}
              onChange={(next) =>
                onKindFilter(
                  (Array.isArray(next) ? next[0] : next) === "STAFF" ? "STAFF" : "GUEST",
                )
              }
            />
          </div>
        ) : null}
        {showStatus && statusOptions && onStatusFilter ? (
          <div className="w-[9rem] shrink-0">
            <CatalogField
              kind={"CLOSED_SMALL" as CatalogFieldKind}
              label={t("statusFilter")}
              value={statusFilter ?? ""}
              options={statusOptions}
              onChange={(next) =>
                onStatusFilter(Array.isArray(next) ? next[0] ?? "" : String(next ?? ""))
              }
            />
          </div>
        ) : null}
        {actions ? (
          <div className="ml-auto flex flex-wrap items-end justify-end gap-2">{actions}</div>
        ) : null}
      </div>
      {banner}
    </div>
  );
}
