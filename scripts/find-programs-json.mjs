const h = await (await fetch("https://uqu.edu.sa/App/Admission")).text();
const markers = [
  "AdmissionProgramsComponent(",
  "determinant_code",
  '"semester"',
  "programs:",
];
for (const m of markers) {
  let i = 0;
  let c = 0;
  while ((i = h.indexOf(m, i)) >= 0 && c < 3) {
    console.log("\n==", m, "at", i);
    console.log(h.slice(i, i + 600).replace(/\s+/g, " "));
    i++;
    c++;
  }
}
