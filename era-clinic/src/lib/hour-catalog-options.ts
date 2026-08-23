/** Closed-small hour picks for CatalogField (06:00–22:00). */
export function hourCatalogOptions(fromHour = 6, toHour = 22) {
  const options: Array<{ value: string; label: string }> = [];
  for (let hour = fromHour; hour <= toHour; hour += 1) {
    options.push({
      value: String(hour),
      label: `${String(hour).padStart(2, "0")}:00`,
    });
  }
  return options;
}
