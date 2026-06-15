import { redirect } from "next/navigation";

export default function LoansNewRedirect() {
  redirect("/loans?modal=create");
}
