import type { ImportTx } from "@/lib/import/types";
import { bindImportRecord, findImportRecordId } from "@/lib/import/keys";
import { requestOrganizationId } from "@/lib/request-organization";
import { CUTOVER_EPISODE_OPEN } from "@/lib/import/cutover-episode-status";

export const CUTOVER_ATTENDING_VISIT_ENTITY = "attending-visits";

/** WO doctorId → #27 externalRef. Empty / 0 means no attending doctor. */
export function attendingDoctorExternalRef(doctorId: string): string | null {
  const raw = doctorId.trim();
  if (!raw) return null;
  const id = raw.replace(/\.0$/, "");
  if (!id || id === "0") return null;
  const n = Number(id);
  if (Number.isFinite(n) && n <= 0) return null;
  return `wo:doctor:${id}`;
}

export function attendingVisitExternalRef(patientExternalRef: string): string {
  return `${patientExternalRef}:attending`;
}

/**
 * Reception assigns the episode doctor via the first Visit.
 * Cutover: one visit on check-in (idempotent). No Appointment (calendar stays clean).
 * OPEN episode → IN_PROGRESS; archive → COMPLETED. Missing #27 row → skip.
 */
export async function ensureCutoverAttendingVisit(
  tx: ImportTx,
  input: {
    patientRefId: string;
    patientExternalRef: string;
    doctorId: string;
    checkIn: Date | null;
    episodeStatus: string;
    closedAt: Date | null;
    roomNumber: string | null;
    reservationId: string | null;
    patientOrigin: "IN_HOUSE" | "WALK_IN";
    clinicalEpisodeId?: string | null;
  },
): Promise<string | null> {
  const doctorRef = attendingDoctorExternalRef(input.doctorId);
  if (!doctorRef) return null;
  const practitionerId = await findImportRecordId(tx, "practitioners", doctorRef);
  if (!practitionerId) return null;

  const open = input.episodeStatus === CUTOVER_EPISODE_OPEN;
  const at = input.checkIn ?? new Date();
  const visitKey = attendingVisitExternalRef(input.patientExternalRef);
  const data = {
    practitionerId,
    status: open ? ("IN_PROGRESS" as const) : ("COMPLETED" as const),
    patientOrigin: input.patientOrigin,
    reservationId: input.reservationId,
    roomNumber: input.roomNumber,
    clinicalEpisodeId: input.clinicalEpisodeId ?? undefined,
    completedAt: open ? null : (input.closedAt ?? at),
  };

  const existingId = await findImportRecordId(tx, CUTOVER_ATTENDING_VISIT_ENTITY, visitKey);
  if (existingId) {
    await tx.visit.update({
      where: { id: existingId },
      data,
    });
    return existingId;
  }

  const created = await tx.visit.create({
    data: {
      organizationId: requestOrganizationId(),
      patientRefId: input.patientRefId,
      amountNet: 0,
      createdAt: at,
      ...data,
    },
  });
  await bindImportRecord(tx, CUTOVER_ATTENDING_VISIT_ENTITY, visitKey, created.id, false);
  return created.id;
}
