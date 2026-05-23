import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>ERA Clinic</h1>
      <p>Appointments, visits, services</p>
      <ul>
        <li><Link href="/api/health">Health API</Link></li>
        <li><Link href="/appointments">Main screen (MVP shell)</Link></li>
      </ul>
    </main>
  );
}
