import fs from "fs";
import vm from "vm";

const built = JSON.parse(fs.readFileSync("data/uqu-majors-built.json", "utf8"));
const clean = fs.readFileSync("data/registry-bundle-clean.js", "utf8");
const broken = fs.readFileSync("data/registry-bundle.js", "utf8");

const ctxClean = { window: {} };
vm.runInNewContext(clean, ctxClean);
const R0 = ctxClean.window.UQU_REGISTRY;

const fpMatch = broken.match(/fitProfiles:\s*\{[\s\S]*?\n  \},\n  tracks:/);
if (!fpMatch) throw new Error("fitProfiles not found in broken file");
const fitProfilesBlock = fpMatch[0].replace(/\n  \},\n  tracks:/, "");

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

const majors = R0.majors.map((m) => {
  const b = built[m.id];
  const out = {
    ...m,
    fitProfile: majFit[m.id],
    uquDegreeId: b.uquDegreeId,
    uquUrl: `https://uqu.edu.sa/App/Degrees/${b.uquDegreeId}`,
    uquProgramTitle: b.uquProgramTitle,
    sampleCourses: b.sampleCourses,
  };
  return out;
});

function objToJs(o, indent) {
  if (Array.isArray(o)) {
    if (!o.length) return "[]";
    if (typeof o[0] === "string") {
      return (
        "[\n" +
        o.map((s) => indent + '  "' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"').join(",\n") +
        ",\n" +
        indent +
        "]"
      );
    }
    return "[\n" + o.map((x) => indent + "  " + objToJs(x, indent + "  ")).join(",\n") + ",\n" + indent + "]";
  }
  if (o && typeof o === "object") {
    const lines = Object.entries(o).map(([k, v]) => {
      if (k === "salarySarMonthly") {
        return (
          indent +
          "salarySarMonthly: { min: " +
          v.min +
          ", max: " +
          v.max +
          ", note: " +
          JSON.stringify(v.note) +
          " }"
        );
      }
      const val =
        typeof v === "string"
          ? JSON.stringify(v)
          : Array.isArray(v)
            ? objToJs(v, indent + "  ")
            : objToJs(v, indent + "  ");
      return indent + k + ": " + val;
    });
    return "{\n" + lines.join(",\n") + ",\n" + indent.slice(0, -2) + "}";
  }
  return JSON.stringify(o);
}

const majorsBlock =
  "  majors: [\n" +
  majors
    .map((m) => {
      const lines = [
        "    {",
        '      id: "' + m.id + '",',
        "      name: " + JSON.stringify(m.name) + ",",
        "      college: " + JSON.stringify(m.college) + ",",
        '      degree: "بكالوريوس",',
        '      uquDegreeId: "' + m.uquDegreeId + '",',
        '      uquUrl: "' + m.uquUrl + '",',
        "      uquProgramTitle: " + JSON.stringify(m.uquProgramTitle) + ",",
      ];
      if (m.hoursNote) lines.push("      hoursNote: " + JSON.stringify(m.hoursNote) + ",");
      lines.push("      sampleCourses: " + objToJs(m.sampleCourses, "      ") + ",");
      lines.push('      streams: ' + JSON.stringify(m.streams) + ",");
      lines.push('      fitProfile: "' + m.fitProfile + '",');
      lines.push("      difficulty: " + m.difficulty + ",");
      lines.push("      tracks: " + JSON.stringify(m.tracks) + ",");
      lines.push("      stemOnly: " + m.stemOnly + ",");
      lines.push(
        "      salarySarMonthly: { min: " +
          m.salarySarMonthly.min +
          ", max: " +
          m.salarySarMonthly.max +
          ", note: " +
          JSON.stringify(m.salarySarMonthly.note) +
          " },"
      );
      lines.push("    }");
      return lines.join("\n");
    })
    .join(",\n") +
  ",\n  ],\n";

let reg = clean.replace(
  /meta:\s*\{/,
  'meta: {\n    uquCoursesNote:\n      "sampleCourses و fitProfiles من الخطة الدراسية في uqu.edu.sa/App/Degrees (scripts/build-uqu-registry-data.mjs).",'
);
reg = reg.replace(/  streams:\s*\[[\s\S]*?\n  \],\n  tracks:/, (m) => m);
reg = reg.replace(
  /(\s+streams:\s*\[[\s\S]*?\n  \],)\n  tracks:/,
  "$1\n" + fitProfilesBlock + ",\n  tracks:"
);
reg = reg.replace(/  majors:\s*\[[\s\S]*\],\n\};\n/, majorsBlock + "};\n");

fs.writeFileSync("data/registry-bundle.js", reg, "utf8");
const ctx = { window: {} };
vm.runInNewContext(reg, ctx);
console.log("rebuilt", ctx.window.UQU_REGISTRY.majors.length, "majors");
