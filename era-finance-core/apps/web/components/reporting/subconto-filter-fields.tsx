"use client";

import { useTranslation } from "react-i18next";
import { MODAL_INPUT_CLASS } from "../../lib/design-system";
import type { SubcontoType } from "../../lib/use-subconto-filters";

type Props = {
  types: SubcontoType[];
  enabled: boolean;
  ready: boolean;
  subcontoTypeId: string;
  valueId: string;
  onSubcontoTypeIdChange: (id: string) => void;
  onValueIdChange: (id: string) => void;
  showValueFilter?: boolean;
};

export function SubcontoFilterFields({
  types,
  enabled,
  ready,
  subcontoTypeId,
  valueId,
  onSubcontoTypeIdChange,
  onValueIdChange,
  showValueFilter = true,
}: Props) {
  const { t } = useTranslation();

  if (!ready) return null;

  return (
    <>
      <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
        {t("reporting.subconto.type")}
        <select
          className={MODAL_INPUT_CLASS}
          value={subcontoTypeId}
          onChange={(e) => onSubcontoTypeIdChange(e.target.value)}
        >
          <option value="">{t("reporting.subconto.typeAll")}</option>
          {types.map((st) => (
            <option key={st.id} value={st.id}>
              {st.code} — {st.name}
            </option>
          ))}
        </select>
      </label>
      {showValueFilter && subcontoTypeId ? (
        <label className="flex flex-col gap-1 text-sm font-medium text-[#34495E]">
          {t("reporting.subconto.valueId")}
          <input
            type="text"
            className={MODAL_INPUT_CLASS}
            value={valueId}
            placeholder={t("reporting.subconto.valueIdPlaceholder")}
            onChange={(e) => onValueIdChange(e.target.value)}
          />
        </label>
      ) : null}
      {!enabled ? (
        <p className="text-xs text-[#7F8C8D] self-center">{t("reporting.subconto.disabledNote")}</p>
      ) : null}
    </>
  );
}
