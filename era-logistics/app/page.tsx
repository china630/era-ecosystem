import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>ERA Logistics</h1>
      <p>Fleet, trips, POD</p>
      <ul>
        <li><Link href="/api/health">Health API</Link></li>
        <li><Link href="/trips">Main screen (MVP shell)</Link></li>
      </ul>
    </main>
  );
}
