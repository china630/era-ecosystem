import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";
import HomeTasksPanel from "@/components/HomeTasksPanel";

export default async function HomePage() {
  const t = await getTranslations("home");
  const th = await getTranslations("homeTasks");

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <p className="text-[13px] text-[#7F8C8D]">{th("intro")}</p>
      <HomeTasksPanel />
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="font-medium text-[#2C3E50]">{th("quickLinks")}</h2>
        <ul className="flex flex-wrap gap-2 text-[13px]">
          <li>
            <Link href="/leads" className={PRIMARY_BUTTON_CLASS}>
              {th("pipeline")}
            </Link>
          </li>
          <li>
            <Link href="/visits" className={PRIMARY_BUTTON_CLASS}>
              {th("visits")}
            </Link>
          </li>
          <li>
            <Link href="/inbox" className={PRIMARY_BUTTON_CLASS}>
              {th("inbox")}
            </Link>
          </li>
          <li>
            <Link href="/reports" className={PRIMARY_BUTTON_CLASS}>
              {th("reports")}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
