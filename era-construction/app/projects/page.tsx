import Link from "next/link";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

export default function MainScreen() {
  return (
    <>
      <PageHeader
        title="ERA Construction"
        subtitle="Operational MVP shell — UI follows DESIGN.md. See doc/ for delivery tracker."
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6`}>
        <p className="text-[13px] text-[#7F8C8D]">
          Registry screens and add/edit flows will use modals per DESIGN.md when implemented.
        </p>
      </div>
    </>
  );
}
