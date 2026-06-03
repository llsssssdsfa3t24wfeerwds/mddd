import fs from "fs";

function parseListingRows(html) {
  const rows = [];
  const trRe = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(html))) {
    const block = tr[0];
    if (!/بكالوريوس/.test(block)) continue;
    const link = block.match(/href="(https:\/\/uqu\.edu\.sa\/App\/Degrees\/\d+)"/);
    const text = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (link) rows.push({ href: link[1], id: link[1].split("/").pop(), text });
  }
  return rows;
}

function parseCourses(html) {
  const re = /text-primary-800 text-sm font-semibold[^>]*>\s*([^<]+)\s*</g;
  const courses = [];
  let m;
  while ((m = re.exec(html))) {
    const name = m[1].trim().replace(/\s+/g, " ");
    if (name && !courses.includes(name)) courses.push(name);
  }
  return courses;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  return res.text();
}

async function main() {
  const all = [];
  for (let page = 1; page <= 34; page++) {
    const html = await fetchText(`https://uqu.edu.sa/App/Degrees?page=${page}`);
    const rows = parseListingRows(html);
    all.push(...rows);
    console.log("page", page, rows.length);
    await new Promise((r) => setTimeout(r, 300));
  }
  const byId = new Map();
  all.forEach((r) => byId.set(r.id, r));
  const uniq = [...byId.values()];
  fs.writeFileSync("data/uqu-bachelor-listing.json", JSON.stringify(uniq, null, 2), "utf8");
  console.log("total bachelor rows", uniq.length);
}

main();
