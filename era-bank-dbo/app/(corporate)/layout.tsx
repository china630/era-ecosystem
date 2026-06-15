import DboShell from "@/components/DboShell";

export default function CorporateLayout({ children }: { children: React.ReactNode }) {
  return <DboShell channel="CORPORATE">{children}</DboShell>;
}
