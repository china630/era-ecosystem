import { redirect } from 'next/navigation';

export default function DailyHubRedirect() {
  redirect('/reports?category=daily');
}
