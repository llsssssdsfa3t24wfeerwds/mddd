const h = await (await fetch("https://uqu.edu.sa/App/Admission")).text();
const evo = h.match(/EvoUrl\s*=\s*['"]([^'"]+)['"]/);
const programsMatch = h.match(/programs:\s*(\{[\s\S]*?\})\s*,\s*filters:/);
console.log("EvoUrl", evo?.[1]);
const sem = h.match(/semester['"]\s*:\s*['"]([^'"]+)['"]/g);
console.log("semester hints", sem?.slice(0, 5));

// try common API paths
const base = evo?.[1] || "https://uqu.edu.sa/";
const tries = [
  "App/Admission/Programs",
  "App/Admission/programs",
  "api/admission/programs",
];
for (const p of tries) {
  const url = new URL(p, base).href;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    console.log(p, r.status, r.headers.get("content-type"));
    if (r.ok) {
      const t = await r.text();
      console.log(t.slice(0, 500));
    }
  } catch (e) {
    console.log(p, e.message);
  }
}

// find programs JSON embedded
const pm = h.match(/AdmissionProgramsComponent\s*\(\s*(\{[\s\S]{200,8000}?\})\s*,\s*filters\s*\)/);
if (pm) {
  const snippet = pm[1].slice(0, 1200);
  console.log("programs snippet", snippet);
}
