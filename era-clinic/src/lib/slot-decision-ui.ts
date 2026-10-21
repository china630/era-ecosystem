const SLOT_I18N: Record<string, string> = {
  CROSS_DAY: "slotCrossDay",
  CLOSED: "slotClosed",
  DAY_FULL: "slotDayFull",
  BATH_REST: "slotBathRest",
  WEEK_FULL: "slotWeekFull",
  PAST_CHECKOUT: "slotPastCheckout",
  CHECKOUT_NOON: "slotCheckoutNoon",
  NO_STAFF: "slotNoStaff",
  STAFF_BUSY: "slotStaffBusy",
  CABIN_BUSY: "slotCabinBusy",
  CABIN_SEX: "cabinSexMismatch",
  SAME_DAY: "slotSameDay",
  LUNCH: "slotLunch",
  NO_CABIN: "slotNoCabin",
  RULE: "slotRule",
  NO_SLOT: "slotNoSlot",
};

export function localizeSlotDecision<T extends { error?: string; code?: string }>(
  data: T,
  t: (key: string) => string,
): T {
  const key = data.code ? SLOT_I18N[data.code] : undefined;
  if (key) return { ...data, error: t(key) };
  if (typeof data.error === "string" && data.error.includes("past")) {
    return { ...data, error: t("reschedulePast") };
  }
  return data;
}
