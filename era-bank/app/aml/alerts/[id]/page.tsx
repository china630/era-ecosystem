import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AmlAlertDetailRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/aml/alerts?id=${encodeURIComponent(id)}`);
}
