/**
 * يحدّث registry-bundle.js من data/uqu-majors-built.json
 */
import fs from "fs";

const built = JSON.parse(fs.readFileSync("data/uqu-majors-built.json", "utf8"));
let reg = fs.readFileSync("data/registry-bundle.js", "utf8");

const majFit = {
  MAJ_MED: "FP_MED",
  MAJ_DEN: "FP_DEN",
  MAJ_PHR: "FP_PHR",
  MAJ_NUR: "FP_NUR",
  MAJ_MLS: "FP_MLS",
  MAJ_PHE: "FP_PHE",
  MAJ_CIV: "FP_CIV",
  MAJ_ELE: "FP_ELE",
  MAJ_MECH: "FP_MECH",
  MAJ_ARC: "FP_ARC",
  MAJ_CS: "FP_CS",
  MAJ_IS: "FP_IS",
  MAJ_BUS: "FP_BUS",
  MAJ_ACC: "FP_ACC",
  MAJ_ECO: "FP_ECO",
  MAJ_LAW: "FP_LAW",
  MAJ_SHR: "FP_SHR",
  MAJ_USL: "FP_USL",
  MAJ_ARB: "FP_ARB",
  MAJ_EDU: "FP_EDU",
  MAJ_SCI: "FP_SCI",
  MAJ_SOC: "FP_SOC",
  MAJ_DES: "FP_DES",
};

const newProfiles = {};
for (const [maj, fp] of Object.entries(majFit)) {
  const b = built[maj];
  if (!b || b.error || !b.axisWeights) {
    console.warn("skip profile", maj);
    continue;
  }
  newProfiles[fp] = b.axisWeights;
}

const profilesBlock =
  "  fitProfiles: " +
  JSON.stringify(newProfiles, null, 2).replace(/\n/g, "\n  ").replace(/^  /, "") +
  ",\n";

reg = reg.replace(/  fitProfiles:\s*\{[\s\S]*?\n  \},\n  tracks:/, profilesBlock + "  tracks:");

for (const [maj, fp] of Object.entries(majFit)) {
  const b = built[maj];
  if (!b || b.error) continue;

  const samples = JSON.stringify(b.sampleCourses, null, 2).replace(/\n/g, "\n      ");
  reg = reg.replace(
    new RegExp(`(id: "${maj}"[\\s\\S]*?sampleCourses: )\\[[^\\]]*\\]`),
    `$1${samples.slice(samples.indexOf("["))}`
  );

  const uquFields = [
    `uquDegreeId: "${b.uquDegreeId}"`,
    `uquUrl: "https://uqu.edu.sa/App/Degrees/${b.uquDegreeId}"`,
    `uquProgramTitle: ${JSON.stringify(b.uquProgramTitle)}`,
  ].join(",\n      ");

  if (reg.includes(`id: "${maj}"`) && !reg.includes(`id: "${maj}"` + "")) {
    /* noop */
  }
  if (!reg.match(new RegExp(`id: "${maj}"[\\s\\S]*?uquDegreeId`))) {
    reg = reg.replace(
      new RegExp(`(id: "${maj}",\\n      name:[^\\n]+\\n      college:[^\\n]+\\n      degree:[^\\n]+\\n)`),
      `$1      ${uquFields},\n`
    );
  } else {
    reg = reg.replace(
      new RegExp(`id: "${maj}"[\\s\\S]*?uquProgramTitle:[^\\n]+`),
      (chunk) =>
        chunk
          .replace(/uquDegreeId: "[^"]*"/, `uquDegreeId: "${b.uquDegreeId}"`)
          .replace(/uquUrl: "[^"]*"/, `uquUrl: "https://uqu.edu.sa/App/Degrees/${b.uquDegreeId}"`)
          .replace(/uquProgramTitle: [^\n]+/, `uquProgramTitle: ${JSON.stringify(b.uquProgramTitle)}`)
    );
  }
}

const metaNote =
  '    uquCoursesNote: "sampleCourses و fitProfiles مُستقاة من الخطة الدراسية في uqu.edu.sa/App/Degrees (يُحدَّث عبر scripts/build-uqu-registry-data.mjs).",\n';
if (!reg.includes("uquCoursesNote")) {
  reg = reg.replace(/(meta:\s*\{[^]*?universityUrl:[^\n]+\n)/, `$1${metaNote}`);
}

fs.writeFileSync("data/registry-bundle.js", reg, "utf8");
console.log("registry-bundle.js updated");
