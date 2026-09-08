import { redirect } from "next/navigation";

export default function LegacyAccountMappingRedirect() {
  redirect("/accounting/ledger-mappings");
}
