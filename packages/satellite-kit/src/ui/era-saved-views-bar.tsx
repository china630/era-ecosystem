"use client";

import type { ReactNode } from "react";
import { CatalogField } from "./catalog-field";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "./design-system";

export type EraSavedViewOption = {
  id: string;
  name: string;
  isShared?: boolean;
  isDefault?: boolean;
};

export type EraSavedViewsBarProps = {
  views: EraSavedViewOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (name: string, opts: { isShared: boolean; isDefault: boolean }) => void | Promise<void>;
  onUpdate?: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  /** When false, hide Update/Delete (e.g. shared view owned by another user). */
  canMutateSelected?: boolean;
  /** When false, hide Save (read-only roles can still apply shared views). */
  canSave?: boolean;
  canShare?: boolean;
  busy?: boolean;
  labels: {
    view: string;
    none: string;
    save: string;
    update: string;
    delete: string;
    name: string;
    shared: string;
    asDefault: string;
  };
  /** Extra toolbar (column visibility, etc.). */
  extra?: ReactNode;
};

/**
 * Named saved-view switcher for class-A lists (ADR extensibility W2).
 */
export function EraSavedViewsBar({
  views,
  selectedId,
  onSelect,
  onSave,
  onUpdate,
  onDelete,
  canMutateSelected = true,
  canSave = true,
  canShare = false,
  busy = false,
  labels,
  extra,
}: EraSavedViewsBarProps) {
  const options = [
    { value: "", label: labels.none },
    ...views.map((v) => ({
      value: v.id,
      label: `${v.name}${v.isShared ? " ★" : ""}${v.isDefault ? " •" : ""}`,
    })),
  ];

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[12rem]">
        <CatalogField
          kind="CLOSED_SMALL"
          label={labels.view}
          value={selectedId ?? ""}
          onChange={(next) => {
            const id = typeof next === "string" ? next : "";
            onSelect(id || null);
          }}
          options={options}
          disabled={busy}
        />
      </div>
      {selectedId && canMutateSelected && onUpdate ? (
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void onUpdate()}
        >
          {labels.update}
        </button>
      ) : null}
      {selectedId && canMutateSelected && onDelete ? (
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void onDelete()}
        >
          {labels.delete}
        </button>
      ) : null}
      {canSave ? (
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => {
            const name = window.prompt(labels.name);
            if (!name?.trim()) return;
            let isShared = false;
            if (canShare) {
              isShared = window.confirm(labels.shared);
            }
            const isDefault = window.confirm(labels.asDefault);
            void onSave(name.trim(), { isShared, isDefault });
          }}
        >
          {labels.save}
        </button>
      ) : null}
      {extra}
    </div>
  );
}
