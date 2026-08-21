import { assertFnbEntitled } from "@/lib/api-utils";
import { z } from "zod";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

export async function GET() {
  await assertFnbEntitled();
  const roster = await prisma.staffRoster.findMany({
    where: { active: true },
    select: { id: true, staffCode: true, fullName: true, globalPersonId: true },
  });
  return NextResponse.json({ roster });
}

const bodySchema = z.object({
  staffCode: z.string(),
  fullName: z.string(),
  pin: z.string().min(4).max(8),
  globalPersonId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  await assertFnbEntitled();
  const body = bodySchema.parse(await req.json());
  if (!body.globalPersonId) {
    return NextResponse.json(
      {
        error:
          "Manual roster create requires globalPersonId from Finance HR STAFF_PROVISIONED",
      },
      { status: 422 },
    );
  }
  const row = await prisma.staffRoster.upsert({
    where: { staffCode: body.staffCode } as never,
    create: {
      staffCode: body.staffCode,
      fullName: body.fullName,
      pinHash: hashPin(body.pin),
      globalPersonId: body.globalPersonId,
    },
    update: {
      fullName: body.fullName,
      pinHash: hashPin(body.pin),
      globalPersonId: body.globalPersonId,
      active: true,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
