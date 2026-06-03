# AI_CONTEXT — مشروع توجيه التخصصات (أم القرى)

## الغرض

واجهة ويب عربية (RTL) تسجّل **الاسم والبريد** ثم **مسار الثانوي** ثم **استبياناً** لاشتقاق مستوى تقديري واقتراح **أفضل 3 تخصصات** (من برامج بكالوريوس مرتبطة بكليات جامعة أم القرى) مع **نطاق راتب شهري تقديري** للسوق المحلي، مع إخلاء مسؤولية أن القبول والرواتب الفعلية خارج نطاق التطبيق.

## REGISTRY_AND_ID_SYSTEM

كل كيان منطقي له `id` ثابت في `data/registry-bundle.js` (`window.UQU_REGISTRY`). المنطق في `js/app.js` يقرأ هذه المعرفات فقط ولا يُنشئ تخصصات عشوائية خارج السجل.

### مسارات الثانوي (`tracks`)

كل مسار يملك `academicNature`: `STEM_HEAVY` | `HUMANITIES_HEAVY` | `MIXED` وحقول `natureLabelAr` / `natureBadgeAr` للواجهة.

| المعرف | الوصف المختصر |
|--------|----------------|
| `TRACK_GEN` | المسار العام — MIXED |
| `TRACK_SHAR` | المسار الشرعي — HUMANITIES_HEAVY |
| `TRACK_BUS` | مسار إدارة الأعمال — HUMANITIES_HEAVY |
| `TRACK_CSE` | مسار علوم الحاسب والهندسة — STEM_HEAVY |
| `TRACK_HLT` | مسار الصحة والحياة — STEM_HEAVY |

- **HUMANITIES_HEAVY**: يُستبعد من الاقتراح ما عليه `stemOnly: true`؛ أسئلة ذات `hideForTrackNature` تُخفى.
- **STEM_HEAVY / MIXED**: استبيان كامل (مع ترتيب `meta.questionOrderSTEM` لـ STEM/MIXED).

المصدر المفهومي: نظام مسارات المرحلة الثانوية (وزارة التعليم).

### أنماط أكاديمية (`streams`)

| المعرف | التسمية |
|--------|---------|
| `STREAM_SCI` | علمي كمي |
| `STREAM_HEALTH` | صحي حيوي |
| `STREAM_ENG_CS` | هندسة وتقنية |
| `STREAM_BUS` | إداري ومالي |
| `STREAM_HUM` | أدبي وإنسانيات |
| `STREAM_SHAR` | شرعي وديني |

### أسئلة الاستبيان (`questions`)

كل سؤال له `id` و`axis` فريد يُجمَّع في `normalizeScores()`. يدعم `hint` و`hideForTrackNature`.

تشمل المحاور الأساسية والإضافية: `quant`, `science`, `verbal`, `grades`, `applied`, `detail`, `stamina`, `stress`, `cs`, `lab`, `social`, `want_*`, وكذلك `efficacy`, `study_plan`, `data_literacy`, `logic_reason`, `analysis`, `english`, `creativity`, `argumentation`, `ethics_sensitivity`, `service_motivation`.

**ترتيب العرض:** `meta.questionOrderHumanities` و`meta.questionOrderSTEM` في السجل.

**ملاحظة:** استبيان واحد موحّد لجميع التخصصات؛ لا ملف أسئلة لكل تخصص.

### التخصصات (`majors`)

- `tracks[]`, `streams[]`, `stemOnly`, `difficulty`, `salarySarMonthly`, `sampleCourses`

مصدر الأسماء: محاذاة مع `https://uqu.edu.sa/App/Degrees`.

### تطابق الاهتمام مع النتيجة (`interestFit` في `js/app.js`)

- **`want_shar`** (سؤال `QN_SHAR_INT`، محور `want_shar`): تطبيع `score/3`. خيار **A** (`score: 0`) يعني رفضاً صريحاً للمسار الشرعي/اللغوي التراثي؛ عقوبة قوية على أي تخصص يضم **`STREAM_SHAR`** حتى لا يغلب تقارب `verbal`/`analysis`/`argumentation` على إجابة «لا يناسب توجّهي». خيارات **B** ذات التطبيع ≤0.34 تبقى بعقوبة أخف.
- **`verbal`** (سؤال `QN_READ` عن العربية والنصوص): تطبيع `score/4`. عند الانخفاض (≤0.34، أي خيار **A** «ليس مجال اهتمامي الأكاديمي») تُضاف عقوبة على **`MAJ_ARB`** تحديداً لأن برنامج «اللغة العربية وآدابها» مسجّل بـ `STREAM_HUM` فقط وليس بـ `STREAM_SHAR`، فكان يظهر أحياناً رغم رفض المستخدم للمجال اللغوي.
- المعرفات `MAJ_*` و`STREAM_*` تبقى من `registry-bundle.js`؛ المنطق لا يُنشئ تخصصات جديدة.

