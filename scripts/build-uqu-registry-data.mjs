/**
 * يبني sampleCourses و fitProfiles من خطط UQU الفعلية.
 * node scripts/build-uqu-registry-data.mjs
 */
import fs from "fs";

/** معرف برنامج UQU لكل MAJ_* (من uqu.edu.sa/App/Degrees) */
const DEGREE_IDS = {
  MAJ_MED: "44",
  MAJ_DEN: "653",
  MAJ_PHR: "1739",
  MAJ_NUR: "847",
  MAJ_MLS: "485",
  MAJ_PHE: "1074",
  MAJ_CIV: "6",
  MAJ_ELE: "831",
  MAJ_MECH: "1485",
  MAJ_ARC: "1481",
  MAJ_CS: "478",
  MAJ_IS: "1510",
  MAJ_BUS: "769",
  MAJ_ACC: "1152",
  MAJ_ECO: "1724",
  MAJ_LAW: "816",
  MAJ_SHR: "18",
  MAJ_USL: "26",
  MAJ_ARB: "24",
  MAJ_EDU: "1744",
  MAJ_SCI: "1495",
  MAJ_SOC: "1",
  MAJ_DES: "1143",
};

const GENERIC_COURSE =
  /^(تجويد|حفظ|ختم|مهارات جامعية|التفكير التصميمي|مقدمة في الذكاء|اللغة الإنجليزية|القيم والأخلاق|الأسرة في الإسلام)/;

const RULES = [
  { axis: "quant", re: /رياض|إحص|حساب|جبر|تحليل|كمي|اقتصاد قياسي/ },
  { axis: "science", re: /كيمي|فيزي|أحي|تشريح|فسيول|وبائي|ميكروbi|مناعة|دواء|صيدل|طب |جراح|تمريض|تغذية|هيمات|مختبر|سريري|تشخيص|علاج|تمريض|أسنان|فم|صحة|وبائيات|بيئة صح|تشريح/ },
  { axis: "lab", re: /مختبر|معمل|ميداني عملي/ },
  { axis: "cs", re: /برمج|حاسب|حوسب|ذكاء اصطناعي|شبكات|سيبر|برمجيات|قواعد بيانات|نظم معلومات|معلوماتية|بيانات/ },
  { axis: "applied", re: /تطبيق|مشروع|تصميم|ورش|إنشاء|معماري|عمارة|تشييد|هندسة|ميكانيك|كهرب|مدني/ },
  { axis: "verbal", re: /عرب|أدب|نحو|بلاغة|نقد|لغة|قراءات|خطاب|كتابة|نصو/ },
  { axis: "detail", re: /محاسبة|تكاليف|مراجعة|ضرائب|دقة|جودة/ },
  { axis: "dataLit", re: /إحص|بيانات|قياس|معلوماتية/ },
  { axis: "logicR", re: /منطق|رياض|فيزياء|هندسة/ },
  { axis: "analysis", re: /بحث|تحليل|منهج|نقد|دراسات/ },
  { axis: "english", re: /إنجليز|English/i },
  { axis: "creativity", re: /تصميم|فن|ألوان|إبداع|عمارة/ },
  { axis: "argumentation", re: /مناظر|قانون|قضاء|مدني|جزائي|إقناع|مرافعة/ },
  { axis: "ethics", re: /أخلاق|قيم|عدالة|حقوق|قانون/ },
  { axis: "service", re: /خدمة اجتماع|تمريض|صحة مجتمع|دعوة|تربية/ },
  { axis: "social", re: /اجتماع|سلوك|تنظيم|إدارة أعمال|تسويق|نفس|تواصل/ },
  { axis: "wantHealth", re: /طب|صحة|تمريض|صيدل|سريري|وبائي|تغذية|إسعاف|طوارئ/ },
  { axis: "wantEng", re: /هندسة|حاسب|برمج|شبكات|ميكانيك|كهرب|مدني|عمارة/ },
  { axis: "wantBus", re: /إدارة|محاسبة|اقتصاد|تسويق|مالية|أعمال/ },
  { axis: "wantShar", re: /فقه|شريعة|حديث|تفسير|عقيدة|دعوة|قرآن|سنة|أصول/ },
];

function classifyCourse(name) {
  const tags = new Set();
  for (const { axis, re } of RULES) {
    if (re.test(name)) tags.add(axis);
  }
  if (!tags.size) tags.add("analysis");
  return [...tags];
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

function pickSampleCourses(courses) {
  const skipExtra = /مهارات اكاديمية|مهارات التطوير|اختياري|ختم القرآن|الأسرة في الإسلام|صحة في الحج/;
  const picked = [];
  for (const c of courses) {
    if (GENERIC_COURSE.test(c) || skipExtra.test(c)) continue;
    picked.push(c);
    if (picked.length >= 6) break;
  }
  if (picked.length >= 4) return picked;
  const core = courses.filter((c) => !GENERIC_COURSE.test(c));
  return core.slice(0, 6);
}

function buildWeights(courses) {
  const counts = {};
  courses.forEach((name) => {
    classifyCourse(name).forEach((axis) => {
      counts[axis] = (counts[axis] || 0) + 1;
    });
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const weights = {};
  Object.keys(counts).forEach((axis) => {
    weights[axis] = Math.round((counts[axis] / total) * 1000) / 1000;
  });
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const keys = Object.keys(weights);
  if (keys.length && Math.abs(sum - 1) > 0.01) {
    const k = keys[0];
    weights[k] = Math.round((weights[k] + (1 - sum)) * 1000) / 1000;
  }
  return weights;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(url + " " + res.status);
  return res.text();
}

async function main() {
  const out = {};
  for (const [maj, id] of Object.entries(DEGREE_IDS)) {
    const url = `https://uqu.edu.sa/App/Degrees/${id}`;
    let html;
    try {
      html = await fetchText(url);
    } catch (e) {
      console.error(maj, "FAIL", e.message);
      out[maj] = { error: e.message, uquDegreeId: id };
      continue;
    }
    const courses = parseCourses(html);
    const title = html.match(/<title>([^<|]+)/)?.[1]?.trim();
    out[maj] = {
      uquDegreeId: id,
      uquUrl: url,
      uquProgramTitle: title,
      courses,
      sampleCourses: pickSampleCourses(courses),
      axisWeights: buildWeights(courses),
    };
    console.log(maj, id, courses.length, title);
    await new Promise((r) => setTimeout(r, 350));
  }
  fs.writeFileSync("data/uqu-majors-built.json", JSON.stringify(out, null, 2), "utf8");
  console.log("written data/uqu-majors-built.json");
}

main();
