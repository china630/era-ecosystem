/**
 * Single ERA lab demo firm — SoT for all satellite/finance demo overlays.
 * Not a sentinel (`demo-org`). Real CP Organization + VÖEN + ERA ID.
 */
export const ERA_LAB_DEMO = {
  taxId: "0123456789",
  publicOrgNumber: 100_000,
  ownerEmail: "owner@demo.com",
  ownerLogin: "owner",
  ownerPassword: "12345678",
  cafeName: "ERA Lab Kafe",
  cashierPin: "1111",
  waiterPin: "2222",
} as const;

export type EraLabDemo = typeof ERA_LAB_DEMO;
