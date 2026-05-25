import { z } from "zod";

export const ssoExchangeBodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  organizationId: z.string().min(1),
  expiresAt: z.number().int(),
  signature: z.string().min(1),
});

export type SsoExchangeBody = z.infer<typeof ssoExchangeBodySchema>;
