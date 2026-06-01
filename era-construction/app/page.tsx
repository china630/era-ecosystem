import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS, PageHeader } from "@era/satellite-kit/ui";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-6`}>
        <p className="text-[13px] text-[#7F8C8D]">MVP operational shell aligned with DESIGN.md.</p>
<ul className="space-y-2 text-[13px]">
          <li>
            <Link href="/api/health" className="font-medium text-[#2980B9] hover:underline">
              Health API
            </Link>
          </li>
          <li>
            <Link href="/projects" className={PRIMARY_BUTTON_CLASS}>
              Open main screen
            </Link>
          </li>
          <li>
            <Link href="/field-ops" className="font-medium text-[#2980B9] hover:underline">
              Field ops (W2)
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
