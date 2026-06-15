import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CARD_CONTAINER_CLASS, PageHeader, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { financeWebUrl } from "@era/satellite-kit";
import { FxPreviewCard } from "@/components/FxPreviewCard";
import { HsPreviewCard } from "@/components/HsPreviewCard";

export default async function CustomsStatusPage() {
  const t = await getTranslations("customs");
  const finance = financeWebUrl();

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <Link href="/trips" className={SECONDARY_BUTTON_CLASS}>
            {t("backTrips")}
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} mt-4 space-y-3 p-4 text-sm text-[#34495E]`}>
        <p>{t("body")}</p>
        {finance ? (
          <Link
            href={`${finance.replace(/\/$/, "")}/customs`}
            className={SECONDARY_BUTTON_CLASS}
          >
            {t("openFinance")}
          </Link>
        ) : (
          <p className="text-[#7F8C8D]">{t("financeUrlHint")}</p>
        )}
        <p className="text-xs text-[#7F8C8D]">{t("uatHint")}</p>
      </div>
      <div className="mt-4 space-y-4">
        <FxPreviewCard />
        <HsPreviewCard />
      </div>
    </div>
  );
}
