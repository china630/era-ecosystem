import { prisma } from '@/lib/prisma';
import { getOccupancyGrid } from '@/lib/services/occupancy.service';

export type ForecastDay = {
  date: string;
  roomsTotal: number;
  roomsSold: number;
  roomsAvailable: number;
  occupancyPct: number;
};

export type OccupancyForecast = {
  from: string;
  days: number;
  daily: ForecastDay[];
  summary: {
    avgOccupancyPct: number;
    peakOccupancyPct: number;
    peakDate: string | null;
  };
};

export async function getOccupancyForecast(days: number): Promise<OccupancyForecast> {
  const allowed = [7, 14, 30, 90] as const;
  const horizon = allowed.includes(days as (typeof allowed)[number]) ? days : 30;

  const grid = await getOccupancyGrid({ from: new Date(), days: horizon });

  const roomsFromInventory = await prisma.room.count({
    where: { status: { notIn: ['OOO', 'OOS'] } },
  });

  const daily: ForecastDay[] = grid.dates.map((date) => {
    let sold = 0;
    let quota = 0;
    for (const row of grid.rows) {
      const cell = row.cells.find((c) => c.date === date);
      if (cell) {
        sold += cell.sold;
        quota += cell.total;
      }
    }
    const roomsTotal = quota > 0 ? quota : roomsFromInventory;
    const roomsSold = Math.min(sold, roomsTotal);
    const roomsAvailable = Math.max(0, roomsTotal - roomsSold);
    const occupancyPct =
      roomsTotal > 0 ? Math.round((roomsSold / roomsTotal) * 1000) / 10 : 0;
    return { date, roomsTotal, roomsSold, roomsAvailable, occupancyPct };
  });

  const pcts = daily.map((d) => d.occupancyPct);
  const avgOccupancyPct =
    pcts.length > 0 ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : 0;
  let peakOccupancyPct = 0;
  let peakDate: string | null = null;
  for (const d of daily) {
    if (d.occupancyPct >= peakOccupancyPct) {
      peakOccupancyPct = d.occupancyPct;
      peakDate = d.date;
    }
  }

  return {
    from: grid.from,
    days: horizon,
    daily,
    summary: { avgOccupancyPct, peakOccupancyPct, peakDate },
  };
}
