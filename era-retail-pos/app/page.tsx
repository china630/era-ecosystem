import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CARD_CONTAINER_CLASS, PageHeader, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-6`}>
        <p className="text-[13px] text-[#7F8C8D]">{t("intro")}</p>
        <ul className="space-y-2 text-[13px]">
          <li>
            <Link href="/api/health" className="font-medium text-[#2980B9] hover:underline">
              {t("healthLink")}
            </Link>
          </li>
          <li>
            <Link href="/pos" className={PRIMARY_BUTTON_CLASS}>
              {t("openPos")}
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
