import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Legacy detail route — opens modal via query on list page. */
export default async function PaymentDetailRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/payments?id=${encodeURIComponent(id)}`);
}
