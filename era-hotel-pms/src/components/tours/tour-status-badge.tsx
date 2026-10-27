'use client';

const DEPARTURE_TONE: Record<string, string> = {
  DRAFT: 'bg-[#EBEDF0] text-[#7F8C8D]',
  OPEN: 'bg-[#D6EAF8] text-[#1A5276]',
  CLOSED: 'bg-[#FCF3CF] text-[#9A7D0A]',
  DEPARTED: 'bg-[#D5F5E3] text-[#196F3D]',
  CANCELLED: 'bg-[#FADBD8] text-[#922B21]',
};

const MONEY_TONE: Record<string, string> = {
  RESERVED: 'bg-[#EBEDF0] text-[#7F8C8D]',
  CHARGED: 'bg-[#FCF3CF] text-[#9A7D0A]',
  PAID: 'bg-[#D5F5E3] text-[#196F3D]',
  ON_CITY_LEDGER: 'bg-[#D6EAF8] text-[#1A5276]',
  CANCELLED: 'bg-[#FADBD8] text-[#922B21]',
};

export function TourDepartureStatusBadge({ status, label }: { status: string; label: string }) {
  const tone = DEPARTURE_TONE[status] ?? 'bg-[#EBEDF0] text-[#34495E]';
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[12px] font-medium ${tone}`}>{label}</span>
  );
}

export function TourMoneyBadge({ status, label }: { status: string; label: string }) {
  const tone = MONEY_TONE[status] ?? 'bg-[#EBEDF0] text-[#34495E]';
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[12px] font-medium ${tone}`}>{label}</span>
  );
}
