export type ValidateEntitlementRequest = {
  organizationId: string;
  userId?: string;
  method: string;
  path: string;
  isSuperAdmin?: boolean;
};

export type ValidateEntitlementResponse = {
  allowed: boolean;
  billingStatus: "ACTIVE" | "SOFT_BLOCK" | "HARD_BLOCK";
  code?: string;
  message?: string;
  httpStatus?: number;
};