### جلسات متعددة وزوار (`js/app.js`)

- **`VISITOR_ID_KEY`** (`uqu_visitor_instance_v1`): معرّف فريد لكل «زائر» في `sessionStorage`.
- **`WIZARD_PREFIX` + visitorId**: مفتاح حفظ خطوات المعالج (`uqu_orientation_wizard_v3_<uuid>`) — مستخدم جديد = UUID جديد = بيانات لا تختلط مع الجلسة السابقة على **نفس المتصفح**.
- **`?new=1` أو `?fresh=1`**: يحذف معرّف الزائر السابق وملف المعالج المرتبط، ثم يُنشئ زائراً جديداً (يُزال المعامل من شريط العنوان بـ `replaceState`).
- **زر «استبيان جديد لشخص آخر»**: يبدأ جلسة زائر جديدة يدوياً (نفس المنطق).
- **الواجهة للمستخدم:** لا تُعرض معرّفات جلسة، ولا أسماء مفاتيح تخزين، ولا مسارات ملفات أو معرفات `MAJ_*` في بطاقات النتيجة؛ النصوص التقنية محصورة في هذا الملف وللمطورين.
- **شريط «آخر النتائج»:** يظهر في **كل خطوات الموقع** (بما فيها التسجيل وصفحة النتائج)؛ يُستدعى `refreshTrackFeedPanel()` مع كل `showStep` وبعد حفظ النتيجة. كل سطر = الاسم + التخصص الأول (أعلى نسبة). محلياً `uqu_orientation_track_feed_v1` مع `emailKey`؛ `trackFeedRecorded` يمنع التكرار في نفس الجلسة. استجابة RPC قد تُلفّ داخل مصفوفة — `normalizeTrackFeedRpcPayload` يفكّ التداخل؛ مع Supabase وبدون صفوف يُعرض نص داخل اللوحة.
- **نفس البريد يعيد الاختبار:** عند إرسال نموذج التسجيل، يُستدعى `purgeLocalDataByEmail` لإزالة صفوف ذلك البريد من `uqu_orientation_leads` و`uqu_orientation_completions` والشريط المحلي (مفتاح `emailKey` للصفوف الجديدة). ويُستدعى RPC `delete_orientation_by_email` في Supabase ثم يُمسح `sessionStorage` للمعالج ويُعاد ضبط الخطوات. عند الإرسال للسحابة يُعاد الحذف ثم الإدراج لضمان صف واحد حديث لكل بريد.
- **تجديد الشريط بدون تكرار:** `dedupeFeedRows` يبقي أحدث صف لكل `emailKey` (أو اسم+تخصص إن لم يُرجَع بريد). دالة `track_feed_recent` تُرجع حقل `email` في JSON لتمييز الصفوف بعد تحديث السكربت في Supabase.
- **بيانات محفوظة على الجهاز:** `localStorage` مفتاح `uqu_saved_profile_v1` (اسم + بريد)؛ واجهة «ابدأ الاختبار» / «تغيير الاسم أو البريد». عند «استبيان جديد لشخص آخر» يُضبط `sessionStorage` `uqu_skip_profile_autoshow_once` لإظهار النموذج فارغاً مرة واحدة دون مسح الملف المحفوظ.
- **الترحية من المفتاح القديم:** لمرة واحدة يُقرأ `uqu_orientation_session_v2` إن وُجد ويُنقل للمفتاح الجديد.
- **أجهزة مختلفة:** كل جهاز له `sessionStorage` مستقل — نفس الرابط لا يوحّد الجلسات بين الأجهزة.
- سجلات `localStorage` (`uqu_orientation_leads`) تتضمّن `visitorInstanceId`؛ و`uqu_orientation_completions` تسجّل كل إكمال نتيجة (معرفات التخصصات الثلاثة من السجل) للإحصائية المحلية في المتصفح.

### المزامنة مع الواجهة

