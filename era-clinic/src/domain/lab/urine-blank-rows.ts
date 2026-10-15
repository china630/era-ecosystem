/** Nafta urine blank rows. Norms are the blank's reference, not a second catalog. */
export const URINE_BLANK_ROWS: Array<{
  code: string;
  label: string;
  sortOrder: number;
  section: string;
  refMin?: string;
  refMax?: string;
  unit?: string;
}> = [
  { code: "U-VOL", label: "Miqdarı", sortOrder: 1, section: "Fiziki-kimyəvi göstəricilər" },
  { code: "U-COLOR", label: "Rəngi", sortOrder: 2, section: "Fiziki-kimyəvi göstəricilər", refMin: "Açıq sarı" },
  { code: "U-CLARITY", label: "Şəffaflığı", sortOrder: 3, section: "Fiziki-kimyəvi göstəricilər", refMin: "Şəffaf" },
  { code: "U-SG", label: "Xüsusi çəki", sortOrder: 4, section: "Fiziki-kimyəvi göstəricilər", refMin: "1010", refMax: "1030" },
  { code: "U-PH", label: "PH", sortOrder: 5, section: "Fiziki-kimyəvi göstəricilər", refMin: "6.0", refMax: "7.4" },
  { code: "U-PRO", label: "Protein", sortOrder: 6, section: "Fiziki-kimyəvi göstəricilər", refMin: "0.0", refMax: "0.33", unit: "g/l" },
  { code: "U-GLU", label: "Qlükoza", sortOrder: 7, section: "Fiziki-kimyəvi göstəricilər" },
  { code: "U-KET", label: "Keton", sortOrder: 8, section: "Fiziki-kimyəvi göstəricilər", refMin: "Neqativ" },
  { code: "U-NIT", label: "Nitrit", sortOrder: 9, section: "Fiziki-kimyəvi göstəricilər", refMin: "Neqativ" },
  { code: "U-BIL", label: "Bilirubin", sortOrder: 10, section: "Fiziki-kimyəvi göstəricilər", refMin: "Neqativ" },
  { code: "U-URO", label: "Urobilinoqen", sortOrder: 11, section: "Fiziki-kimyəvi göstəricilər", refMin: "Neqativ" },
  { code: "U-WBC", label: "Leykositlər", sortOrder: 12, section: "Mikroskopiya", refMin: "0", refMax: "5", unit: "g/s" },
  { code: "U-RBC-FRESH", label: "Eritrositlər dəyişməmiş", sortOrder: 13, section: "Mikroskopiya", refMin: "0", refMax: "5", unit: "g/s" },
  { code: "U-RBC-DYSM", label: "Eritrositlər dəyişmiş", sortOrder: 14, section: "Mikroskopiya", refMin: "0", refMax: "0", unit: "g/s" },
  { code: "U-EPI-SQ", label: "Epitel yastı", sortOrder: 15, section: "Mikroskopiya", refMin: "0", refMax: "5", unit: "g/s" },
  { code: "U-MUCUS", label: "Selik", sortOrder: 16, section: "Mikroskopiya", refMin: "Yoxdur" },
  { code: "U-YEAST", label: "Göbələk", sortOrder: 17, section: "Mikroskopiya", refMin: "Yoxdur" },
  { code: "U-BACT", label: "Bakteriyalar", sortOrder: 18, section: "Mikroskopiya", refMin: "Yoxdur" },
  { code: "U-SALT", label: "Duzlar", sortOrder: 19, section: "Mikroskopiya", refMin: "Yoxdur" },
];

export const URINE_BLANK_PROFILE_NAME = "Sidiyin ümumi analizi";
