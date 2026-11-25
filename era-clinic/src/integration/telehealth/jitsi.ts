/**
 * Stub Jitsi self-hosted room URL adapter (MED-P1-02).
 * Production should point JITSI_BASE_URL at the org deployment.
 */

const JITSI_BASE = (process.env.JITSI_BASE_URL ?? "https://meet.jit.si").replace(/\/$/, "");

export type TelehealthRoom = {
  provider: "jitsi";
  roomUrl: string;
  roomName: string;
};

export function createJitsiRoomUrl(input: {
  organizationId: string;
  appointmentId: string;
}): TelehealthRoom {
  const roomName = `era-clinic-${input.organizationId.slice(0, 8)}-${input.appointmentId}`;
  const roomUrl = `${JITSI_BASE}/${encodeURIComponent(roomName)}`;
  return { provider: "jitsi", roomUrl, roomName };
}