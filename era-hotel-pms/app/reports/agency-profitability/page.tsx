import { redirect } from 'next/navigation';

export default function AgencyProfitabilityRedirect() {
  redirect('/reports?report=agency-profitability');
}
