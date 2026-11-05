/** F&B WEEK_PERSON cədvəl shift codes (hours on the code). Nafta F&B Cedvel. */

export const FNB_DUTY_TYPE = "WEEK_PERSON" as const;

export const FNB_SHIFT_CODE_SEED: Array<{
  code: string;
  label: string;
  startTime: string | null;
  endTime: string | null;
  sortOrder: number;
}> = [
  { code: "E", label: "E", startTime: "08:00", endTime: "16:00", sortOrder: 10 },
  { code: "A", label: "A", startTime: "09:00", endTime: "17:00", sortOrder: 20 },
  { code: "L", label: "L", startTime: "16:00", endTime: "00:00", sortOrder: 30 },
  { code: "P", label: "P", startTime: "13:00", endTime: "21:00", sortOrder: 40 },
  { code: "N", label: "N", startTime: "00:00", endTime: "08:00", sortOrder: 50 },
  { code: "OFF", label: "Day off", startTime: null, endTime: null, sortOrder: 60 },
  { code: "EG", label: "Əlavə gün (ƏG)", startTime: null, endTime: null, sortOrder: 70 },
  { code: "IB", label: "İctimai bayram (İB)", startTime: null, endTime: null, sortOrder: 80 },
  { code: "B", label: "B (hours TBD)", startTime: null, endTime: null, sortOrder: 90 },
  { code: "C", label: "C (hours TBD)", startTime: null, endTime: null, sortOrder: 91 },
  { code: "C.A", label: "C.A (hours TBD)", startTime: null, endTime: null, sortOrder: 92 },
  { code: "B.E", label: "B.E (hours TBD)", startTime: null, endTime: null, sortOrder: 93 },
  { code: "CH", label: "Ç (hours TBD)", startTime: null, endTime: null, sortOrder: 94 },
  { code: "SH", label: "Ş (hours TBD)", startTime: null, endTime: null, sortOrder: 95 },
  { code: "M", label: "M (hours TBD)", startTime: null, endTime: null, sortOrder: 96 },
  { code: "MOD", label: "MOD (hours TBD)", startTime: null, endTime: null, sortOrder: 97 },
];

export const FNB_ALLOWED_SHIFT_CODES = new Set(
  FNB_SHIFT_CODE_SEED.map((r) => r.code),
);
