import { z } from "zod";

/** Shared envelope fields for all satellite events. */
export const satelliteEventBaseSchema = z.object({
  organizationId: z.string().min(1),
  correlationId: z.string().min(1),
  occurredAt: z.string().min(1),
});

export type SatelliteEventBase = z.infer<typeof satelliteEventBaseSchema>;
