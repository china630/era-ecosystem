import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>ERA Auto STO</h1>
      <p>Work orders, labor, parts</p>
      <ul>
        <li><Link href="/api/health">Health API</Link></li>
        <li><Link href="/work-orders">Main screen (MVP shell)</Link></li>
      </ul>
    </main>
  );
}
