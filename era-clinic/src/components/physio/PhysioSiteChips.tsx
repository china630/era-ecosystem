"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CatalogField,
  FieldTextarea,
  type CatalogOption,
} from "@era/satellite-kit/ui";
import {
  AMPLIPULS_WORK_KINDS,
  APPLICATION_SURFACE_CODES,
  BATH_SEQUENCE_CODES,
  DAY_BLOCK_CODES,
  DEVICE_PARAM_CODES,
  ELECTRODE_COUNTS,
  INTENSITY_CODES,
  NAFTALAN_FILL_CODES,
  SPINE_LEVEL_CODES,
  type PhysioLateralityCode,
  type PhysioOrderFieldCode,
  type PhysioOrderFields,
} from "@/domain/physio/physio-order-fields";

export type PhysioCatalogSite = {
  id: string;
  code: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
  titleLa: string;
  laterality?: boolean;
  aliases?: Array<{ alias: string }>;
};

export type PhysioCatalogListItem = {
  id: string;
  code: string;
  titleAz: string;
  titleRu: string;
  titleEn: string;
};

export type PhysioChipsValue = {
  needsSite: boolean;
  physioOrderFields: string[];
  allowedSiteCodes: string[];
  forceSiteTogether?: boolean;
  sitesHintKey?: "hydro_jet_safety" | null;
  siteIds: string[];
  siteApplyMode: "TOGETHER" | "TURN" | null;
  siteLaterality: Record<string, PhysioLateralityCode | null>;
  physioFields: PhysioOrderFields;
  note: string | null;
};

export type PhysioChipsLabels = {
  sites: string;
  addSite: string;
  applyMode: string;
  together: string;
  turn: string;
  note: string;
  noteHint: string;
  remove: string;
  laterality: string;
  left: string;
  right: string;
  both: string;
  workKind: string;
  deviceProgram: string;
  electrodeCount: string;
  deviceParam: string;
  noAdditive: string;
  applicationSurface: string;
  substance: string;
  extraOil: string;
  holdOrStop: string;
  spineLevel: string;
  dayBlock: string;
  bathSequence: string;
  naftalanFill: string;
  intensity: string;
  smear: string;
  yes: string;
  no: string;
  unset: string;
  surfaceFrontBack: string;
  surfaceUpper: string;
  surfaceLower: string;
  dayBlockAlt: string;
  dayBlockThen: string;
  bathSitzThenFull: string;
  fillTam: string;
  fillOturaq: string;
  fillQursaq: string;
  catalogEmpty: string;
  catalogEmptyLink: string;
  intensityLight: string;
  intensityWeak: string;
  intensityNotHot: string;
  intensityMedium: string;
  intensityMore: string;
  sitesHintHydroJets: string;
};

function siteChipLabel(site: PhysioCatalogSite, locale: string): string {
  const loc =
    locale.startsWith("ru") ? site.titleRu : locale.startsWith("az") ? site.titleAz : site.titleEn;
  return `${loc} / ${site.titleLa}`;
}

function siteSearchLabel(site: PhysioCatalogSite, locale: string): string {
  const aliases = (site.aliases ?? []).map((a) => a.alias).join(" ");
  return `${siteChipLabel(site, locale)} ${site.code} ${aliases}`.trim();
}

function listItemLabel(item: PhysioCatalogListItem, locale: string): string {
  const loc =
    locale.startsWith("ru") ? item.titleRu : locale.startsWith("az") ? item.titleAz : item.titleEn;
  return `${loc} (${item.code})`;
}

function hasField(fields: string[], code: PhysioOrderFieldCode): boolean {
  return fields.includes(code);
}

function flagValue(raw: boolean | null | undefined): string {
  if (raw === true) return "true";
  if (raw === false) return "false";
  return "";
}

