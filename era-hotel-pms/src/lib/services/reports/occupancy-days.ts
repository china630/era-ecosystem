import { Prisma } from '@prisma/client';
import {
  assertTenantRawOrganizationId,
  assertTenantRawSqlMentionsOrg,
} from '@era/satellite-kit/tenancy';
import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';

export type OccupancyDayRow = {
  day: string;
  roomsSold: number;
  revenue: number;
};

export async function queryOccupancyDays(fromIso: string, toIso: string): Promise<OccupancyDayRow[]> {
  const organizationId = assertTenantRawOrganizationId(requestOrganizationId());
  const query = Prisma.sql`
    WITH days AS (
      SELECT generate_series(${fromIso}::date, ${toIso}::date, interval '1 day')::date AS day
    ),
    sold AS (
      SELECT d.day, COUNT(*)::int AS rooms_sold
      FROM days d
      JOIN "Reservation" r
        ON r."organizationId" = ${organizationId}
       AND r.status IN ('CONFIRMED', 'IN_HOUSE', 'CHECKED_OUT')
       AND r."checkInDate"::date <= d.day
       AND r."checkOutDate"::date > d.day
      GROUP BY d.day
    ),
    rev AS (
      SELECT f."businessDate"::date AS day, COALESCE(SUM(f.amount), 0)::float8 AS revenue
      FROM "FolioCharge" f
      WHERE f."organizationId" = ${organizationId}
        AND f."businessDate"::date BETWEEN ${fromIso}::date AND ${toIso}::date
      GROUP BY 1
    )
    SELECT d.day::text AS day,
           COALESCE(s.rooms_sold, 0)::int AS "roomsSold",
           COALESCE(v.revenue, 0)::float8 AS revenue
    FROM days d
    LEFT JOIN sold s ON s.day = d.day
    LEFT JOIN rev v ON v.day = d.day
    ORDER BY d.day
  `;
  assertTenantRawSqlMentionsOrg(query.strings.join(' '));
  const rows = await prisma.$queryRaw<OccupancyDayRow[]>(query);
  return rows.map((row) => ({
    day: String(row.day).slice(0, 10),
    roomsSold: Number(row.roomsSold) || 0,
    revenue: Number(row.revenue) || 0,
  }));
}
