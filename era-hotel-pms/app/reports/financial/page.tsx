import { redirect } from 'next/navigation';

export default function FinancialHubRedirect() {
  redirect('/reports?category=financial');
}
