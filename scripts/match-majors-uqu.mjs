import fs from "fs";

const listing = JSON.parse(fs.readFileSync("data/uqu-bachelor-listing.json", "utf8"));

const RULES = [
  { maj: "MAJ_MED", must: ["الطب"], avoid: ["السنة الأولى", "الطارئة", "التمريض", "الصيدلة", "الأسنان"], college: "الطب" },
  { maj: "MAJ_DEN", must: ["طب الأسنان"], avoid: ["السنة الأولى", "الزمالة"], college: "طب الأسنان" },
  { maj: "MAJ_PHR", must: ["الصيدلة"], avoid: ["السنة الأولى"], college: "الصيدلة" },
  { maj: "MAJ_NUR", must: ["التمريض"], avoid: ["السنة الأولى"], college: "التمريض" },
  { maj: "MAJ_MLS", must: ["المختبرات"], avoid: [], college: "العلوم الطبية" },
  { maj: "MAJ_MLS", must: ["علوم طبية"], avoid: ["السنة الأولى"], college: "العلوم الطبية" },
  { maj: "MAJ_PHE", must: ["الصحة العامة"], avoid: ["السنة الأولى", "المعلوماتية"], college: "الصحة العامة" },
  { maj: "MAJ_CIV", must: ["الهندسة المدنية"], avoid: [], college: "الهندسة" },
  { maj: "MAJ_ELE", must: ["الهندسة الكهربائية"], avoid: [], college: "الهندسة" },
  { maj: "MAJ_MECH", must: ["الميكانيكية"], avoid: [], college: "الهندسة" },
  { maj: "MAJ_ARC", must: ["المعمارية"], avoid: [], college: "الهندسة" },
  { maj: "MAJ_CS", must: ["علوم الحاسب"], avoid: ["الأمن السيبراني"], college: "الحاسبات" },
  { maj: "MAJ_IS", must: ["نظم المعلومات"], avoid: ["الجغرافيا"], college: "الحاسبات" },
  { maj: "MAJ_IS", must: ["نظم المعلومات"], avoid: [], college: "الإدارة" },
  { maj: "MAJ_BUS", must: ["إدارة الأعمال"], avoid: ["(إدارة الأعمال)"], college: "الإدارة" },
  { maj: "MAJ_ACC", must: ["المحاسبة"], avoid: [], college: "الإدارة" },
  { maj: "MAJ_ECO", must: ["الاقتصاد"], avoid: ["السياسات"], college: "الإدارة" },
  { maj: "MAJ_LAW", must: ["القانون"], avoid: [], college: "القضائية" },
  { maj: "MAJ_LAW", must: ["القضائية"], avoid: [], college: "القضائية" },
  { maj: "MAJ_SHR", must: ["الشريعة"], avoid: ["أصول"], college: "الشريعة" },
  { maj: "MAJ_USL", must: ["أصول الدين"], avoid: [], college: "الدعوة" },
  { maj: "MAJ_ARB", must: ["اللغة العربية"], avoid: ["لغة ثانية", "إعداد معلم"], college: "اللغة العربية" },
  { maj: "MAJ_EDU", must: ["التربية"], avoid: ["ماجستير"], college: "التربية" },
  { maj: "MAJ_SCI", must: ["الرياضيات"], avoid: [], college: "العلوم" },
  { maj: "MAJ_SCI", must: ["الفيزياء"], avoid: [], college: "العلوم" },
  { maj: "MAJ_SOC", must: ["العلوم الاجتماعية"], avoid: [], college: "الاجتماعية" },
  { maj: "MAJ_DES", must: ["التصميم الداخلي"], avoid: [], college: "التصاميم" },
];

function scoreRow(row, rule) {
  let s = 0;
  if (rule.must.every((m) => row.text.includes(m))) s += 20;
  else return -1;
  if (rule.college && row.text.includes(rule.college)) s += 8;
  if (rule.avoid.some((a) => row.text.includes(a))) s -= 15;
  if (row.text.match(/بكالوريوس\s+[^()]+\(/)) s -= 3;
  return s;
}

const matches = {};
for (const rule of RULES) {
  let best = null;
  let bestScore = -1;
  for (const row of listing) {
    const sc = scoreRow(row, rule);
    if (sc > bestScore) {
      bestScore = sc;
      best = row;
    }
  }
  if (best && bestScore > 0) {
    const prev = matches[rule.maj];
    if (!prev || bestScore > prev.score) {
      matches[rule.maj] = { ...best, score: bestScore, rule: rule.must.join("+") };
    }
  }
}

console.log(JSON.stringify(matches, null, 2));
const missing = [...new Set(RULES.map((r) => r.maj))].filter((m) => !matches[m]);
console.error("missing", missing);
