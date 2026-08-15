"use strict";
const fs = require("fs");
const f = "prisma/seed-fo-demo.ts";
let s = fs.readFileSync(f, "utf8");

s = s.replace(/expiresAt: addDays\(today, 365 \* 3\)/g, "expiresAt: at(365 * 3)");
s = s.replace(/foundDate: dateOnly\(addDays\(today, -1\)\)/g, "foundDate: yesterdayDate");
s = s.replace(/pickupAt: addDays\(today, 4\)/g, "pickupAt: at(4)");
s = s.replace(
  /const tomorrow = addDays\(today, 1\);\s*tomorrow\.setHours\(10, 0, 0, 0\);/,
  "const tomorrowKey = addHotelDays(todayKey, 1);\n    const tomorrow = new Date(`${tomorrowKey}T10:00:00.000+04:00`);",
);

s = s.replace(
  /stayDate: dateOnly\(addDays\(spec\.checkIn, i\)\)/g,
  "stayDate: dateOnlyKey(addHotelDays(hotelDateKey(spec.checkIn), i))",
);

s = s.replace(/calendarKeyBaku\(s\.checkIn\)/g, "hotelDateKey(s.checkIn)");
s = s.replace(/calendarKeyBaku\(s\.checkOut\)/g, "hotelDateKey(s.checkOut)");
s = s.replace(/calendarKeyBaku\(spec\.checkIn\)/g, "hotelDateKey(spec.checkIn)");
s = s.replace(/calendarKeyBaku\(spec\.checkOut\)/g, "hotelDateKey(spec.checkOut)");

s = s.replace(
  /const nights = nightsBetween\(spec\.checkIn, spec\.checkOut\);/g,
  "const nights = stayNights(spec.checkIn, spec.checkOut);",
);

s = s.replace(
  /actualCheckIn: addDays\(spec\.checkIn, spec\.checkIn < today \? 0 : 0\)/g,
  "actualCheckIn: spec.checkIn",
);

s = s.replace(/checkIn: addDays\(today, (-?\d+)\)/g, "checkIn: ci($1)");
s = s.replace(/checkOut: addDays\(today, (-?\d+)\)/g, "checkOut: co($1)");
s = s.replace(/checkIn: today(?=[,\s])/g, "checkIn: ci(0)");
s = s.replace(/checkOut: today(?=[,\s])/g, "checkOut: co(0)");

fs.writeFileSync(f, s, "utf8");
const left = [...s.matchAll(/\b(dayAt|addDays|dateOnly|calendarKeyBaku|nightsBetween|\btoday\b)\b/g)].map(
  (m) => m[0] + "@" + s.slice(0, m.index).split("\n").length,
);
console.log("patched", f);
console.log("remaining:", left);
