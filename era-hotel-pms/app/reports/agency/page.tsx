import { redirect } from 'next/navigation';

export default function AgencyHubRedirect() {
  redirect('/reports?category=agency');
}
