import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authCookieName, verifySatelliteSession } from '@era/satellite-kit';
import ExecutiveClient from './ExecutiveClient';

export default async function ExecutivePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName())?.value;
  if (!token) redirect('/login');

  let session;
  try {
    session = await verifySatelliteSession(token);
  } catch {
    redirect('/login');
  }

  return (
    <main className="mx-auto min-w-0 w-full p-4 sm:p-6">
      <ExecutiveClient />
    </main>
  );
}
