export type StayReconcileGuest = {
  reservationId: string;
  paxKey: string;
  departed: boolean;
  globalPersonId?: string;
  programCode: string;
  roomNumber?: string;
  guestName: string;
};

export type StayReconcileEpisode = {
  id: string;
  reservationId: string | null;
  globalPersonId: string | null;
  hotelStayId: string | null;
  programCode: string | null;
  roomNumber: string | null;
};

export function episodeMatchesGuest(
  episode: StayReconcileEpisode,
  guest: StayReconcileGuest,
): boolean {
  if ((episode.reservationId ?? "") !== guest.reservationId) return false;
  const gpid = guest.globalPersonId?.trim();
  if (gpid && episode.globalPersonId === gpid) return true;
  const stay = episode.hotelStayId ?? "";
  if (gpid && stay.includes(gpid.slice(0, 40))) return true;
  const pax = guest.paxKey.trim();
  if (pax && stay.includes(pax.slice(0, 24))) return true;
  return false;
}

export function closedEpisodesToSweep(
  episodes: Array<{ id: string; reservationId: string | null }>,
  checkedOutIds: string[],
): string[] {
  const checkedOut = new Set(checkedOutIds);
  return episodes
    .filter((episode) => episode.reservationId != null && checkedOut.has(episode.reservationId))
    .map((episode) => episode.id);
}

export function planClinicStayReconcile(input: {
  inHouse: StayReconcileGuest[];
  checkedOutIds: string[];
  openEpisodes: StayReconcileEpisode[];
}): {
  open: StayReconcileGuest[];
  sync: StayReconcileGuest[];
  closeEpisodeIds: string[];
} {
  const checkedOut = new Set(input.checkedOutIds);
  const closeEpisodeIds = new Set<string>();
  for (const episode of input.openEpisodes) {
    if (episode.reservationId && checkedOut.has(episode.reservationId)) {
      closeEpisodeIds.add(episode.id);
    }
  }
  const open: StayReconcileGuest[] = [];
  const sync: StayReconcileGuest[] = [];
  for (const guest of input.inHouse) {
    if (checkedOut.has(guest.reservationId)) continue;
    const match = input.openEpisodes.find(
      (episode) => !closeEpisodeIds.has(episode.id) && episodeMatchesGuest(episode, guest),
    );
    if (guest.departed) {
      if (match) closeEpisodeIds.add(match.id);
      continue;
    }
    sync.push(guest);
    if (!match) open.push(guest);
  }
  return { open, sync, closeEpisodeIds: [...closeEpisodeIds] };
}
