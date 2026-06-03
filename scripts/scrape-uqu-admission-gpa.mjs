/**
 * يستخرج نص شروط القبول (تبويب admissionReqs) من صفحات برامج UQU
 * ويحاول استخراج الحد الأدنى للمعدل (مقياس 5).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BUILT = path.join(ROOT, "data", "uqu-majors-built.json");
const OUT = path.join(ROOT, "data", "uqu-admission-gpa.json");

function extractAdmissionText(html) {
  const panelRe =
    /currentTabValue === 'admissionReqs'[\s\S]*?role="tabpanel"[\s\S]*?<div class="group\/card[\s\S]*?<div class="m-0[^"]*"[^>]*>\s*([\s\S]*?)<\/div>\s*<\/div>/;
  const m = html.match(panelRe);
  if (!m) return "";
  return m[1]
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** يستخرج أقل معدل مطلوب من 5 من النص العربي */
function parseMinGpaFrom5(text) {
  if (!text) return null;
  const patterns = [
    /معدل[^.\d]{0,40}(\d(?:\.\d+)?)\s*(?:من|\/)\s*5/gi,
    /(\d(?:\.\d+)?)\s*(?:من|\/)\s*5/gi,
    /(\d(?:\.\d+)?)\s*فأكثر/gi,
    /لا\s*يقل[^.\d]{0,30}(\d(?:\.\d+)?)/gi,
    /(\d{2,3})\s*%/gi,
  ];
  const found = [];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      let v = parseFloat(m[1]);
      if (Number.isNaN(v)) continue;
      if (v > 5 && v <= 100) v = Math.round((v / 100) * 50) / 10; // 90% -> 4.5
      if (v > 0 && v <= 5) found.push(v);
    }
  }
  if (!found.length) return null;
  return Math.min(...found);
}

async function fetchAdmission(degreeId) {
  const url = `https://uqu.edu.sa/App/Degrees/${degreeId}`;
  const res = await fetch(url, {
    headers: { "Accept-Language": "ar-SA,ar;q=0.9", "User-Agent": "UQU-Orientation/1.0" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const html = await res.text();
  const text = extractAdmissionText(html);
  const minGpa = parseMinGpaFrom5(text);
  return { degreeId: String(degreeId), url, admissionText: text, minGpa };
}

async function main() {
  const built = JSON.parse(fs.readFileSync(BUILT, "utf8"));
  const ids = [...new Set(Object.values(built).map((x) => x.uquDegreeId).filter(Boolean))];
  const byDegree = {};
  for (const id of ids) {
    try {
      const row = await fetchAdmission(id);
      byDegree[id] = row;
      console.log(id, row.minGpa ?? "—", row.admissionText.slice(0, 80));
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      console.error("fail", id, e.message);
      byDegree[id] = { degreeId: id, error: e.message };
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(byDegree, null, 2), "utf8");
  console.log("wrote", OUT);
}

main();
