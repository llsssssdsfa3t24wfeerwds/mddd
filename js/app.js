(function () {
  "use strict";

  const R = window.UQU_REGISTRY;
  if (!R) {
    console.error("UQU_REGISTRY missing");
    return;
  }

  const VISITOR_ID_KEY = "uqu_visitor_instance_v1";
  const WIZARD_PREFIX = "uqu_orientation_wizard_v3_";
  const LEGACY_SESSION_KEY = "uqu_orientation_session_v2";

  function generateVisitorId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "v_" + Date.now() + "_" + Math.random().toString(36).slice(2, 12);
  }

  /** يبدأ جلسة معزولة: مفتاح التخزين = بادئة + معرّف زائر (كل مستخدم جديد = معرّف جديد). */
  function getVisitorId() {
    try {
      let id = sessionStorage.getItem(VISITOR_ID_KEY);
      if (!id) {
        id = generateVisitorId();
        sessionStorage.setItem(VISITOR_ID_KEY, id);
      }
      return id;
    } catch (e) {
      return "local_" + Date.now();
    }
  }

  function wizardStorageKey() {
    return WIZARD_PREFIX + getVisitorId();
  }

  /** ?new=1 أو ?fresh=1 — جلسة نظيفة دون مشاركة بيانات الزائر السابق على نفس المتصفح. */
  function applyFreshUrlParam() {
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get("new") === "1" || u.searchParams.get("fresh") === "1") {
        const prev = sessionStorage.getItem(VISITOR_ID_KEY);
        if (prev) sessionStorage.removeItem(WIZARD_PREFIX + prev);
        sessionStorage.removeItem(VISITOR_ID_KEY);
        sessionStorage.removeItem(LEGACY_SESSION_KEY);
        u.searchParams.delete("new");
        u.searchParams.delete("fresh");
        const tail = u.search + u.hash;
        window.history.replaceState({}, "", u.pathname + (tail || ""));
      }
    } catch (e) {
      /* ignore */
    }
  }

  function updateVisitorHint() {
    const hint = el("visitor-session-hint");
    if (!hint) return;
    const id = getVisitorId();
    hint.textContent =
      "معرّف الجلسة الحالية (معزول عن مستخدمين آخرين على أجهزتهم): " + id.slice(0, 13) + "…";
  }

  const state = {
    step: 0,
    name: "",
    email: "",
    trackId: null,
    answers: {},
    leadSaved: false,
    /** منع تكرار إرسال نفس النتيجة إلى Supabase عند إعادة فتح خطوة النتائج. */
    remoteResultSent: false,
  };

  const LS_COMPLETIONS = "uqu_orientation_completions";

  function getRemoteConfig() {
    const c = window.UQU_REMOTE;
    if (!c || typeof c !== "object") return null;
    const url = (c.supabaseUrl || "").trim();
    const key = (c.supabaseAnonKey || "").trim();
    if (!url || !key) return null;
    return { url: url.replace(/\/$/, ""), key };
  }

  function supabaseHeadersInsert(cfg) {
    return {
      apikey: cfg.key,
      Authorization: "Bearer " + cfg.key,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=minimal",
    };
  }

  function supabaseHeadersRpc(cfg) {
    return {
      apikey: cfg.key,
      Authorization: "Bearer " + cfg.key,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  function normalizeRpcStatsResponse(raw) {
    if (raw == null) return null;
    let data = raw;
    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }
    if (Array.isArray(data)) {
      if (data.length === 1 && data[0] && typeof data[0] === "object" && !Array.isArray(data[0])) {
        data = data[0];
      } else {
        return null;
      }
    }
    if (!data || typeof data !== "object") return null;
    if (!Object.prototype.hasOwnProperty.call(data, "top_majors")) return null;
    const majors = data.top_majors;
    const top_majors = Array.isArray(majors) ? majors : [];
    const submission_count =
      typeof data.submission_count === "number" ? data.submission_count : undefined;
    return { top_majors, submission_count };
  }

  function recordCompletionLocal(top) {
    try {
      const prev = JSON.parse(localStorage.getItem(LS_COMPLETIONS) || "[]");
      prev.push({
        visitorInstanceId: getVisitorId(),
        trackId: state.trackId,
        majorIds: top.map((x) => x.major.id),
        at: new Date().toISOString(),
      });
      localStorage.setItem(LS_COMPLETIONS, JSON.stringify(prev));
    } catch (e) {
      /* ignore */
    }
  }

  function aggregateMajorCountsLocal() {
    try {
      const prev = JSON.parse(localStorage.getItem(LS_COMPLETIONS) || "[]");
      const counts = {};
      prev.forEach((row) => {
        (row.majorIds || []).forEach((id) => {
          if (id) counts[id] = (counts[id] || 0) + 1;
        });
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    } catch (e) {
      return [];
    }
  }

  function submitOrientationToRemote(top) {
    const cfg = getRemoteConfig();
    if (!cfg || !top.length) return Promise.resolve(false);
    const row = {
      visitor_instance_id: getVisitorId(),
      name: state.name,
      email: state.email,
      track_id: state.trackId || "",
      major_rank_1: top[0] ? top[0].major.id : null,
      major_rank_2: top[1] ? top[1].major.id : null,
      major_rank_3: top[2] ? top[2].major.id : null,
    };
    return fetch(cfg.url + "/rest/v1/orientation_submissions", {
      method: "POST",
      headers: supabaseHeadersInsert(cfg),
      body: JSON.stringify(row),
    })
      .then((res) => res.ok)
      .catch(() => false);
  }

  function fetchMajorPopularityRemote() {
    const cfg = getRemoteConfig();
    if (!cfg) return Promise.resolve(null);
    return fetch(cfg.url + "/rest/v1/rpc/major_popularity_stats", {
      method: "POST",
      headers: supabaseHeadersRpc(cfg),
      body: "{}",
    })
      .then((res) => {
        if (!res.ok) return Promise.resolve(null);
        return res.text().then((t) => {
          if (!t || !t.trim()) return null;
          try {
            return JSON.parse(t);
          } catch (e) {
            return null;
          }
        });
      })
      .then((raw) => normalizeRpcStatsResponse(raw))
      .catch(() => null);
  }

  function hideGlobalStats() {
    const host = el("res-global-stats");
    if (!host) return;
    host.classList.add("hidden");
    host.innerHTML = "";
  }

  /** subtitle: نص تحت العنوان أو null. emptyHint: إن لم توجد صفوف لكن نريد إظهار القسم (قاعدة فارغة). */
  function renderGlobalStatsIntoDom(payload, subtitle, emptyHint) {
    const host = el("res-global-stats");
    if (!host) return;

    const hasRows = payload && payload.length > 0;
    if (!hasRows && !emptyHint) {
      hideGlobalStats();
      return;
    }

    host.classList.remove("hidden");
    host.innerHTML = "";

    const title = document.createElement("h3");
    title.className = "global-stats-title";
    title.textContent = "أكثر التخصصات ظهوراً في أفضل 3 اقتراحات";
    host.appendChild(title);

    if (subtitle) {
      const sub = document.createElement("p");
      sub.className = "muted small global-stats-sub";
      sub.textContent = subtitle;
      host.appendChild(sub);
    }

    if (!hasRows) {
      const p = document.createElement("p");
      p.className = "muted small";
      p.textContent = emptyHint;
      host.appendChild(p);
      return;
    }

    const top3 = payload.slice(0, 3);
    const ol = document.createElement("ol");
    ol.className = "global-stats-list";
    top3.forEach((item, i) => {
      const major = R.majors.find((m) => m.id === item.majorId);
      const name = major ? major.name : item.majorId;
      const li = document.createElement("li");
      li.innerHTML =
        "<span class=\"g-rank\">#" +
        (i + 1) +
        "</span>" +
        "<span class=\"g-name\">" +
        name +
        "</span>" +
        "<span class=\"g-count\">" +
        item.count +
        " مرة</span>";
      ol.appendChild(li);
    });
    host.appendChild(ol);
  }

  function refreshGlobalStatsUI() {
    const cfg = getRemoteConfig();

    if (!cfg) {
      const localPairs = aggregateMajorCountsLocal();
      const payload = localPairs.map(([majorId, count]) => ({ majorId, count }));
      renderGlobalStatsIntoDom(payload, null, null);
      return;
    }

    fetchMajorPopularityRemote().then((data) => {
      if (data && Array.isArray(data.top_majors)) {
        const payload = data.top_majors.map((x) => ({
          majorId: x.major_id,
          count: x.count,
        }));
        let sub = "من قاعدة البيانات (جميع المستخدمين).";
        if (typeof data.submission_count === "number") {
          sub += " عدد الجلسات المسجّلة: " + data.submission_count + ".";
        }
        const emptyHint =
          payload.length === 0
            ? typeof data.submission_count === "number" && data.submission_count === 0
              ? "لا توجد جلسات في القاعدة بعد."
              : "لا توجد تخصصات مُجمَّعة للعرض بعد."
            : null;
        renderGlobalStatsIntoDom(payload, sub, emptyHint);
        return;
      }

      const localPairs = aggregateMajorCountsLocal();
      const payload = localPairs.map(([majorId, count]) => ({ majorId, count }));
      renderGlobalStatsIntoDom(payload, null, null);
    });
  }

  function afterResultsPersist(top) {
    recordCompletionLocal(top);
    const cfg = getRemoteConfig();
    if (!state.remoteResultSent && cfg && top.length) {
      submitOrientationToRemote(top).then((ok) => {
        if (ok) {
          state.remoteResultSent = true;
          persistSession();
        }
        refreshGlobalStatsUI();
      });
    } else {
      refreshGlobalStatsUI();
    }
  }

  const el = (id) => document.getElementById(id);

  function getTrackAcademicNature() {
    const t = R.tracks.find((x) => x.id === state.trackId);
    return t && t.academicNature ? t.academicNature : "MIXED";
  }

  /** مسارات أعمال/شرع: لا تُقترح تخصصات stemOnly ولا تُسأل أسئلة طب/هندسة/علوم/مختبر/برمجة. */
  function appliesStemOnlyFilter() {
    return getTrackAcademicNature() === "HUMANITIES_HEAVY";
  }

  function questionVisibleForNature(q) {
    const n = getTrackAcademicNature();
    const hide = q.hideForTrackNature;
    if (Array.isArray(hide) && hide.includes(n)) return false;
    return true;
  }

  function getQuestionsInOrder() {
    const byId = {};
    R.questions.forEach((q) => {
      byId[q.id] = q;
    });
    const nature = getTrackAcademicNature();
    if (nature === "HUMANITIES_HEAVY" && R.meta && Array.isArray(R.meta.questionOrderHumanities)) {
      return R.meta.questionOrderHumanities
        .map((id) => byId[id])
        .filter((q) => q && questionVisibleForNature(q));
    }
    if ((nature === "STEM_HEAVY" || nature === "MIXED") && R.meta && Array.isArray(R.meta.questionOrderSTEM)) {
      return R.meta.questionOrderSTEM
        .map((id) => byId[id])
        .filter((q) => q && questionVisibleForNature(q));
    }
    return R.questions.filter(questionVisibleForNature);
  }

  function pruneAnswersToVisible() {
    const ok = new Set(getQuestionsInOrder().map((q) => q.id));
    Object.keys(state.answers).forEach((k) => {
      if (!ok.has(k)) delete state.answers[k];
    });
  }

  function persistSession() {
    try {
      sessionStorage.setItem(
        wizardStorageKey(),
        JSON.stringify({
          step: state.step,
          name: state.name,
          email: state.email,
          trackId: state.trackId,
          answers: state.answers,
          leadSaved: state.leadSaved,
          remoteResultSent: state.remoteResultSent,
        })
      );
    } catch (e) {
      /* private mode / quota */
    }
  }

  function loadSession() {
    try {
      let raw = sessionStorage.getItem(wizardStorageKey());
      if (!raw && sessionStorage.getItem(LEGACY_SESSION_KEY)) {
        raw = sessionStorage.getItem(LEGACY_SESSION_KEY);
        if (raw) {
          sessionStorage.setItem(wizardStorageKey(), raw);
          sessionStorage.removeItem(LEGACY_SESSION_KEY);
        }
      }
      if (!raw) return false;
      const o = JSON.parse(raw);
      if (!o || typeof o !== "object" || typeof o.answers !== "object") return false;
      state.step = typeof o.step === "number" ? Math.min(3, Math.max(0, o.step)) : 0;
      state.name = typeof o.name === "string" ? o.name : "";
      state.email = typeof o.email === "string" ? o.email : "";
      state.trackId = o.trackId || null;
      state.answers = o.answers || {};
      state.leadSaved = !!o.leadSaved;
      state.remoteResultSent = !!o.remoteResultSent;
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(wizardStorageKey());
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function resetWizardStateToEmpty() {
    state.step = 0;
    state.name = "";
    state.email = "";
    state.trackId = null;
    state.answers = {};
    state.leadSaved = false;
    state.remoteResultSent = false;
    el("inp-name").value = "";
    el("inp-email").value = "";
    el("btn-tracks-next").disabled = true;
    el("questions").innerHTML = "";
    document.querySelectorAll(".choice.selected").forEach((x) => x.classList.remove("selected"));
  }

  function startNewVisitorSession() {
    try {
      const prev = sessionStorage.getItem(VISITOR_ID_KEY);
      if (prev) sessionStorage.removeItem(WIZARD_PREFIX + prev);
      sessionStorage.removeItem(VISITOR_ID_KEY);
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
    } catch (e) {
      /* ignore */
    }
    getVisitorId();
    resetWizardStateToEmpty();
    renderTracks();
    showStep(0);
    updateVisitorHint();
    persistSession();
  }

  /** يقرأ الإجابات من الواجهة (مهم بعد تحديث الصفحة عندما يبقى الراديو ظاهراً محدداً دون أحداث change). */
  function syncAnswersFromDOM() {
    const root = el("questions");
    if (!root) return;
    R.questions.forEach((q) => {
      const checked = root.querySelector('input[type="radio"][name="' + q.id + '"]:checked');
      if (checked && checked.value) state.answers[q.id] = checked.value;
    });
  }

  /** يطبّق state.answers على عناصر الراديو بعد إعادة الرسم. */
  function applyAnswersToRadios() {
    const root = el("questions");
    if (!root) return;
    R.questions.forEach((q) => {
      const v = state.answers[q.id];
      if (!v) return;
      const inp = root.querySelector('input[type="radio"][name="' + q.id + '"][value="' + v + '"]');
      if (inp) inp.checked = true;
    });
  }

  function normalizeScores() {
    const a = state.answers;
    const g = (axis, def) => {
      const q = R.questions.find((x) => x.axis === axis);
      if (!q || !a[q.id]) return def;
      const opt = q.options.find((o) => o.id === a[q.id]);
      return opt ? opt.score : def;
    };

    const hum = appliesStemOnlyFilter();

    const quant = g("quant", 2) / 4;
    const science = hum ? 0.28 : g("science", 2) / 4;
    const verbal = g("verbal", 2) / 4;
    const grades = g("grades", 2) / 4;
    const applied = g("applied", 2) / 4;
    const detail = g("detail", 2) / 4;
    const stamina = g("stamina", 2) / 4;
    const stress = g("stress", 2) / 4;
    const cs = hum ? 0.18 : g("cs", 1) / 4;
    const lab = hum ? 0.22 : g("lab", 2) / 4;
    const social = g("social", 2) / 4;
    const wantHealth = hum ? 0 : g("want_health", 1) / 3;
    const wantEng = hum ? 0 : g("want_eng", 1) / 3;
    const wantBus = g("want_bus", 1) / 3;
    const wantShar = g("want_shar", 1) / 3;

    const efficacy = g("efficacy", 2) / 4;
    const studyPlan = g("study_plan", 2) / 4;
    const dataLit = g("data_literacy", 2) / 4;
    const logicR = g("logic_reason", 2) / 4;
    const analysis = g("analysis", 2) / 4;
    const english = g("english", 2) / 4;
    const creativity = g("creativity", 2) / 4;
    const argumentation = g("argumentation", 2) / 4;
    const ethics = g("ethics_sensitivity", 2) / 4;
    const service = g("service_motivation", 2) / 4;

    const cognitive =
      quant * 0.12 +
      science * 0.12 +
      verbal * 0.07 +
      cs * 0.07 +
      lab * 0.06 +
      grades * 0.1 +
      applied * 0.04 +
      detail * 0.04 +
      efficacy * 0.08 +
      dataLit * 0.06 +
      logicR * 0.07 +
      analysis * 0.06 +
      english * 0.05 +
      creativity * 0.03 +
      argumentation * 0.03;

    const grind = stamina * 0.42 + stress * 0.42 + studyPlan * 0.16;

    let userTier =
      1 +
      cognitive * 1.92 +
      grind * 1.08 +
      (grades - 0.5) * 0.42 +
      (efficacy - 0.5) * 0.48 +
      (studyPlan - 0.5) * 0.35;
    userTier = Math.max(1, Math.min(5, Math.round(userTier)));

    return {
      quant,
      science,
      verbal,
      grades,
      applied,
      detail,
      stamina,
      stress,
      cs,
      lab,
      social,
      wantHealth,
      wantEng,
      wantBus,
      wantShar,
      efficacy,
      studyPlan,
      dataLit,
      logicR,
      analysis,
      english,
      creativity,
      argumentation,
      ethics,
      service,
      cognitive,
      grind,
      userTier,
    };
  }

  function streamAffinity(major, s) {
    const weights = {
      STREAM_SCI:
        s.quant * 0.32 +
        s.science * 0.32 +
        s.lab * 0.07 +
        (1 - s.applied) * 0.06 +
        s.logicR * 0.1 +
        s.dataLit * 0.08 +
        s.analysis * 0.05,
      STREAM_HEALTH:
        s.science * 0.24 +
        s.social * 0.18 +
        s.wantHealth * 0.32 +
        s.detail * 0.1 +
        s.ethics * 0.1 +
        s.service * 0.06,
      STREAM_ENG_CS:
        s.quant * 0.18 +
        s.cs * 0.32 +
        s.science * 0.18 +
        s.wantEng * 0.12 +
        s.applied * 0.14 +
        s.logicR * 0.1 +
        s.dataLit * 0.06,
      STREAM_BUS:
        s.verbal * 0.18 +
        s.wantBus * 0.42 +
        s.quant * 0.16 +
        s.detail * 0.09 +
        s.dataLit * 0.08 +
        s.english * 0.07,
      STREAM_HUM:
        s.verbal * 0.42 +
        (1 - s.cs) * 0.12 +
        s.social * 0.24 +
        (1 - s.applied) * 0.05 +
        s.creativity * 0.1 +
        s.analysis * 0.07,
      STREAM_SHAR:
        s.verbal * 0.32 +
        s.wantShar * 0.48 +
        s.argumentation * 0.12 +
        s.analysis * 0.08,
    };
    let sum = 0;
    for (const sid of major.streams) {
      sum += weights[sid] ?? 0;
    }
    return sum / major.streams.length;
  }

  function interestFit(major, s) {
    let penalty = 0;
    if (major.streams.includes("STREAM_HEALTH") && s.wantHealth <= 0.34) penalty += 18;
    if (major.streams.includes("STREAM_ENG_CS") && s.wantEng <= 0.34 && s.cs < 0.45) penalty += 12;
    if (major.streams.includes("STREAM_BUS") && s.wantBus <= 0.34) penalty += 10;
    if (major.streams.includes("STREAM_SHAR") && s.wantShar <= 0.34) penalty += 14;
    return penalty;
  }

  function majorScore(major, s) {
    const trackOk = major.tracks.includes(state.trackId);
    if (!trackOk) return -1;

    if (appliesStemOnlyFilter() && major.stemOnly === true) return -1;

    const tierDiff = Math.abs(major.difficulty - s.userTier);
    let base = 100 - tierDiff * 11;
    base += streamAffinity(major, s) * 36;
    base -= interestFit(major, s);

    if (major.difficulty >= 4 && s.grind < 0.45) base -= 14;
    if (major.difficulty >= 4 && s.studyPlan < 0.4) base -= 6;
    if (major.difficulty >= 4 && s.efficacy < 0.4) base -= 5;
    if (major.id === "MAJ_MLS" && s.detail < 0.45) base -= 8;
    if (major.streams.includes("STREAM_BUS") && (major.id === "MAJ_ACC" || major.id === "MAJ_ECO")) {
      if (s.detail < 0.4) base -= 6;
      if (s.dataLit < 0.4) base -= 5;
    }
    if (major.id === "MAJ_LAW" && s.argumentation < 0.4) base -= 12;
    if (major.id === "MAJ_DES" && s.creativity < 0.4) base -= 12;
    if (major.streams.includes("STREAM_HEALTH") && s.ethics < 0.35) base -= 8;
    if (major.streams.includes("STREAM_HEALTH") && s.service < 0.35) base -= 5;

    return base;
  }

  function topMajors(s) {
    const scored = R.majors
      .map((m) => ({ m, score: majorScore(m, s) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return [];

    const top = scored.slice(0, 3);
    const max = top[0].score;
    return top.map((x) => ({
      major: x.m,
      raw: x.score,
      pct: max > 0 ? Math.round((x.score / max) * 100) : 0,
    }));
  }

  function levelLabel(s) {
    if (s.userTier >= 5) return "مرتفع جداً — جاهزية لبرامج شديدة الإرهاق والتنافس";
    if (s.userTier === 4) return "مرتفع — مناسب لهندسة/حاسب/علوم قوية أو صحة متقدمة";
    if (s.userTier === 3) return "متوسط — توازن بين التحدي والاستقرار";
    if (s.userTier === 2) return "متوسط إلى منخفض — يفضّل برامج بضغط أقل نسبياً";
    return "يحتاج بناء تدريجي — تخصصات أخف حملاً أو دعم أكاديمي إضافي";
  }

  function saveLead() {
    const row = {
      id: "LEAD_" + Date.now(),
      visitorInstanceId: getVisitorId(),
      name: state.name,
      email: state.email,
      trackId: state.trackId,
      at: new Date().toISOString(),
    };
    const key = "uqu_orientation_leads";
    const prev = JSON.parse(localStorage.getItem(key) || "[]");
    prev.push(row);
    localStorage.setItem(key, JSON.stringify(prev));
    state.leadSaved = true;
  }

  function renderTracks() {
    const box = el("track-list");
    box.innerHTML = "";
    R.tracks.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice";
      b.dataset.id = t.id;
      b.innerHTML =
        "<strong>" +
        t.label +
        "</strong>" +
        (t.natureBadgeAr
          ? "<span class=\"track-badge\" title=\"" +
            (t.natureLabelAr || "").replace(/"/g, "&quot;") +
            "\">" +
            t.natureBadgeAr +
            "</span>"
          : "") +
        "<span class=\"muted\">" +
        t.streamHint +
        "</span>";
      b.addEventListener("click", () => {
        box.querySelectorAll(".choice").forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
        state.trackId = t.id;
        el("btn-tracks-next").disabled = false;
        persistSession();
      });
      box.appendChild(b);
    });
  }

  function renderQuestions() {
    const box = el("questions");
    box.innerHTML = "";
    const list = getQuestionsInOrder();
    list.forEach((q, idx) => {
      const wrap = document.createElement("div");
      wrap.className = "q-block";
      wrap.setAttribute("data-qid", q.id);
      let html =
        "<p class=\"q-title\"><span class=\"q-num\">" +
        (idx + 1) +
        "</span>" +
        q.text +
        "</p>";
      if (q.hint) {
        html += "<p class=\"q-hint\">" + q.hint + "</p>";
      }
      wrap.innerHTML = html;
      const opts = document.createElement("div");
      opts.className = "q-options";
      q.options.forEach((o) => {
        const lab = document.createElement("label");
        lab.className = "opt";
        const inp = document.createElement("input");
        inp.type = "radio";
        inp.name = q.id;
        inp.value = o.id;
        inp.setAttribute("autocomplete", "off");
        inp.addEventListener("change", () => {
          state.answers[q.id] = o.id;
          persistSession();
        });
        lab.appendChild(inp);
        lab.appendChild(document.createTextNode(" " + o.label));
        opts.appendChild(lab);
      });
      wrap.appendChild(opts);
      box.appendChild(wrap);
    });

    applyAnswersToRadios();
    syncAnswersFromDOM();
    pruneAnswersToVisible();
  }

  function bindQuestionsDelegation() {
    const box = el("questions");
    if (!box || box.dataset.delegationBound === "1") return;
    box.dataset.delegationBound = "1";
    box.addEventListener("change", (e) => {
      const t = e.target;
      if (t && t.type === "radio" && t.name) {
        syncAnswersFromDOM();
        persistSession();
      }
    });
  }

  function showStep(n) {
    state.step = n;
    document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
    const panels = ["panel-register", "panel-track", "panel-survey", "panel-results"];
    el(panels[n]).classList.remove("hidden");
    el("progress-fill").style.width = ((n + 1) / 4) * 100 + "%";
    if (n === 2) renderQuestions();
    persistSession();
  }

  function renderResults() {
    syncAnswersFromDOM();
    const s = normalizeScores();
    const top = topMajors(s);
    const track = R.tracks.find((t) => t.id === state.trackId);

    el("res-user").textContent = state.name;
    el("res-track").textContent = track ? track.label : "—";
    const stemEl = el("res-stem");
    if (stemEl) {
      const line = track && track.natureLabelAr ? track.natureLabelAr : "—";
      stemEl.textContent =
        "تصنيف مسارك في النموذج (تلقائي من اختيار المسار): " +
        line +
        (appliesStemOnlyFilter()
          ? " — لا تُقترح برامج مُعلَّمة stemOnly."
          : getTrackAcademicNature() === "MIXED"
            ? " — تُعرض كل فئات البرامج المتوافقة مع المسار والاستبيان."
            : " — استبيان علمي كامل.");
    }
    el("res-level").textContent = "المستوى التقديري (1–5): " + s.userTier + " — " + levelLabel(s);
    const confEl = el("res-confidence");
    if (confEl) {
      const n = getQuestionsInOrder().length;
      confEl.textContent =
        "في هذه الجلسة أجبت على " +
        n +
        " سؤالاً موجّهاً؛ تُجمع عشرات الإشارات لاشتقاق المستوى والملاءمة — كلما كانت الإجابات صادقة كان التوجيه أوضح، دون ادّعاء دقة مطلقة.";
    }

    const list = el("res-majors");
    list.innerHTML = "";
    top.forEach((t, i) => {
      const streams = t.major.streams
        .map((sid) => R.streams.find((x) => x.id === sid)?.label || sid)
        .join("، ");

      const li = document.createElement("article");
      li.className = "major-card";
      li.innerHTML =
        "<div class=\"major-rank\">#" +
        (i + 1) +
        "</div>" +
        "<h3>" +
        t.major.name +
        "</h3>" +
        "<p class=\"college\">" +
        t.major.college +
        "</p>" +
        "<p class=\"fit\"><span>نسبة الملاءمة التقديرية</span><strong>" +
        t.pct +
        "%</strong></p>" +
        "<p class=\"muted small\">" +
        (t.major.hoursNote || "") +
        "</p>" +
        "<p><strong>مواد نموذجية من الخطة:</strong> " +
        t.major.sampleCourses.join("، ") +
        "</p>" +
        "<p><strong>النمط الأكاديمي:</strong> " +
        streams +
        "</p>" +
        "<p><strong>الراتب الشهري المتوقع (تقدير سوقي):</strong> " +
        t.major.salarySarMonthly.min +
        " – " +
        t.major.salarySarMonthly.max +
        " ر.س — " +
        t.major.salarySarMonthly.note +
        "</p>" +
        "<p class=\"small muted\"><strong>مسلك التخصص في النموذج:</strong> " +
        (t.major.stemOnly
          ? "علمي/صحي/هندسي أو كمي مكثّف في الخطة"
          : "إداري أو إنساني أو شرعي (أقل اعتماداً على STEM في هذا التصنيف)") +
        "</p>" +
        "<p class=\"small muted\">المعرف في السجل: <code>" +
        t.major.id +
        "</code></p>";
      list.appendChild(li);
    });

    if (!top.length) {
      const extra = appliesStemOnlyFilter()
        ? " مسارك يُصنَّف إدارياً/أدبياً في النموذج فلا تُعرض البرامج الشديدة علمياً؛ جرّب «المسار العام» أو مساراً علمياً إن كان ينطبق."
        : "";
      list.innerHTML =
        "<p class=\"warn\">لا توجد تخصصات مطابقة لمسارك وخياراتك في البيانات الحالية." +
        extra +
        " راجع عمادة القبول في الجامعة للاشتراطات الرسمية.</p>";
    }

    afterResultsPersist(top);
  }

  function restoreUIFromState() {
    el("inp-name").value = state.name;
    el("inp-email").value = state.email;
    el("btn-tracks-next").disabled = !state.trackId;
    if (state.trackId) {
      const sel = el("track-list").querySelector('.choice[data-id="' + state.trackId + '"]');
      if (sel) {
        el("track-list").querySelectorAll(".choice").forEach((x) => x.classList.remove("selected"));
        sel.classList.add("selected");
      }
    }
  }

  function initFromSession() {
    const had = loadSession();
    renderTracks();
    bindQuestionsDelegation();
    if (had) {
      restoreUIFromState();
      if (state.step === 3) {
        renderResults();
      }
      showStep(state.step);
    } else {
      showStep(0);
    }
  }

  el("form-register").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = el("inp-name").value.trim();
    const email = el("inp-email").value.trim();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("يرجى إدخال اسم صحيح وبريد إلكتروني صالح.");
      return;
    }
    state.name = name;
    state.email = email;
    showStep(1);
    persistSession();
  });

  el("btn-tracks-next").addEventListener("click", () => {
    if (!state.trackId) return;
    if (!state.leadSaved) saveLead();
    persistSession();
    showStep(2);
  });

  el("btn-survey-submit").addEventListener("click", () => {
    syncAnswersFromDOM();
    const visible = getQuestionsInOrder();
    const missing = visible.filter((q) => !state.answers[q.id]);
    if (missing.length) {
      alert("يرجى الإجابة على جميع الأسئلة (" + missing.length + " متبقية). إن ظهرت خيارات محددة بعد التحديث، اضغط «عرض النتائج» مرة أخرى — أو أعد اختيار السطر الأخير في كل سؤال.");
      const first = missing[0];
      const block = el("questions").querySelector('.q-block[data-qid="' + first.id + '"]');
      if (block) block.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    renderResults();
    showStep(3);
  });

  el("btn-restart").addEventListener("click", () => {
    clearSession();
    resetWizardStateToEmpty();
    renderTracks();
    showStep(0);
    updateVisitorHint();
    persistSession();
  });

  el("btn-new-visitor").addEventListener("click", () => {
    const ok = window.confirm(
      "هل تريد بدء جلسة جديدة لمستخدم آخر؟ يُنشأ معرّف جديد ولا تختلط إجاباته مع الجلسة السابقة على هذا المتصفح."
    );
    if (!ok) return;
    startNewVisitorSession();
  });

  window.addEventListener("pageshow", (ev) => {
    if (ev.persisted) {
      syncAnswersFromDOM();
      persistSession();
    }
  });

  window.addEventListener("beforeunload", () => {
    syncAnswersFromDOM();
    persistSession();
  });

  applyFreshUrlParam();
  getVisitorId();
  updateVisitorHint();
  initFromSession();
})();
