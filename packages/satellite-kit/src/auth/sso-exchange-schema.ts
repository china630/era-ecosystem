import { z } from "zod";

export const ssoExchangeBodySchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  organizationId: z.string().min(1),
  expiresAt: z.number().int(),
  signature: z.string().min(1),
  /** Optional Finance membership role from control plane (OWNER, DIRECTOR, …). */
  financeRole: z.string().optional(),
  /** SEC-SSO-01: one-time ticket id when minted with HMAC v3. */
  jti: z.string().min(8).max(128).optional(),
});

export type SsoExchangeBody = z.infer<typeof ssoExchangeBodySchema>;
