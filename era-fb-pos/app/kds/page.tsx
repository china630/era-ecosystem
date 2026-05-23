import FbPosNav from "@/components/FbPosNav";
import { CARD_CLASS } from "@/lib/design-system";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function KdsPage() {
  const lines = await prisma.ticketLine.findMany({
    where: { kitchenStatus: { in: ["NEW", "FIRED", "IN_PREP"] } },
    include: { ticket: { include: { table: true, outlet: true } } },
    orderBy: { ticket: { openedAt: "asc" } },
    take: 80,
  });

  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">Kitchen display</h1>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {lines.length === 0 && (
          <p className={`${CARD_CLASS} col-span-full p-4 text-sm text-[#7F8C8D]`}>
            Kitchen queue empty.
          </p>
        )}
        {lines.map((line) => (
          <div key={line.id} className={`${CARD_CLASS} border-l-4 border-[#2980B9] p-4`}>
            <p className="text-xs uppercase text-[#7F8C8D]">
              {line.ticket.table?.code ?? "—"} · {line.ticket.outlet.code}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {line.qty}× {line.description}
            </p>
            <p className="text-sm text-[#2980B9]">{line.kitchenStatus}</p>
            {line.notes && (
              <p className="mt-2 text-xs text-[#7F8C8D]">{line.notes}</p>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
