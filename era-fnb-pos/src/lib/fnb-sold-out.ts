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

/** Stop-list table/column not migrated yet — do not block the till. */
export function isSoldOutSchemaDrift(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = "code" in err ? String((err as { code: unknown }).code) : "";
  if (code === "P2021" || code === "P2022") return true;
  const message = err instanceof Error ? err.message : "";
  return message.includes("menu_item_sold_out") && message.includes("does not exist");
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
  let stop: { soldOut: boolean } | null = null;
  try {
    stop = await prisma.menuItemSoldOut.findFirst({
      where: {
        organizationId: requestOrganizationId(),
        menuItemId,
        outletId: input.outletId,
        soldOut: true,
      },
    });
  } catch (err) {
    if (isSoldOutSchemaDrift(err)) return;
    throw err;
  }
  if (stop) throw new FnbSoldOutError(input.plu);
}
