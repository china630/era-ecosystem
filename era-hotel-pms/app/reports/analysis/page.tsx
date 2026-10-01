import { redirect } from 'next/navigation';

export default function AnalysisHubRedirect() {
  redirect('/reports?category=analysis');
}
