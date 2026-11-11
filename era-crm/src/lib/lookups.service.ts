import { prisma } from "@/lib/prisma";
import type { CrmLookupKind, Prisma } from "@prisma/client";

export async function listCrmLookups(opts: {
  kind?: CrmLookupKind;
  activeOnly: boolean;
}) {
  return prisma.crmLookup.findMany({
    where: {
      ...(opts.kind ? { kind: opts.kind } : {}),
      ...(opts.activeOnly ? { active: true } : {}),
    },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function createCrmLookup(data: {
  kind: CrmLookupKind;
  code: string;
  name: string;
  sortOrder: number;
}) {
  return prisma.crmLookup.create({
    data: {
      kind: data.kind,
      code: data.code.trim(),
      name: data.name.trim(),
      sortOrder: data.sortOrder,
    },
  });
}

export async function updateCrmLookup(
  id: string,
  data: Prisma.CrmLookupUpdateInput,
) {
  return prisma.crmLookup.update({ where: { id }, data });
}
