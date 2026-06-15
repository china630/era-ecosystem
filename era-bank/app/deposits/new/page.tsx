import { redirect } from "next/navigation";

export default function DepositsNewRedirect() {
  redirect("/deposits?modal=create");
}
