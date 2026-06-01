import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { PageHeader } from "@era/satellite-kit/ui";

export default async function MainScreen() {
  const t = await getTranslations("appointments");
  const tNav = await getTranslations("nav");

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            {tNav("home")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6`}>
        <p className="text-[13px] text-[#7F8C8D]">{t("shellNote")}</p>
      </div>
    </>
  );
}
