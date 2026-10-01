import { redirect } from 'next/navigation';

export default async function ReportSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/reports?report=${encodeURIComponent(slug)}`);
}
