const h = await (await fetch("https://uqu.edu.sa/App/Admission")).text();
const fetches = [...h.matchAll(/fetch\([^)]{10,300}\)/g)].map((m) => m[0]);
console.log("fetch", fetches.length);
fetches.forEach((x) => console.log(x));
const apis = [...h.matchAll(/["']([^"']*(?:api|Api|program|major|admission)[^"']*)["']/g)].map((m) => m[1]);
console.log("paths", [...new Set(apis)].filter((u) => u.length < 120).slice(0, 50));
