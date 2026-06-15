import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function CifDetailRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/cif?id=${encodeURIComponent(id)}`);
}
