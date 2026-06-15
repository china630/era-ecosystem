import { redirect } from "next/navigation";

export default function CifNewRedirect() {
  redirect("/cif?modal=create");
}
