import { redirect } from 'next/navigation';

export default async function CubesRedirect({
  searchParams,
}: {
  searchParams: Promise<{ cube?: string }>;
}) {
  const { cube } = await searchParams;
  const slug = cube && cube.endsWith('-cube') ? cube : 'revenue-cube';
  redirect(`/reports?report=${encodeURIComponent(slug)}`);
}
