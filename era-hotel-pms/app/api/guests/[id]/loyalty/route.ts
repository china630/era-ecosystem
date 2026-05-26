import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const tier = String(body.loyaltyTier ?? "STANDARD");
  const guest = await prisma.guest.update({
    where: { id },
    data: { loyaltyTier: tier },
  });
  return NextResponse.json({
    guest,
    platformLoyaltyStub: { tier, guestId: guest.id },
  });
}
