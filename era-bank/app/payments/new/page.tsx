import { redirect } from "next/navigation";

/** Legacy route — payment create is modal-only on /payments. */
export default function PaymentsNewRedirect() {
  redirect("/payments");
}
