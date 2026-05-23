import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>ERA CRM Field</h1>
      <p>Leads, visits, WhatsApp pre-sale (not Finance counterparty MDM)</p>
      <ul>
        <li><Link href="/api/health">Health API</Link></li>
        <li><Link href="/leads">Main screen (MVP shell)</Link></li>
      </ul>
    </main>
  );
}
