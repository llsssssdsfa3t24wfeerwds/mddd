/**
 * يجلب روابط ومواد برامج البكالوريوس من uqu.edu.sa/App/Degrees
 * تشغيل: node scripts/scrape-uqu-degrees.mjs
 */
import fs from "fs";

const SEARCHES = [
  { maj: "MAJ_MED", q: "الطب", college: "الطب" },
  { maj: "MAJ_DEN", q: "طب الأسنان", college: "طب الأسنان" },
  { maj: "MAJ_PHR", q: "الصيدلة", college: "الصيدلة" },
  { maj: "MAJ_NUR", q: "التمريض", college: "التمريض" },
  { maj: "MAJ_MLS", q: "المختبرات الطبية", college: "العلوم الطبية" },
  { maj: "MAJ_PHE", q: "الصحة العامة", college: "الصحة العامة" },
  { maj: "MAJ_CIV", q: "الهندسة المدنية", college: "الهندسة" },
  { maj: "MAJ_ELE", q: "الهندسة الكهربائية", college: "الهندسة" },
  { maj: "MAJ_MECH", q: "الميكانيكية", college: "الهندسة" },
  { maj: "MAJ_ARC", q: "المعمارية", college: "الهندسة" },
  { maj: "MAJ_CS", q: "علوم الحاسب", college: "الحاسبات" },
  { maj: "MAJ_IS", q: "نظم المعلومات", college: "الحاسبات" },
  { maj: "MAJ_BUS", q: "إدارة الأعمال", college: "الإدارة" },
  { maj: "MAJ_ACC", q: "المحاسبة", college: "الإدارة" },
  { maj: "MAJ_ECO", q: "الاقتصاد", college: "الإدارة" },
  { maj: "MAJ_LAW", q: "القانون", college: "القضائية" },
  { maj: "MAJ_SHR", q: "الشريعة", college: "الشريعة" },
  { maj: "MAJ_USL", q: "أصول الدين", college: "الدعوة" },
  { maj: "MAJ_ARB", q: "اللغة العربية", college: "اللغة العربية" },
  { maj: "MAJ_EDU", q: "التربية", college: "التربية" },
  { maj: "MAJ_SCI", q: "الرياضيات", college: "العلوم" },
  { maj: "MAJ_SOC", q: "العلوم الاجتماعية", college: "الاجتماعية" },
  { maj: "MAJ_DES", q: "التصميم الداخلي", college: "التصاميم" },
];

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

function parseListingRows(html) {
  const rows = [];
  const trRe = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(html))) {
    const block = tr[0];
    if (!/بكالوريوس/.test(block)) continue;
    const link = block.match(/href="(https:\/\/uqu\.edu\.sa\/App\/Degrees\/\d+)"/);
    const text = block
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (link) rows.push({ href: link[1], text });
  }
  return rows;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; UQU-Orientation/1.0)" },
  });
  if (!res.ok) throw new Error(`${url} => ${res.status}`);
  return res.text();
}

function pickBestRow(rows, search) {
  const bak = rows.filter((r) => r.text.includes("بكالوريوس"));
  if (!bak.length) return null;
  const scored = bak.map((r) => {
    let score = 0;
    if (r.text.includes(search.q)) score += 10;
    if (search.college && r.text.includes(search.college)) score += 5;
    if (r.text.includes("بكالوريوس") && !r.text.includes("ماجستير") && !r.text.includes("دكتوراه")) score += 2;
    return { ...r, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0] : bak[0];
}

async function main() {
  const out = {};
  for (const s of SEARCHES) {
    const url = `https://uqu.edu.sa/App/Degrees?searchQuery=${encodeURIComponent(s.q)}`;
    try {
      const html = await fetchText(url);
      const rows = parseListingRows(html);
      const pick = pickBestRow(rows, s);
      if (!pick) {
        out[s.maj] = { error: "no row", q: s.q, rows: rows.slice(0, 3) };
        console.warn(s.maj, "no match");
        continue;
      }
      const id = pick.href.match(/\/(\d+)$/)?.[1];
      const detailHtml = await fetchText(pick.href);
      const courses = parseCourses(detailHtml);
      const title = detailHtml.match(/<title>([^<|]+)/)?.[1]?.trim();
      out[s.maj] = {
        uquDegreeId: id,
        uquUrl: pick.href,
        title,
        listingText: pick.text.slice(0, 120),
        courses,
        courseCount: courses.length,
      };
      console.log(s.maj, id, courses.length, title);
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      out[s.maj] = { error: String(e.message), q: s.q };
      console.error(s.maj, e.message);
    }
  }
  fs.writeFileSync("data/uqu-courses-scraped.json", JSON.stringify(out, null, 2), "utf8");
  console.log("written data/uqu-courses-scraped.json");
}

main();
