const fs = require("fs");
const p =
  "d:/My Projects/era-ecosystem/era-clinic/src/components/PatientCardClinicalSections.tsx";
let s = fs.readFileSync(p, "utf8");

const start = s.indexOf("      {/* legacy planTitle section removed");
const modals = s.indexOf("      {episodeId ? (", start);
if (start < 0 || modals < 0) {
  throw new Error("first markers fail " + start + " " + modals);
}
s = s.slice(0, start) + s.slice(modals);

const proposed = s.indexOf('proposedPlanTitle');
if (proposed < 0) throw new Error("proposed not found");
const secStart = s.lastIndexOf("<section", proposed);
const historyModal = s.indexOf("open={historyOpen}", proposed);
if (historyModal < 0) throw new Error("history not found");
const modalStart = s.lastIndexOf("<ModalShell", historyModal);
s = s.slice(0, secStart) + s.slice(modalStart);

fs.writeFileSync(p, s, "utf8");
console.log("removed hidden sections", s.length);
