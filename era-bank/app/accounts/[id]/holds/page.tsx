import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AccountHoldsRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/accounts?id=${encodeURIComponent(id)}`);
}
