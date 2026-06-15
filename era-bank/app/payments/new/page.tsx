import { redirect } from "next/navigation";

export default function PaymentsNewRedirect() {
  redirect("/payments?modal=create");
}
