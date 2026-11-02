export function clinicLifecycleDedupeKey(input: {
  kind: string;
  reservationId: string;
  paxKey?: string | null;
}): string {
  return `${input.kind}:${input.reservationId}:${(input.paxKey ?? "").trim()}`;
}

export function clinicLifecyclePayloadChanged(previous: unknown, next: unknown): boolean {
  return JSON.stringify(previous ?? null) !== JSON.stringify(next ?? null);
}
