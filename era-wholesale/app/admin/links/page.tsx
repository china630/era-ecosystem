"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  SatelliteAdminLinksPage,
  satelliteAdminLinksLabelsFromT,
} from "@era/satellite-kit/ui";

export default function AdminLinksPage() {
  const t = useTranslations("adminLinks");
  const labels = useMemo(() => satelliteAdminLinksLabelsFromT(t), [t]);
  return <SatelliteAdminLinksPage labels={labels} />;
}
