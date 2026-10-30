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
  banner?: ReactNode;
  hint?: string;
};

/**
 * Buffet filter panel only — CTAs belong in PageHeader.actions (UI playbook).
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="min-w-0">
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
            <div className="min-w-0">
              <Field
                label={t("fromDate")}
                preset="date"
                type="date"
                value={fromDate ?? ""}
                onChange={(e) => onFromDate(e.target.value)}
              />
            </div>
            <div className="min-w-0">
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
          <div className="min-w-0">
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
          <div className="min-w-0">
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
      </div>
      {banner}
    </div>
  );
}
