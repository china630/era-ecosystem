import { prisma } from "@/lib/prisma";

const DEMO = [
  { code: "CONSULT", description: "Consultation", amount: 50 },
  { code: "LAB-CBC", description: "Complete blood count", amount: 25 },
  { code: "LAB-GLU", description: "Glucose test", amount: 15 },
  { code: "US-ABD", description: "Abdominal ultrasound", amount: 80 },
];

export async function ensureServiceCatalogSeeded() {
  const count = await prisma.serviceCatalogCache.count();
  if (count > 0) return;
  await prisma.serviceCatalogCache.createMany({
    data: DEMO.map((s) => ({
      code: s.code,
      description: s.description,
      amount: s.amount,
    })),
    skipDuplicates: true,
  });
}
