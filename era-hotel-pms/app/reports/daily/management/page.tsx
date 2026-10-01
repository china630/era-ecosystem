import { redirect } from 'next/navigation';

export default function DailyManagementRedirect() {
  redirect('/reports?report=daily-management');
}
