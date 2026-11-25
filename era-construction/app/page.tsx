import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS, PageHeader } from "@era/satellite-kit/ui";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-6`}>
        <ul className="space-y-2 text-[13px]">
          <li>
            <Link href="/projects" className={PRIMARY_BUTTON_CLASS}>
              {t("openProjects")}
            </Link>
          </li>
          <li>
            <Link href="/field-ops" className="font-medium text-[#2980B9] hover:underline">
              {t("openFieldOps")}
            </Link>
          </li>
          <li>
            <Link href="/material-requisitions" className="font-medium text-[#2980B9] hover:underline">
              {t("openRequisitions")}
            </Link>
          </li>
          <li>
            <Link href="/api/health" className="font-medium text-[#2980B9] hover:underline">
              {t("health")}
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
