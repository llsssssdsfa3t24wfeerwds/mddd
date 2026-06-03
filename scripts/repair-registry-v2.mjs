import fs from "fs";
import vm from "vm";

const built = JSON.parse(fs.readFileSync("data/uqu-majors-built.json", "utf8"));
let reg = fs.readFileSync("data/registry-bundle.js", "utf8");

// إصلاح sampleCourses المكسورة: ",\n      : ["
reg = reg.replace(
  /uquUrl: "(https:\/\/uqu\.edu\.sa\/App\/Degrees\/\d+)",\s*,\s*:\s*\[/g,
  (m, url) => {
    const id = url.split("/").pop();
    const maj = Object.entries(built).find(([, b]) => b.uquDegreeId === id)?.[0];
    if (!maj) return m;
    const b = built[maj];
    return `uquUrl: "${url}",\n      uquProgramTitle: ${JSON.stringify(b.uquProgramTitle)},\n      sampleCourses: [`;
  }
);

// إصلاح hoursNote المكسورة: ",\n      : \"..."
reg = reg.replace(
  /uquUrl: "(https:\/\/uqu\.edu\.sa\/App\/Degrees\/\d+)",\s*,\s*:\s*"([^"]*)",\s*sampleCourses/g,
  (m, url, hours) => {
    const id = url.split("/").pop();
    const maj = Object.entries(built).find(([, b]) => b.uquDegreeId === id)?.[0];
    const title = maj ? built[maj].uquProgramTitle : "";
    return `uquUrl: "${url}",\n      uquProgramTitle: ${JSON.stringify(title)},\n      hoursNote: ${JSON.stringify(hours)},\n      sampleCourses`;
  }
);

// إزالة أسطر فارغة `,` فقط
reg = reg.replace(/\n      ,\n/g, "\n");

fs.writeFileSync("data/registry-bundle.js", reg, "utf8");
const ctx = { window: {} };
vm.runInNewContext(reg, ctx);
const R = ctx.window.UQU_REGISTRY;
console.log("OK", R.majors.length);
R.majors.forEach((m) => {
  if (!m.uquProgramTitle || !m.sampleCourses?.length) console.warn("bad", m.id);
});
