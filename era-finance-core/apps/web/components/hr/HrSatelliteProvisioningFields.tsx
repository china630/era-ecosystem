"use client";

import { useTranslation } from "react-i18next";
import { MODAL_FIELD_LABEL_CLASS, MODAL_INPUT_CLASS } from "../../lib/design-system";
import {
  PROVISIONED_SATELLITE_OPTIONS,
  PROVISIONED_SATELLITE_ROLES,
} from "../../lib/hr-satellite-provisioning";

export function HrSatelliteProvisioningFields({
  satelliteKey,
  satelliteRole,
  onSatelliteKeyChange,
  onSatelliteRoleChange,
}: {
  satelliteKey: string;
  satelliteRole: string;
  onSatelliteKeyChange: (value: string) => void;
  onSatelliteRoleChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <label className={`${MODAL_FIELD_LABEL_CLASS} md:col-span-2`}>
        {t("employees.provisionedSatelliteKey")}
        <select
          value={satelliteKey}
          onChange={(e) => {
            const next = e.target.value;
            onSatelliteKeyChange(next);
            if (!next) onSatelliteRoleChange("");
          }}
          className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
        >
          {PROVISIONED_SATELLITE_OPTIONS.map((opt) => (
            <option key={opt.value || "none"} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
        <p className="mb-0 mt-1 text-[11px] leading-snug text-[#7F8C8D]">
          {t("employees.provisionedSatelliteKeyHint")}
        </p>
      </label>
      <label className={`${MODAL_FIELD_LABEL_CLASS} md:col-span-2`}>
        {t("employees.provisionedSatelliteRole")}
        <select
          value={satelliteRole}
          onChange={(e) => onSatelliteRoleChange(e.target.value)}
          disabled={!satelliteKey}
          className={`mt-1 block w-full ${MODAL_INPUT_CLASS}`}
        >
          <option value="">{t("employees.provisionedSatelliteRoleAuto")}</option>
          {PROVISIONED_SATELLITE_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <p className="mb-0 mt-1 text-[11px] leading-snug text-[#7F8C8D]">
          {t("employees.provisionedSatelliteRoleHint")}
        </p>
      </label>
    </>
  );
}
