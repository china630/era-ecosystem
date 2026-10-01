import { redirect } from 'next/navigation';

export default function BookingHubRedirect() {
  redirect('/reports?category=booking');
}
