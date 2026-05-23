import FbPosNav from "@/components/FbPosNav";
import { CARD_CLASS } from "@/lib/design-system";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const tickets = await prisma.ticket.findMany({
    where: { status: { in: ["OPEN", "HELD"] } },
    include: { table: true, outlet: true, lines: true },
    orderBy: { openedAt: "desc" },
    take: 50,
  });

  return (
    <>
      <FbPosNav />
      <h1 className="mb-4 text-xl font-semibold">Active orders</h1>
      <div className="space-y-3">
        {tickets.length === 0 && (
          <p className={`${CARD_CLASS} p-4 text-sm text-[#7F8C8D]`}>
            No open tickets.
          </p>
        )}
        {tickets.map((ticket) => (
          <div key={ticket.id} className={`${CARD_CLASS} p-4`}>
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {ticket.table?.code ?? "Walk-in"} · {ticket.outlet.code}
              </span>
              <span>{ticket.status}</span>
            </div>
            <p className="mt-1 text-lg font-semibold">
              {Number(ticket.totalAzn).toFixed(2)} AZN
            </p>
            <ul className="mt-2 text-xs text-[#7F8C8D]">
              {ticket.lines.map((l) => (
                <li key={l.id}>
                  {l.qty}× {l.description} ({l.kitchenStatus})
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
