/** Jest stub — avoids pulling @era/satellite-kit (jose ESM) in unit tests. */
export async function isElectiveSchedulingAllowed(_date: Date): Promise<boolean> {
  return true;
}

export async function resolveSchedulingEndHour(_date: Date): Promise<number> {
  return 17;
}

export async function nextSchedulingDay(from: Date): Promise<Date> {
  return new Date(from);
}
