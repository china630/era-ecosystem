import type { ImportTx } from "@/lib/import/types";
import {
  normalizeMedicalPackageCode,
  overlayFoPackageCodes,
  programCodeForLifecycle,
  resolveMedicalSku,
  summarizeMedicalSku,
  type MedicalPackageCode,
} from "@/lib/services/medical-package-resolve.service";

type TxLike = Pick<
  ImportTx,
  "reservation" | "reservationGuest" | "reservationNote" | "agency"
>;

/**
 * Load notes + agency + pax, resolve SKUs, stamp ReservationGuest + Reservation.
 * An explicit guest-column code wins for that pax. An empty column inherits the
 * stay SKU (ERA-PKG, agency, PKG-* rate plan).
 */
export async function stampMedicalPackagesForReservation(
  tx: TxLike,
  reservationId: string,
  opts?: { foPerGuestCodes?: Array<string | null | undefined> },
): Promise<{
  unanimousCode: MedicalPackageCode | null;
  unresolved: boolean;
  programCode?: string;
  /** Parallel to ReservationGuest sort order. Null = no medical SKU for that pax. */
  perGuestCodes: (MedicalPackageCode | null)[];
  stayKind: "leisure" | "medical" | "unresolved";
}> {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    include: {
      notes: true,
      paxGuests: { orderBy: { sortOrder: "asc" } },
      agency: true,
      ratePlan: { select: { code: true } },
      guest: { select: { fullName: true, firstName: true, lastName: true } },
    },
  });
  if (!reservation) {
    return {
      unanimousCode: null,
      unresolved: true,
      perGuestCodes: [],
      stayKind: "unresolved",
    };
  }

  const agencyName = reservation.agency?.name ?? reservation.agency?.code ?? null;
  const guests =
    reservation.paxGuests.length > 0
      ? reservation.paxGuests.map((g) => ({
          firstName: g.firstName,
          lastName: g.lastName,
          fullName: [g.firstName, g.lastName].filter(Boolean).join(" ") || null,
        }))
      : [
          {
            fullName: reservation.guest.fullName,
            firstName: reservation.guest.firstName,
            lastName: reservation.guest.lastName,
          },
        ];

  let result = resolveMedicalSku({
    notes: reservation.notes.map((n) => ({
      noteType: n.noteType,
      text: n.text,
    })),
    agencyName,
    guests,
    ratePlanCode: reservation.ratePlan.code,
    agencyPackageCode: reservation.agency?.medicalPackageCode ?? null,
  });

  if (opts?.foPerGuestCodes) {
    const codes =
      reservation.paxGuests.length > 0
        ? reservation.paxGuests.map((_, i) => opts.foPerGuestCodes![i] ?? null)
        : [opts.foPerGuestCodes[0] ?? null];
    result = overlayFoPackageCodes(result, codes, agencyName);
  } else if (reservation.paxGuests.length > 0) {
    // Import / check-in without a fresh column: keep a prior stamp only where
    // notes, agency, and the rate plan left that pax empty.
    result = summarizeMedicalSku(
      result.perGuestCodes.map(
        (code, i) =>
          code ??
          normalizeMedicalPackageCode(reservation.paxGuests[i]?.medicalPackageCode ?? null),
      ),
      agencyName,
    );
  }

  if (reservation.paxGuests.length > 0) {
    const masked = result.perGuestCodes.map((code, i) => {
      const guest = reservation.paxGuests[i];
      if (!guest) return code;
      const named = Boolean(
        guest.guestId || guest.firstName?.trim() || guest.lastName?.trim(),
      );
      return named ? code : null;
    });
    if (masked.some((code, i) => code !== result.perGuestCodes[i])) {
      result = summarizeMedicalSku(masked, agencyName);
    }
  }

  await tx.reservation.update({
    where: { id: reservationId },
    data: {
      medicalPackageCode: result.reservationCode,
      medicalPackageUnresolved: result.unresolved,
    },
  });

  if (reservation.paxGuests.length > 0) {
    await Promise.all(
      reservation.paxGuests.map((g, i) =>
        tx.reservationGuest.update({
          where: { id: g.id },
          data: { medicalPackageCode: result.perGuestCodes[i] ?? null },
        }),
      ),
    );
  }

  return {
    unanimousCode: result.unanimousCode,
    unresolved: result.unresolved,
    programCode: programCodeForLifecycle(result),
    perGuestCodes: result.perGuestCodes,
    stayKind: result.stayKind,
  };
}

/** Resolve without DB write — for check-in when stamps may already exist. */
export async function resolveProgramCodeForReservation(
  tx: TxLike,
  reservationId: string,
): Promise<string | undefined> {
  const stamped = await stampMedicalPackagesForReservation(tx, reservationId);
  return stamped.programCode;
}
