import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function LoanDetailRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/loans?id=${encodeURIComponent(id)}`);
}
