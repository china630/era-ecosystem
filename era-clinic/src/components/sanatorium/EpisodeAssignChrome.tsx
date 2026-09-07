"use client";

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
  title: string;
  emptyLabel: string;
  items: ScheduleCardItem[];
};

/** CLI-57 — stacked schedule cards on Müalicə kartı (not proposed checkboxes). */
export function EpisodeScheduleCards({ title, emptyLabel, items }: Props) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">{title}</h3>
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
                {[item.atLabel, item.subtitle, item.status].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type AssignBlocksProps = {
  packageTitle: string;
  extrasTitle: string;
  day1Label: string;
  onPackagePlus: () => void;
  onExtrasPlus: () => void;
  onDay1?: () => void;
  day1Busy?: boolean;
  day1Disabled?: boolean;
  readOnly?: boolean;
  /** CLI-57 walk-in: hide package block (extras only). */
  hidePackage?: boolean;
  /** PENDING_PAY rows visible on the card (ADR D8). */
  extrasPending?: Array<{
    id: string;
    title: string;
    amountNet: number;
    status: string;
  }>;
  pendingPayLabel?: string;
};

export function EpisodeAssignBlocks({
  packageTitle,
  extrasTitle,
  day1Label,
  onPackagePlus,
  onExtrasPlus,
  onDay1,
  day1Busy,
  day1Disabled,
  readOnly,
  hidePackage,
  extrasPending = [],
  pendingPayLabel = "Awaiting payment",
}: AssignBlocksProps) {
  return (
    <div className="space-y-3">
      {!hidePackage ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{packageTitle}</h3>
          <div className="flex flex-wrap gap-2">
            {onDay1 ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={readOnly || day1Busy || day1Disabled}
                onClick={onDay1}
              >
                {day1Label}
              </button>
            ) : null}
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
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{extrasTitle}</h3>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={readOnly}
            onClick={onExtrasPlus}
            aria-label={extrasTitle}
          >
            +
          </button>
        </div>
        {extrasPending.length > 0 ? (
          <ul className="space-y-1.5">
            {extrasPending.map((row) => (
              <li
                key={row.id}
                className={`${CARD_CONTAINER_CLASS} border border-amber-100 bg-amber-50/50 px-3 py-2 text-[13px]`}
              >
                <div className="font-medium">{row.title}</div>
                <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
                  {Number(row.amountNet).toFixed(2)} AZN · {pendingPayLabel}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
