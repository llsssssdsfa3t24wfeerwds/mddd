import fs from "fs";
const h = await (await fetch("https://uqu.edu.sa/App/Admission")).text();
fs.writeFileSync("data/uqu-admission-page-snippet.html", h.slice(480000, 520000), "utf8");
const idx = h.indexOf("ProgramMajors");
console.log("idx", idx);
console.log(h.slice(idx - 500, idx + 800));
