import { prisma } from "@/lib/prisma";
import { createJitsiRoomUrl } from "@/integration/telehealth/jitsi";
import { IndustryModuleInactiveError, requireSatelliteModule } from "@era/satellite-kit";

export async function assertTelehealthModule(organizationId: string): Promise<void> {
  await requireSatelliteModule("clinic_telehealth", { organizationId });
}

export async function enableVideoAppointment(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, organizationId: true, status: true, mode: true, videoRoomUrl: true },
  });
  if (!appointment) return { kind: "not_found" as const };
  try {
    await assertTelehealthModule(appointment.organizationId);
  } catch (err) {
    if (err instanceof IndustryModuleInactiveError) {
      return { kind: "module_inactive" as const };
    }
    throw err;
  }
  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
    return { kind: "bad_status" as const, status: appointment.status };
  }
  if (appointment.mode === "VIDEO" && appointment.videoRoomUrl) {
    return { kind: "ok" as const, appointment };
  }
  const room = createJitsiRoomUrl({
    organizationId: appointment.organizationId,
    appointmentId: appointment.id,
  });
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      mode: "VIDEO",
      videoProvider: room.provider,
      videoRoomUrl: room.roomUrl,
    },
  });
  return { kind: "ok" as const, appointment: updated };
}