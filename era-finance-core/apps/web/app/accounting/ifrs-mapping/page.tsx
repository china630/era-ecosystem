import { redirect } from "next/navigation";

export default function LegacyIfrsMappingRedirect() {
  redirect("/accounting/ledger-mappings");
}
