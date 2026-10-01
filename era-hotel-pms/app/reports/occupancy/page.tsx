import { redirect } from 'next/navigation';

export default function OccupancyHubRedirect() {
  redirect('/reports?category=occupancy');
}
