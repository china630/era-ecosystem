import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>ERA Wholesale</h1>
      <p>B2B orders, credit limits, picking</p>
      <ul>
        <li><Link href="/api/health">Health API</Link></li>
        <li><Link href="/orders">Main screen (MVP shell)</Link></li>
      </ul>
    </main>
  );
}
