import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function PostingDetailRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/postings/queue?id=${encodeURIComponent(id)}`);
}
