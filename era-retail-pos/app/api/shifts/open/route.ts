import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  outletCode: z.string().default("MAIN"),
  registerCode: z.string().default("R1"),
  preset: z.enum(["grocery", "apparel", "electronics", "pharmacy"]).optional(),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());

    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { code: "demo", name: "Demo Tenant" },
      });
    }

    let outlet = await prisma.outlet.findFirst({
      where: { tenantId: tenant.id, code: body.outletCode },
    });
    if (!outlet) {
      outlet = await prisma.outlet.create({
        data: {
          tenantId: tenant.id,
          code: body.outletCode,
          name: body.outletCode,
          preset: body.preset ?? "grocery",
        },
      });
    }

    let register = await prisma.register.findFirst({
      where: { outletId: outlet.id, code: body.registerCode },
    });
    if (!register) {
      register = await prisma.register.create({
        data: {
          outletId: outlet.id,
          code: body.registerCode,
          name: `Register ${body.registerCode}`,
        },
      });
    }

    const existing = await prisma.shift.findFirst({
      where: { registerId: register.id, status: "OPEN" },
    });
    if (existing) {
      return jsonOk(existing);
    }

    const shift = await prisma.shift.create({
      data: { registerId: register.id },
    });
    return jsonOk(shift, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
