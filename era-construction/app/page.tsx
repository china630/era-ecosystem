import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>ERA Construction</h1>
      <p>Sites, BOQ, progress acts</p>
      <ul>
        <li><Link href="/api/health">Health API</Link></li>
        <li><Link href="/projects">Main screen (MVP shell)</Link></li>
      </ul>
    </main>
  );
}
