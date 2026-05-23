import FbPosNav from "@/components/FbPosNav";
import { CARD_CLASS } from "@/lib/design-system";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FloorPage() {
  const tables = await prisma.posTable.findMany({
    include: { outlet: true },
    orderBy: { code: "asc" },
  });

  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">Floor map</h1>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {tables.length === 0 && (
          <p className={`${CARD_CLASS} col-span-full p-4 text-sm text-[#7F8C8D]`}>
            No tables yet — seed an outlet or POST /api/tables.
          </p>
        )}
        {tables.map((t) => (
          <div key={t.id} className={`${CARD_CLASS} p-4`}>
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">{t.code}</span>
              <span className="rounded-lg bg-[#EBEDF0] px-2 py-0.5 text-xs">
                {t.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-[#7F8C8D]">{t.outlet.name}</p>
            <p className="text-xs text-[#7F8C8D]">{t.seats} seats</p>
          </div>
        ))}
      </div>
    </>
  );
}
