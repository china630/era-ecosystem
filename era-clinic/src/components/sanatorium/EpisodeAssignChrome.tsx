"use client";

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";

export type ScheduleCardItem = {
  id: string;
  title: string;
  subtitle?: string;
  status: string;
  atLabel?: string;
};

type Props = {
  title?: string;
  emptyLabel: string;
  items: ScheduleCardItem[];
  actions?: ReactNode;
};

/** CLI-57 — stacked schedule cards on Müalicə kartı (not proposed checkboxes). */
export function EpisodeScheduleCards({ title, emptyLabel, items, actions }: Props) {
  return (
    <section className="space-y-2">
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title ? <h3 className="font-semibold">{title}</h3> : <span />}
          {actions}
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`${CARD_CONTAINER_CLASS} border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-[13px]`}
            >
              <div className="font-medium">{item.title}</div>
              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                {item.atLabel ? (
                  <span className="font-semibold text-[#34495E]">{item.atLabel}</span>
                ) : null}
                {(() => {
                  let rest = item.subtitle?.trim() ?? "";
                  if (item.atLabel && rest.startsWith(item.atLabel)) {
                    rest = rest.slice(item.atLabel.length).replace(/^[·\-\s]+/, "");
                  }
                  const parts = [rest || null, item.status].filter(Boolean);
                  if (parts.length === 0) return null;
                  return (
                    <span>
                      {item.atLabel ? " · " : ""}
                      {parts.join(" · ")}
                    </span>
                  );
                })()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export type AssignPendingRow = {
  id: string;
  title: string;
  amountNet: number;
  status: string;
  /** Diagnostics unpaid rows carry lab|visit for pay/delete API. */
  kind?: "lab" | "visit";
};

type AssignBlocksProps = {
  packageTitle: string;
  extrasTitle: string;
  onPackagePlus: () => void;
  onExtrasPlus: () => void;
  readOnly?: boolean;
  /** CLI-57 walk-in: hide package block (extras only). */
  hidePackage?: boolean;
  /** PENDING_PAY / awaiting-payment rows visible on the card (ADR D8). */
  extrasPending?: AssignPendingRow[];
  pendingPayLabel?: string;
  payLabel?: string;
  deleteLabel?: string;
  /** unpaid rows: amber (procedures) or red (diagnostics). */
  pendingTone?: "amber" | "red";
  /** When set, red/amber rows show Pay on the card (diagnostics). */
  onPayPending?: (row: AssignPendingRow) => void;
  /** When set, rows show delete on the card. */
  onRemovePending?: (row: AssignPendingRow) => void;
  pendingBusy?: boolean;
};

export function EpisodeAssignBlocks({
  packageTitle,
  extrasTitle,
  onPackagePlus,
  onExtrasPlus,
  readOnly,
  hidePackage,
  extrasPending = [],
  pendingPayLabel = "Awaiting payment",
  payLabel = "Pay",
  deleteLabel = "Delete",
  pendingTone = "amber",
  onPayPending,
  onRemovePending,
  pendingBusy,
}: AssignBlocksProps) {
  const showExtrasBlock = hidePackage || extrasPending.length > 0;
  const showRowActions = Boolean(onPayPending || onRemovePending);
  return (
    <div className="space-y-3">
      {!hidePackage ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{packageTitle}</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={readOnly}
              onClick={onPackagePlus}
              aria-label={packageTitle}
            >
              +
            </button>
          </div>
        </div>
      ) : null}
      {showExtrasBlock ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{extrasTitle}</h3>
            {hidePackage ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={readOnly}
                onClick={onExtrasPlus}
                aria-label={extrasTitle}
              >
                +
              </button>
            ) : null}
          </div>
          {extrasPending.length > 0 ? (
            <ul className="space-y-1.5">
              {extrasPending.map((row) => (
                <li
                  key={row.id}
                  className={`${CARD_CONTAINER_CLASS} border px-3 py-2 text-[13px] ${
                    pendingTone === "red"
                      ? "border-red-100 bg-red-50/60"
                      : "border-amber-100 bg-amber-50/50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{row.title}</div>
                      <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                        {Number(row.amountNet).toFixed(2)} AZN · {pendingPayLabel}
                      </p>
                    </div>
                    {showRowActions ? (
                      <div className="flex flex-wrap gap-2">
                        {onPayPending ? (
                          <button
                            type="button"
                            className={PRIMARY_BUTTON_CLASS}
                            disabled={readOnly || pendingBusy}
                            onClick={() => onPayPending(row)}
                          >
                            {payLabel}
                          </button>
                        ) : null}
                        {onRemovePending ? (
                          <button
                            type="button"
                            className={SECONDARY_BUTTON_CLASS}
                            disabled={readOnly || pendingBusy}
                            onClick={() => onRemovePending(row)}
                            aria-label={deleteLabel}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
