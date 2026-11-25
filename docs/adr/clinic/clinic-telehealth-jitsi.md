# Clinic telehealth — Jitsi rooms (MED-P1-02)

## Status

Accepted — scaffold 2026-11-25 (Jitsi URL only).

## Context

Video visits need a room URL on the appointment without embedding a full WebRTC stack in the satellite.

## Decision

- `POST /api/appointments/:id/telehealth` sets `Appointment.mode=VIDEO` and `videoRoomUrl` via `JITSI_BASE_URL` (default public `meet.jit.si`).
- Staff join from `/doctor`; patients/guests use public `/telehealth?room=` (middleware allowlist).
- Daily/Zoom org keys and room expiry jobs stay deferred.

## Consequences

- `clinic_telehealth` module gate still applies on enable.
- No recording, waiting room, or identity binding in this wave.

## Related

- [02-remediation-backlog.md](./02-remediation-backlog.md) MED-P1-02
- COVERAGE `CLI-TELEHEALTH-01`
