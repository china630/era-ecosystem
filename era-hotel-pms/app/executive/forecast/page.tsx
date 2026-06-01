import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authCookieName, verifySatelliteSession } from '@era/satellite-kit';
import ForecastDashboard from '@/components/ForecastDashboard';

export default async function ForecastPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName())?.value;
  if (!token) redirect('/login');

  try {
    await verifySatelliteSession(token);
  } catch {
    redirect('/login');
  }

  return (
    <main className="mx-auto min-w-0 w-full p-4 sm:p-6">
      <ForecastDashboard />
    </main>
  );
}
