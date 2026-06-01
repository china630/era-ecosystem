import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tables = await prisma.posTable.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, status: true },
  });
  return NextResponse.json(tables);
}

const createSchema = z.object({
  outletCode: z.string().default("RESTAURANT"),
  code: z.string().min(1),
  name: z.string().min(1),
  seats: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const body = createSchema.parse(await request.json());
  let outlet = await prisma.outlet.findUnique({
    where: { code: body.outletCode },
  });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        code: body.outletCode,
        name: body.outletCode,
      },
    });
  }
  const table = await prisma.posTable.create({
    data: {
      outletId: outlet.id,
      code: body.code,
      name: body.name,
      seats: body.seats ?? 4,
    },
  });
  return NextResponse.json(table, { status: 201 });
}
