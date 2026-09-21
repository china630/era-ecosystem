import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

export class FnbSoldOutError extends Error {
  readonly status = 409;
  readonly code = "SOLD_OUT";
  constructor(public readonly plu?: string) {
    super("Item is sold out (bitdi)");
    this.name = "FnbSoldOutError";
  }
}

export async function assertMenuItemNotSoldOut(input: {
  outletId: string;
  menuItemId?: string | null;
  plu?: string;
}): Promise<void> {
  let menuItemId = input.menuItemId ?? undefined;
  if (!menuItemId && input.plu) {
    const item = await prisma.menuItem.findFirst({ where: { plu: input.plu } });
    menuItemId = item?.id;
  }
  if (!menuItemId) return;
  const stop = await prisma.menuItemSoldOut.findFirst({
    where: {
      organizationId: requestOrganizationId(),
      menuItemId,
      outletId: input.outletId,
      soldOut: true,
    },
  });
  if (stop) throw new FnbSoldOutError(input.plu);
}
