import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>ERA Retail POS</h1>
      <p>POS with grocery, apparel, electronics, pharmacy presets</p>
      <ul>
        <li><Link href="/api/health">Health API</Link></li>
        <li><Link href="/pos">Main screen (MVP shell)</Link></li>
      </ul>
    </main>
  );
}
