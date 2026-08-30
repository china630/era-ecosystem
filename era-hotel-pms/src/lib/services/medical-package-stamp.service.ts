import type { ImportTx } from "@/lib/import/types";
import {
  normalizeMedicalPackageCode,
  programCodeForLifecycle,
  resolveMedicalSku,
  type MedicalPackageCode,
  type ResolveMedicalSkuResult,
} from "@/lib/services/medical-package-resolve.service";

type TxLike = Pick<
  ImportTx,
  "reservation" | "reservationGuest" | "reservationNote" | "agency"
>;

function resultFromFoCodes(
  foCodes: Array<string | null | undefined>,
  agencyName: string | null | undefined,
): ResolveMedicalSkuResult {
  const perGuestCodes = foCodes.map((c) => normalizeMedicalPackageCode(c ?? null));
  const distinct = [
    ...new Set(perGuestCodes.filter((c): c is MedicalPackageCode => c != null)),
  ];
  const unanimousCode =
    distinct.length === 1 && perGuestCodes.every((c) => c === distinct[0])
      ? distinct[0]
      : null;
  const stayKind: ResolveMedicalSkuResult["stayKind"] =
    distinct.length > 0
      ? "medical"
      : agencyName &&
          (/^walkin\s+leisure/i.test(agencyName) || /walk[\s-]?in\s+leisure/i.test(agencyName))
        ? "leisure"
        : "unresolved";
  return {
    perGuestCodes,
    unanimousCode,
    unresolved: !unanimousCode,
    reservationCode: unanimousCode,
    stayKind,
  };
}

/**
 * Load notes + agency + pax, resolve SKUs, stamp ReservationGuest + Reservation.
 * When `foPerGuestCodes` is set (FO Guests tab save), those codes win over note/agency resolve.
 */
export async function stampMedicalPackagesForReservation(
  tx: TxLike,
  reservationId: string,
  opts?: { foPerGuestCodes?: Array<string | null | undefined> },
): Promise<{
  unanimousCode: MedicalPackageCode | null;
  unresolved: boolean;
  programCode?: string;
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
      stayKind: "unresolved",
    };
  }

  const agencyName = reservation.agency?.name ?? reservation.agency?.code ?? null;
  let result: ResolveMedicalSkuResult;

  const foProvided =
    opts?.foPerGuestCodes &&
    opts.foPerGuestCodes.some((c) => normalizeMedicalPackageCode(c ?? null) != null);

  if (foProvided && opts?.foPerGuestCodes) {
    const codes =
      reservation.paxGuests.length > 0
        ? reservation.paxGuests.map((_, i) => opts.foPerGuestCodes![i] ?? null)
        : [opts.foPerGuestCodes[0] ?? null];
    result = resultFromFoCodes(codes, agencyName);
  } else {
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

    let agencyRules: Awaited<
      ReturnType<
        typeof import("@/lib/services/agency-medical-sku-rules.service").listAgencySkuRulesForResolve
      >
    > = [];
    try {
      const { listAgencySkuRulesForResolve } = await import(
        "@/lib/services/agency-medical-sku-rules.service"
      );
      agencyRules = await listAgencySkuRulesForResolve();
    } catch {
      agencyRules = [];
    }

    result = resolveMedicalSku({
      notes: reservation.notes.map((n) => ({
        noteType: n.noteType,
        text: n.text,
      })),
      agencyName,
      guests,
      ratePlanCode: reservation.ratePlan.code,
      agencyRules,
    });

    // Keep prior FO stamp when resolve left a pax null (mid-stay preserve)
    if (reservation.paxGuests.length > 0) {
      result = {
        ...result,
        perGuestCodes: result.perGuestCodes.map((c, i) => {
          if (c != null) return c;
          return normalizeMedicalPackageCode(
            reservation.paxGuests[i]?.medicalPackageCode ?? null,
          );
        }),
      };
      const distinct = [
        ...new Set(
          result.perGuestCodes.filter((c): c is MedicalPackageCode => c != null),
        ),
      ];
      const unanimousCode =
        distinct.length === 1 &&
        result.perGuestCodes.every((c) => c === distinct[0])
          ? distinct[0]
          : null;
      result = {
        ...result,
        unanimousCode,
        unresolved: !unanimousCode,
        reservationCode: unanimousCode,
        stayKind:
          distinct.length > 0
            ? "medical"
            : result.stayKind === "leisure"
              ? "leisure"
              : "unresolved",
      };
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
