export type ValidateEntitlementRequest = {
  organizationId: string;
  userId?: string;
  method: string;
  path: string;
  /**
   * @deprecated SEC-CP-01 — ignored by EntitlementsService; resolve from userId/DB.
   */
  isSuperAdmin?: boolean;
};

export type ValidateEntitlementResponse = {
  allowed: boolean;
  billingStatus: "ACTIVE" | "SOFT_BLOCK" | "HARD_BLOCK";
  code?: string;
  message?: string;
  httpStatus?: number;
};