function pickOpt<T extends string>(allowed: readonly T[], raw: unknown): T | null {
  const s = String(raw ?? "");
  return (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

export function PhysioSiteChips({
  value,
  catalog,
  programs,
  substances,
  locale,
  editable,
  labels,
  onSitesChange,
  onModeChange,
  onNoteBlur,
  onLateralityChange,
  onFieldsChange,
}: {
  value: PhysioChipsValue;
  catalog: PhysioCatalogSite[];
  programs: PhysioCatalogListItem[];
  substances: PhysioCatalogListItem[];
  locale: string;
  editable: boolean;
  labels: PhysioChipsLabels;
  onSitesChange: (siteIds: string[]) => void;
  onModeChange: (mode: "TOGETHER" | "TURN") => void;
  onNoteBlur: (note: string) => void;
  onLateralityChange: (siteId: string, laterality: PhysioLateralityCode | null) => void;
  onFieldsChange: (fields: PhysioOrderFields) => void;
}) {
  const [note, setNote] = useState(value.note ?? "");
  useEffect(() => {
    setNote(value.note ?? "");
  }, [value.note]);
  const byId = useMemo(() => new Map(catalog.map((s) => [s.id, s])), [catalog]);
  const allowed = value.physioOrderFields ?? [];
  const fields = value.physioFields ?? {};
  const allowedSiteCodes = value.allowedSiteCodes ?? [];

  const pickerCatalog = useMemo(() => {
    if (!allowedSiteCodes.length) return catalog;
    const allow = new Set(allowedSiteCodes);
    return catalog.filter((s) => allow.has(s.code) || value.siteIds.includes(s.id));
  }, [catalog, allowedSiteCodes, value.siteIds]);

  const options: CatalogOption[] = useMemo(
    () =>
      pickerCatalog
        .filter((s) => !value.siteIds.includes(s.id))
        .map((s) => ({ value: s.id, label: siteSearchLabel(s, locale) })),
    [pickerCatalog, locale, value.siteIds],
  );

  const modeOptions: CatalogOption[] = [
    { value: "TOGETHER", label: labels.together },
    { value: "TURN", label: labels.turn },
  ];

  const lateralityOptions: CatalogOption[] = [
    { value: "", label: labels.unset },
    { value: "LEFT", label: labels.left },
    { value: "RIGHT", label: labels.right },
    { value: "BOTH", label: labels.both },
  ];

  const flagOptions: CatalogOption[] = [
    { value: "", label: labels.unset },
    { value: "true", label: labels.yes },
    { value: "false", label: labels.no },
  ];

  function patchFields(next: Partial<PhysioOrderFields>) {
    onFieldsChange({ ...fields, ...next });
  }

  const showLaterality = hasField(allowed, "LATERALITY");

  return (
    <div className="mt-2 space-y-2">
      {value.needsSite ? (
        <>
          <div>
            <p className="mb-1 text-[12px] font-medium text-[#2C3E50]">{labels.sites}</p>
            <div className="flex flex-wrap gap-1">
              {value.siteIds.map((id) => {
                const site = byId.get(id);
                const text = site ? siteChipLabel(site, locale) : id;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-[#2C3E50] bg-white px-2 py-0.5 text-[12px]"
                  >
                    {text}
                    {editable ? (
                      <button
                        type="button"
                        className="text-[#7F8C8D] hover:text-[#E74C3C]"
                        aria-label={labels.remove}
                        onClick={() => onSitesChange(value.siteIds.filter((x) => x !== id))}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
            {value.sitesHintKey === "hydro_jet_safety" ? (
              <p className="mt-1 text-[11px] leading-snug text-[#7F8C8D]">{labels.sitesHintHydroJets}</p>
            ) : null}
            {showLaterality
              ? value.siteIds.map((id) => {
                  const site = byId.get(id);
                  if (!site?.laterality) return null;
                  const lat = value.siteLaterality[id] ?? "";
                  if (!editable) {
                    return lat ? (
                      <p key={`lat-${id}`} className="text-[12px] text-[#7F8C8D]">
                        {siteChipLabel(site, locale)}:{" "}
                        {lat === "LEFT" ? labels.left : lat === "RIGHT" ? labels.right : labels.both}
                      </p>
                    ) : null;
                  }
                  return (
                    <CatalogField
                      key={`lat-${id}`}
                      kind="OPS_HOT"
                      label={`${labels.laterality} · ${siteChipLabel(site, locale)}`}
                      value={lat}
                      onChange={(next) => {
                        const raw = String(next);
                        onLateralityChange(
                          id,
                          raw === "LEFT" || raw === "RIGHT" || raw === "BOTH" ? raw : null,
                        );
                      }}
                      options={lateralityOptions}
                    />
                  );
                })
              : null}
          </div>
          {editable ? (
            catalog.length === 0 ? (
              <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[12px] text-amber-900">
                {labels.catalogEmpty}{" "}
                <a href="/admin/physio-sites" className="underline">
                  {labels.catalogEmptyLink}
                </a>
              </p>
            ) : (
              <CatalogField
                kind="SEARCHABLE"
                label={labels.addSite}
                value=""
                onChange={(next) => {
                  const id = String(next);
                  if (!id || value.siteIds.includes(id)) return;
                  onSitesChange([...value.siteIds, id]);
                }}
                options={options}
                emptyLabel={null}
              />
            )
          ) : null}
          {value.siteIds.length >= 2 && editable && !value.forceSiteTogether ? (
            <CatalogField
              kind="OPS_HOT"
              label={labels.applyMode}
              value={value.siteApplyMode ?? "TOGETHER"}
              onChange={(next) => onModeChange(String(next) === "TURN" ? "TURN" : "TOGETHER")}
              options={modeOptions}
            />
          ) : null}
          {value.siteIds.length >= 2 && !editable && value.siteApplyMode && !value.forceSiteTogether ? (
            <p className="text-[12px] text-[#7F8C8D]">
              {value.siteApplyMode === "TURN" ? labels.turn : labels.together}
            </p>
          ) : null}
        </>
      ) : null}

      {hasField(allowed, "AMPLIPULS_WORK_KIND") ? (
        <CatalogField
          kind="CLOSED_SMALL"
          label={labels.workKind}
          value={fields.amplipulsWorkKind ?? ""}
          onChange={(next) => patchFields({ amplipulsWorkKind: pickOpt(AMPLIPULS_WORK_KINDS, next) })}
          options={AMPLIPULS_WORK_KINDS.map((v) => ({ value: v, label: v }))}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "DEVICE_PROGRAM") ? (
        <CatalogField
          kind="SEARCHABLE"
          label={labels.deviceProgram}
          value={fields.deviceProgramId ?? ""}
          onChange={(next) => patchFields({ deviceProgramId: String(next) || null })}
          options={programs.map((p) => ({ value: p.id, label: listItemLabel(p, locale) }))}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "ELECTRODE_COUNT") ? (
        <CatalogField
          kind="OPS_HOT"
          label={labels.electrodeCount}
          value={fields.electrodeCount ?? ""}
          onChange={(next) => {
            const raw = String(next);
            patchFields({ electrodeCount: raw === "2" || raw === "4" ? raw : null });
          }}
          options={[
            { value: "", label: labels.unset },
            ...ELECTRODE_COUNTS.map((v) => ({ value: v, label: v })),
          ]}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "DEVICE_PARAMS") ? (
        <CatalogField
          kind="CLOSED_SMALL"
          label={labels.deviceParam}
          value={fields.deviceParam ?? ""}
          onChange={(next) => patchFields({ deviceParam: pickOpt(DEVICE_PARAM_CODES, next) })}
          options={DEVICE_PARAM_CODES.map((v) => ({ value: v, label: v }))}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "SUBSTANCE_OR_ADDITIVE") ? (
        <CatalogField
          kind="SEARCHABLE"
          label={labels.substance}
          value={fields.substanceId ?? ""}
          onChange={(next) => patchFields({ substanceId: String(next) || null })}
          options={substances.map((p) => ({ value: p.id, label: listItemLabel(p, locale) }))}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "APPLICATION_SURFACE") ? (
        <CatalogField
          kind="CLOSED_SMALL"
          label={labels.applicationSurface}
          value={fields.applicationSurface ?? ""}
          onChange={(next) => patchFields({ applicationSurface: pickOpt(APPLICATION_SURFACE_CODES, next) })}
          options={[
            { value: "FRONT_BACK", label: labels.surfaceFrontBack },
            { value: "UPPER", label: labels.surfaceUpper },
            { value: "LOWER", label: labels.surfaceLower },
          ]}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "SPINE_LEVEL") ? (
        <CatalogField
          kind="SEARCHABLE"
          label={labels.spineLevel}
          value={fields.spineLevel ?? ""}
          onChange={(next) => patchFields({ spineLevel: pickOpt(SPINE_LEVEL_CODES, next) })}
          options={SPINE_LEVEL_CODES.map((v) => ({ value: v, label: v }))}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "DAY_BLOCK") ? (
        <CatalogField
          kind="CLOSED_SMALL"
          label={labels.dayBlock}
          value={fields.dayBlock ?? ""}
          onChange={(next) => patchFields({ dayBlock: pickOpt(DAY_BLOCK_CODES, next) })}
          options={DAY_BLOCK_CODES.map((v) => ({
            value: v,
            label:
              v === "ALTERNATING"
                ? labels.dayBlockAlt
                : v === "2"
                  ? "2"
                  : v === "3"
                    ? "3"
                    : v === "5"
                      ? "5"
                      : v,
          }))}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "BATH_SEQUENCE") ? (
        <CatalogField
          kind="CLOSED_SMALL"
          label={labels.bathSequence}
          value={fields.bathSequence ?? ""}
          onChange={(next) => patchFields({ bathSequence: pickOpt(BATH_SEQUENCE_CODES, next) })}
          options={BATH_SEQUENCE_CODES.map((v) => ({
            value: v,
            label: labels.bathSitzThenFull,
          }))}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "NAFTALAN_FILL") ? (
        <CatalogField
          kind="CLOSED_SMALL"
          label={labels.naftalanFill}
          value={fields.naftalanFill ?? ""}
          onChange={(next) => patchFields({ naftalanFill: pickOpt(NAFTALAN_FILL_CODES, next) })}
          options={NAFTALAN_FILL_CODES.map((v) => ({
            value: v,
            label: v === "TAM" ? labels.fillTam : v === "OTURAQ" ? labels.fillOturaq : labels.fillQursaq,
          }))}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "INTENSITY") ? (
        <CatalogField
          kind="CLOSED_SMALL"
          label={labels.intensity}
          value={fields.intensity ?? ""}
          onChange={(next) => patchFields({ intensity: pickOpt(INTENSITY_CODES, next) })}
          options={INTENSITY_CODES.map((v) => ({
            value: v,
            label:
              v === "LIGHT"
                ? labels.intensityLight
                : v === "WEAK"
                  ? labels.intensityWeak
                  : v === "NOT_HOT"
                    ? labels.intensityNotHot
                    : v === "MEDIUM"
                      ? labels.intensityMedium
                      : labels.intensityMore,
          }))}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "NO_ADDITIVE") ? (
        <CatalogField
          kind="OPS_HOT"
          label={labels.noAdditive}
          value={flagValue(fields.noAdditive)}
          onChange={(next) => {
            const raw = String(next);
            patchFields({ noAdditive: raw === "" ? null : raw === "true" });
          }}
          options={flagOptions}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "EXTRA_OIL") ? (
        <CatalogField
          kind="OPS_HOT"
          label={labels.extraOil}
          value={flagValue(fields.extraOil)}
          onChange={(next) => {
            const raw = String(next);
            patchFields({ extraOil: raw === "" ? null : raw === "true" });
          }}
          options={flagOptions}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "HOLD_OR_STOP") ? (
        <CatalogField
          kind="OPS_HOT"
          label={labels.holdOrStop}
          value={flagValue(fields.holdOrStop)}
          onChange={(next) => {
            const raw = String(next);
            patchFields({ holdOrStop: raw === "" ? null : raw === "true" });
          }}
          options={flagOptions}
          disabled={!editable}
        />
      ) : null}
      {hasField(allowed, "SMEAR") ? (
        <CatalogField
          kind="OPS_HOT"
          label={labels.smear}
          value={flagValue(fields.smear)}
          onChange={(next) => {
            const raw = String(next);
            patchFields({ smear: raw === "" ? null : raw === "true" });
          }}
          options={flagOptions}
          disabled={!editable}
        />
      ) : null}

      {editable ? (
        <FieldTextarea
          label={labels.note}
          hint={labels.noteHint}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== (value.note ?? "")) onNoteBlur(note);
          }}
        />
      ) : value.note ? (
        <p className="text-[12px] text-[#7F8C8D]">{value.note}</p>
      ) : null}
    </div>
  );
}