- `syncAnswersFromDOM()`, `applyAnswersToRadios()`, `pruneAnswersToVisible()` كما في الكود.
- `beforeunload` / `pageshow` للحفظ والمزامنة.

### تسجيل المستخدم والنتائج

- أول انتقال للاستبيان: `saveLead()` مع `leadSaved` لمنع التكرار في نفس جلسة الزائر.
- بعد `renderResults()`: `afterResultsPersist(top)` — يحدّث `uqu_orientation_completions` محلياً، ويُرسِل صفاً إلى Supabase عند تعبئة `window.UQU_REMOTE` في `js/uqu-config.js` (معطّل افتراضياً إذا بقي الحقلان فارغين).
- الحقول المرسلة للسحابة: `visitor_instance_id`, `name`, `email`, `track_id`, `major_rank_1..3` (قيم `id` من `majors` في السجل فقط).
- **`remoteResultSent`** يُخزَّن في جلسة المعالج لتجنّب إعادة الإرسال عند إعادة فتح خطوة النتائج.
- **لوحة النتائج — كتلة «أكثر التخصصات ظهوراً»:** تستدعي RPC `major_popularity_stats()` (تعريفها في `sql/supabase-setup.sql`) لعرض أكثر المعرفات (`MAJ_*`) تكراراً ضمن المراكز الثلاثة عبر **جميع** الإرسالات، مع تسمية العرض من `R.majors` (متوافق مع REGISTRY). الزائر لا يستطيع `SELECT` على الجدول مباشرة؛ التجميع عبر دالة `SECURITY DEFINER`.
- **RLS للإدراج (anon):** سياسة `orientation_submissions_anon_insert` تستخدم `WITH CHECK` مقيداً (مسار من قائمة `TRACK_*` السجلية، بريد واسم بطول معقول، معرفات تخصص `MAJ_[A-Z0-9_]+` أو فراغ) لتقليل سياسة «دائماً true» دون كسر التطبيق الثابت.
- بدون Supabase (`UQU_REMOTE` فارغ): تُعرض الإحصائية من `uqu_orientation_completions` في **نفس المتصفح** فقط إن وُجدت بيانات؛ وإلا يُخفى قسم الإحصائية دون نص إرشادي طويل. مع Supabase: طلب RPC بدون ترويسة `Prefer: return=minimal`؛ استجابة JSON تُطبَّع عبر `normalizeRpcStatsResponse`.

## الملفات

- `index.html`, `css/styles.css`, `data/registry-bundle.js`, `js/uqu-config.js`, `js/app.js`, `sql/supabase-setup.sql`
- `README.md` — نشر GitHub Pages وجلسات متعددة
- `.nojekyll` — لصفحات GitHub

## تكامل Git والنشر (محلي)

- **المستودع المستهدف (مثال المشروع):** `https://github.com/llsssssdsfa3t24wfeerwds/mddd.git` — يُضبط عبر `git remote` على الجهاز؛ لا يؤثر على منطق `REGISTRY` أو المعرفات في `registry-bundle.js`.
- **بريد المؤلف المحلي:** `xzy00150@gmail.com` (لـ `git config user.email` عند الحاجة).
- **دفع الكود:** يتطلب أن يكون المستودع منشأً على GitHub (خاص أو عام) وأن تنجح المصادقة؛ رسالة **Repository not found** من الخادم تعني غالباً عدم وجود المستودع، أو رابط خاطئ، أو عدم وصول الحساب/التوكن إليه.

### GitHub Pages (تشغيل من خوادم GitHub)

- المشروع **موقع ثابت** (`index.html` + مسارات نسبية)؛ بعد **Settings → Pages** (فرع `main`، مجلد `/ (root)`) يُنشر عنوان مثل `https://<user>.github.io/<repo>/`.
- **لا علاقة لذلك بمنطق REGISTRY:** نفس الملفات؛ التغيير الوحيد مكان التحميل (من `github.io` بدل ملف محلي أو localhost).
- **الإنترنت:** الزائر يحتاج شبكة لتحميل الصفحة من GitHub؛ لا يُعدّ ذلك «تشغيلاً بدون إنترنت» للمستخدم النهائي. عدم تشغيل خادم على جهاز المطوّر هو المقصود بـ «بدون localhost».

## تعديل لاحق متوافق مع السجل

عند إضافة تخصص أو سؤال: سجّل في `registry-bundle.js` بمعرف فريد، وحدّث هذا الملف (استبدال الأقسام المتأثرة).
