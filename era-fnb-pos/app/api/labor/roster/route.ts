import { z } from "zod";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

export async function GET() {
  const roster = await prisma.staffRoster.findMany({
    where: { active: true },
    select: { id: true, staffCode: true, fullName: true },
  });
  return NextResponse.json({ roster });
}

const bodySchema = z.object({
  staffCode: z.string(),
  fullName: z.string(),
  pin: z.string().min(4).max(8),
});

export async function POST(req: Request) {
  const body = bodySchema.parse(await req.json());
  const row = await prisma.staffRoster.upsert({
    where: { staffCode: body.staffCode },
    create: {
      staffCode: body.staffCode,
      fullName: body.fullName,
      pinHash: hashPin(body.pin),
    },
    update: {
      fullName: body.fullName,
      pinHash: hashPin(body.pin),
      active: true,
    },
  });
  return NextResponse.json(row, { status: 201 });
}
