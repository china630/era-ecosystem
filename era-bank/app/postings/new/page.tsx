import { redirect } from "next/navigation";

export default function PostingsNewRedirect() {
  redirect("/postings/queue?modal=create");
}
