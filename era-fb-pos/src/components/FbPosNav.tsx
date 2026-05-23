"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/floor", label: "Floor" },
  { href: "/orders", label: "Orders" },
  { href: "/kds", label: "KDS" },
  { href: "/calendar", label: "Reservations" },
];

export default function FbPosNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-4 border-b border-[#D5DADF] pb-4 text-sm">
      <span className="font-semibold text-[#34495E]">ERA F&B POS</span>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={
            pathname === l.href
              ? "font-medium text-[#2980B9]"
              : "text-[#7F8C8D] hover:text-[#2980B9]"
          }
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
