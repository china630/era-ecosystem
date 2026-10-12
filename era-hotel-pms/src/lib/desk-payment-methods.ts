/** Front-desk accept-payment order. Transfer and loyalty stay under the six desk tenders. */
export const DESK_PAYMENT_METHODS = [
  'CASH',
  'CARD',
  'EPOINT',
  'DEPOSIT',
  'CL_AGENCY',
  'CL_COMPANY',
  'BANK_TRANSFER',
  'LOYALTY_POINTS',
] as const;

export type DeskPaymentMethod = (typeof DESK_PAYMENT_METHODS)[number];
