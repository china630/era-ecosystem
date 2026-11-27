import type { Prisma } from "@prisma/client";

/**
 * ProcedureOrder rows that hold a guest Baku day for same_day / seating.
 * Unseated unpaid extras (PENDING_PAY without cabin) and mid-seat PROPOSED
 * extras count the same way package PROPOSED already did — otherwise a second
 * Save stacks placeholders on today.
 */
export function guestDayOccupancyStatusOr(): Prisma.ProcedureOrderWhereInput[] {
  return [
    {
      status: {
        notIn: ["CANCELLED", "PROPOSED", "PENDING_PAY", "UNPAID_MISSED"],
      },
    },
    { status: "PENDING_PAY" },
    { status: "PROPOSED" },
  ];
}
