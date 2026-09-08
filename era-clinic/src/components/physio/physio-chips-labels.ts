import type { PhysioChipsLabels } from "@/components/physio/PhysioSiteChips";

type Translate = (key: string, values?: { defaultValue?: string }) => string;

/** Shared patientCard.* physio strings for assign modals and card chips. */
export function buildPhysioChipsLabels(t: Translate): PhysioChipsLabels {
  return {
    sites: t("physioSites", { defaultValue: "Sites" }),
    addSite: t("physioAddSite", { defaultValue: "Add site" }),
    applyMode: t("physioApplyMode", { defaultValue: "Apply" }),
    together: t("physioTogether", { defaultValue: "Together" }),
    turn: t("physioTurn", { defaultValue: "In turn" }),
    note: t("physioNote", { defaultValue: "Note" }),
    noteHint: t("physioNoteHint", { defaultValue: "Comments and unmatched leftover" }),
    remove: t("physioRemoveSite", { defaultValue: "Remove site" }),
    laterality: t("physioLaterality", { defaultValue: "Side" }),
    left: t("physioLeft", { defaultValue: "Left" }),
    right: t("physioRight", { defaultValue: "Right" }),
    both: t("physioBoth", { defaultValue: "Both" }),
    workKind: t("physioWorkKind", { defaultValue: "Work kind" }),
    deviceProgram: t("physioDeviceProgram", { defaultValue: "Program" }),
    electrodeCount: t("physioElectrodeCount", { defaultValue: "Electrodes" }),
    deviceParam: t("physioDeviceParam", { defaultValue: "Device param" }),
    noAdditive: t("physioNoAdditive", { defaultValue: "No additive" }),
    applicationSurface: t("physioApplicationSurface", { defaultValue: "Surface" }),
    substance: t("physioSubstance", { defaultValue: "Substance" }),
    extraOil: t("physioExtraOil", { defaultValue: "Extra oil" }),
    holdOrStop: t("physioHoldOrStop", { defaultValue: "Hold / stop" }),
    spineLevel: t("physioSpineLevel", { defaultValue: "Spine level" }),
    dayBlock: t("physioDayBlock", { defaultValue: "Day block" }),
    bathSequence: t("physioBathSequence", { defaultValue: "Bath sequence" }),
    naftalanFill: t("physioNaftalanFill", { defaultValue: "Naftalan fill" }),
    intensity: t("physioIntensity", { defaultValue: "Intensity" }),
    smear: t("physioSmear", { defaultValue: "Smear" }),
    yes: t("physioYes", { defaultValue: "Yes" }),
    no: t("physioNo", { defaultValue: "No" }),
    unset: t("physioUnset", { defaultValue: "—" }),
    surfaceFrontBack: t("physioSurfaceFrontBack", { defaultValue: "Front / back" }),
    surfaceUpper: t("physioSurfaceUpper", { defaultValue: "Upper" }),
    surfaceLower: t("physioSurfaceLower", { defaultValue: "Lower" }),
    dayBlockAlt: t("physioDayBlockAlt", { defaultValue: "Every other day" }),
    dayBlockThen: t("physioDayBlockThen", { defaultValue: "5 days then" }),
    bathSitzThenFull: t("physioBathSitzThenFull", { defaultValue: "Sitz then full" }),
    fillTam: t("physioFillTam", { defaultValue: "Full body (tam)" }),
    fillOturaq: t("physioFillOturaq", { defaultValue: "Sitz (oturaq)" }),
    fillQursaq: t("physioFillQursaq", { defaultValue: "To waist (qurşaq)" }),
    catalogEmpty: t("physioCatalogEmpty", {
      defaultValue: "Physio site catalog is not seeded.",
    }),
    catalogEmptyLink: t("physioCatalogEmptyLink", { defaultValue: "Open Physio sites" }),
    intensityLight: t("physioIntensityLight", { defaultValue: "Light" }),
    intensityWeak: t("physioIntensityWeak", { defaultValue: "Weak" }),
    intensityNotHot: t("physioIntensityNotHot", { defaultValue: "Not hot" }),
    intensityMedium: t("physioIntensityMedium", { defaultValue: "Medium" }),
    intensityMore: t("physioIntensityMore", { defaultValue: "More" }),
    sitesHintHydroJets: t("physioSitesHintHydroJets", {
      defaultValue:
        "Do not aim jets at the heart, breasts, or groin. Prefer back, lumbar, thighs, calves, and feet.",
    }),
  };
}
