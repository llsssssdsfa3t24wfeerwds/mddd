/**
 * يدمج data/uqu-major-admission.json في حقول كل major داخل registry-bundle.js
 */
import fs from "fs";

const adm = JSON.parse(fs.readFileSync("data/uqu-major-admission.json", "utf8"));
const scraped = JSON.parse(fs.readFileSync("data/uqu-admission-gpa.json", "utf8"));
let reg = fs.readFileSync("data/registry-bundle.js", "utf8");

const metaNote =
  "minGpa مرجعي (مقياس 5) من شروط القبول/فئة البرنامج؛ القبول عبر تميّز بالنسبة الموزونة.";
if (!reg.includes("gpaAdmissionNote")) {
  reg = reg.replace(
    /(uquCoursesNote:[\s\S]*?",\n)/,
    `$1    gpaAdmissionNote: ${JSON.stringify(metaNote)},\n`
  );
}

for (const [majId, row] of Object.entries(adm)) {
  if (majId.startsWith("_")) continue;
  const majorChunk = reg.match(new RegExp(`id: "${majId}"[\\s\\S]*?salarySarMonthly`));
  if (!majorChunk) {
    console.warn("missing", majId);
    continue;
  }
  const uquId = majorChunk[0].match(/uquDegreeId: "(\d+)"/)?.[1];
  const pageText = uquId && scraped[uquId]?.admissionText ? scraped[uquId].admissionText : "";
  const note = pageText || row.uquAdmissionNote || "";
  const block = [
    `minGpa: ${row.minGpa}`,
    `weightedCategory: "${row.weightedCategory}"`,
    `uquAdmissionNote: ${JSON.stringify(note)}`,
  ].join(",\n      ");

  if (majorChunk[0].includes("minGpa:")) {
    reg = reg.replace(
      new RegExp(`(id: "${majId}"[\\s\\S]*?)minGpa:[^\\n]+\\n\\s*weightedCategory:[^\\n]+\\n\\s*uquAdmissionNote:[^\\n]+`),
      `$1${block.replace(/\n/g, "\n      ")}`
    );
  } else {
    reg = reg.replace(
      new RegExp(`(id: "${majId}"[\\s\\S]*?uquProgramTitle:[^\\n]+\\n)`),
      `$1      ${block},\n`
    );
  }
  console.log("ok", majId);
}

fs.writeFileSync("data/registry-bundle.js", reg, "utf8");
console.log("done");
