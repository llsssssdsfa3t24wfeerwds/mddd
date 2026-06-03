import fs from "fs";

const built = JSON.parse(fs.readFileSync("data/uqu-majors-built.json", "utf8"));
let reg = fs.readFileSync("data/registry-bundle.js", "utf8");

const majIds = Object.keys(built);

for (const maj of majIds) {
  const b = built[maj];
  const hoursMatch = reg.match(
    new RegExp(
      `id: "${maj}"[\\s\\S]*?uquUrl: "[^"]*",[\\s\\S]*?,\\s*:\\s*"([^"]*)",\\s*sampleCourses`
    )
  );
  const hoursNote = hoursMatch ? hoursMatch[1] : null;

  const uquBlock = [
    `uquDegreeId: "${b.uquDegreeId}"`,
    `uquUrl: "https://uqu.edu.sa/App/Degrees/${b.uquDegreeId}"`,
    `uquProgramTitle: ${JSON.stringify(b.uquProgramTitle)}`,
    hoursNote ? `hoursNote: ${JSON.stringify(hoursNote)}` : null,
  ]
    .filter(Boolean)
    .join(",\n      ");

  const samples = JSON.stringify(b.sampleCourses, null, 2)
    .split("\n")
    .map((l, i) => (i === 0 ? l : "      " + l))
    .join("\n");

  reg = reg.replace(
    new RegExp(
      `(id: "${maj}",[\\s\\S]*?degree: "بكالوريوس",[\\s\\S]*?)uquDegreeId:[\\s\\S]*?sampleCourses: \\[[\\s\\S]*?\\],`
    ),
    `$1${uquBlock},\n      sampleCourses: ${samples},`
  );
}

fs.writeFileSync("data/registry-bundle.js", reg, "utf8");
const ctx = { window: {} };
import vm from "vm";
vm.runInNewContext(reg, ctx);
console.log("repaired", ctx.window.UQU_REGISTRY.majors.length, "majors");
