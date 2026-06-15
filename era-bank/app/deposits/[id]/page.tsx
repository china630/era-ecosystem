import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function DepositDetailRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/deposits?id=${encodeURIComponent(id)}`);
}
