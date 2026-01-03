// ===============================
// عناصر الواجهة
// ===============================
const numberEl = document.getElementById("number");
const questionEl = document.getElementById("question");
const answerEl = document.getElementById("answer");
const statusEl = document.getElementById("status");

const tabsEl = document.getElementById("tabs");
const variantTabsEl = document.getElementById("variantTabs");
const mainBtn = document.getElementById("mainBtn");
const showAnswerBtn = document.getElementById("showAnswerBtn");
const resetBtn = document.getElementById("resetBtn");
const resetAllBtn = document.getElementById("resetAllBtn");

const fullscreenBtn = document.getElementById("fullscreenBtn");
const soundToggle = document.getElementById("soundToggle");
const vibrateToggle = document.getElementById("vibrateToggle");

// ===============================
// ⏱️ Timer Sound (tik.mp3 is 6s)
// ===============================
const tikAudio = new Audio("tik.mp3");
tikAudio.preload = "auto";
tikAudio.volume = 0.6; // عدّل مستوى الصوت إذا لزم

let tikInterval = null;

function startTimerSound() {
  if (!soundToggle || !soundToggle.checked) return;

  stopTimerSound(); // أمان

  tikAudio.currentTime = 0;
  tikAudio.play().catch(() => {});

  // إعادة تشغيل كل 6 ثواني لأن الملف قصير
  tikInterval = setInterval(() => {
    if (!soundToggle.checked) return;
    tikAudio.currentTime = 0;
    tikAudio.play().catch(() => {});
  }, 6000);
}

function stopTimerSound() {
  if (tikInterval) {
    clearInterval(tikInterval);
    tikInterval = null;
  }
  tikAudio.pause();
  tikAudio.currentTime = 0;
}

// إيقاف الصوت فوراً إذا أُغلق الخيار أثناء التشغيل
if (soundToggle) {
  soundToggle.addEventListener("change", () => {
    if (!soundToggle.checked) stopTimerSound();
  });
}

// ===============================
// BOTTOM TIMER BAR (LINEAR) — decreases linearly at bottom
// ===============================

const TIMER_DURATION_SEC = 10;
let timerTimeout = null;

const timerBorderEl = document.getElementById("timerBorder");
const timerBarEl = document.getElementById("timerBar");

function startTimerBorder() {
  if (!timerBorderEl || !timerBarEl) return;

  // show bar
  timerBorderEl.hidden = false;
  startTimerSound();

  // reset instantly (full width)
  timerBarEl.style.transition = "none";
  timerBarEl.style.transform = "scaleX(1)";

  // force reflow to restart animation cleanly every time
  timerBarEl.getBoundingClientRect();

  // linear shrink to zero
  timerBarEl.style.transition = `transform ${TIMER_DURATION_SEC}s linear`;
  timerBarEl.style.transform = "scaleX(0)";

  // timeout end
  clearTimeout(timerTimeout);
  timerTimeout = setTimeout(() => {
    stopTimerBorder();
    alert("⏰ انتهى الوقت!");
  }, TIMER_DURATION_SEC * 1000);
}

function stopTimerBorder() {
  stopTimerSound();
  clearTimeout(timerTimeout);
  timerTimeout = null;

  if (!timerBorderEl || !timerBarEl) return;

  timerBarEl.style.transition = "none";
  timerBarEl.style.transform = "scaleX(1)";
  timerBorderEl.hidden = true;
}

// ===============================
// مجموعات الأسئلة من ملفات set1..set4
// ===============================
const sets = window.QUESTION_SETS || {};
const paneNames = Object.keys(sets);

// ===============================
// دعم النسخ (Variants) لكل لوحة
// - يدعم الشكل القديم: window.QUESTION_SETS["لوحة"] = [ ... ]
// - ويدعم الشكل الجديد: window.QUESTION_SETS["لوحة"] = { variants: { A:[...], B:[...] } }
// ===============================
function getPaneVariants(paneName) {
  const pane = (sets && paneName) ? sets[paneName] : null;

  // الشكل القديم
  if (Array.isArray(pane)) return ["A"];

  // الشكل الجديد
  if (pane && typeof pane === "object" && pane.variants && typeof pane.variants === "object") {
    const keys = Object.keys(pane.variants).filter(Boolean);
    return keys.length ? keys : ["A"];
  }

  return ["A"];
}

function getPaneQuestions(paneName, variant = "A") {
  const pane = (sets && paneName) ? sets[paneName] : null;

  // الشكل القديم
  if (Array.isArray(pane)) return pane;

  // الشكل الجديد
  if (pane && typeof pane === "object" && pane.variants && typeof pane.variants === "object") {
    // إن لم توجد النسخة المطلوبة، خذ أول نسخة متاحة
    const list = pane.variants[variant];
    if (Array.isArray(list)) return list;

    const firstKey = Object.keys(pane.variants)[0];
    const fallback = firstKey ? pane.variants[firstKey] : null;
    return Array.isArray(fallback) ? fallback : [];
  }

  return [];
}

// مفتاح داخلي لتمييز حالة كل لوحة + نسخة (Variant)
function paneKey(paneName, variant) {
  return `${paneName}__${variant || "A"}`;
}


let activePane = null;
let activeVariant = null;
const selectedVariantByPane = new Map();

let isRolling = false;
let rollTimer = null;
let currentIndex = null;
let currentItem = null; // آخر عنصر سؤال تم اختياره (يدعم string أو {question, answer})

// قفل ضغطات متتالية بسرعة (حل مشكلة الضغط الكثير)
let clickLocked = false;

// مؤشرات متبقية لكل لوحة
const remainingByPane = new Map();

// ===============================
// أدوات تابلت/واجهة
// ===============================

// تحويل أرقام إلى عربية (١٢٣...)
function toArabicDigits(input) {
  const map = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
  return String(input).replace(/\d/g, d => map[Number(d)]);
}

// صوت بسيط عبر WebAudio (بدون ملفات)
let audioCtx = null;
function beep(freq = 880, durationMs = 120) {
  if (!soundToggle?.checked) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + durationMs / 1000);
  } catch {
    // تجاهل لو المتصفح منع الصوت
  }
}

function vibrate(pattern = 40) {
  if (!vibrateToggle?.checked) return;
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ملء الشاشة
function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

async function toggleFullscreen() {
  const el = document.documentElement;
  try {
    if (!isFullscreen()) {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    }
  } catch {
    questionEl.textContent = "قد لا يدعم هذا الجهاز ملء الشاشة بالكامل.";
  }
}

function updateFullscreenBtnLabel() {
  if (!fullscreenBtn) return;
  fullscreenBtn.textContent = isFullscreen() ? "خروج من ملء الشاشة" : "ملء الشاشة";
}

// قفل ضغطات متتالية بسرعة
function lockClicks(ms = 350) {
  clickLocked = true;
  // خيار بصري: تعطيل الزر أثناء القفل
  mainBtn.disabled = true;

  setTimeout(() => {
    clickLocked = false;
    // لا نعيد تفعيل الزر إذا انتهت أسئلة اللوحة
    if (activePane) {
      const remaining = (remainingByPane.get(paneKey(activePane, activeVariant || "A")) || []).length;
      if (remaining > 0 || isRolling) mainBtn.disabled = false;
    } else {
      // mainBtn state يعتمد على اختيار النسخة
    }
  }, ms);
}

// ===============================
// منطق الأسئلة
// ===============================
function buildIndexesForPane(paneName, variant) {
  const list = getPaneQuestions(paneName, variant || "A");
  return Array.from({ length: list.length }, (_, i) => i);
}

function ensurePaneState(paneName, variant) {
  const key = paneKey(paneName, variant);
  if (!remainingByPane.has(key)) {
    remainingByPane.set(key, buildIndexesForPane(paneName, variant));
  }
}

function updateStatus() {
  if (!activePane) {
    statusEl.textContent = "";
    return;
  }
  const list = getPaneQuestions(activePane, activeVariant || "A");
  const total = list.length;
  const remaining = (remainingByPane.get(paneKey(activePane, activeVariant || "A")) || []).length;
  const used = total - remaining;

  statusEl.textContent =
    `اللوحة: ${activePane}${activeVariant ? " • النسخة: " + activeVariant : ""} • المستخدم: ${toArabicDigits(used)}/${toArabicDigits(total)} • المتبقي: ${toArabicDigits(remaining)}`;
}

function setTabsDisabled(disabled) {
  const btns = tabsEl.querySelectorAll("button.tab");
  btns.forEach(b => (b.disabled = disabled));
}

function stopRolling() {
  if (rollTimer) {
    clearInterval(rollTimer);
    rollTimer = null;
  }
  isRolling = false;

  // أيقاف شريط المؤقت إذا كان يعمل
  stopTimerBorder();

  mainBtn.textContent = "ابدأ";
  mainBtn.classList.remove("stop");

  setTabsDisabled(false);
  if (variantTabsEl) {
    variantTabsEl.querySelectorAll('button.tab').forEach(b => (b.disabled = false));
  }
}

// ===============================
// إظهار/إخفاء الإجابة
// ===============================

function hideAnswer() {
  if (!answerEl) return;
  answerEl.hidden = true;
  answerEl.textContent = "";
  if (showAnswerBtn) {
    showAnswerBtn.disabled = true;
    showAnswerBtn.textContent = "إظهار الإجابة";
  }
}

function prepareAnswerForItem(item) {
  // يدعم شكلين:
  // 1) نص فقط (قديم): "السؤال"
  // 2) كائن: { question: "...", answer: "..." }
  const answer = (item && typeof item === "object") ? (item.answer ?? "") : "";

  if (!answerEl || !showAnswerBtn) return;

  answerEl.hidden = true;
  answerEl.textContent = answer;

  const hasAnswer = String(answer).trim().length > 0;
  showAnswerBtn.disabled = !hasAnswer;
  showAnswerBtn.textContent = "إظهار الإجابة";
}

function getRandomRemainingIndex(key) {
  const remaining = remainingByPane.get(key) || [];
  const r = Math.floor(Math.random() * remaining.length);
  return remaining[r];
}

function startRolling() {
  if (!activePane) return;

  // في اللوحات متعددة النسخ: لازم اختيار النسخة قبل البدء
  const variants = getPaneVariants(activePane);
  if (variants.length > 1 && !activeVariant) {
    questionEl.textContent = "اختر النسخة ثم اضغط ابدأ.";
    mainBtn.disabled = true;
    return;
  }

  // إذا كان هناك مؤقت من سؤال سابق، أوقفه قبل بدء اختيار جديد
  stopTimerBorder();
  hideAnswer();
  currentItem = null;

  const list = getPaneQuestions(activePane, activeVariant || "A");
  ensurePaneState(activePane, activeVariant || "A");
  const key = paneKey(activePane, activeVariant || "A");
  const remaining = remainingByPane.get(key) || [];

  if (list.length === 0) {
    numberEl.textContent = "—";
    questionEl.textContent = "هذه اللوحة لا تحتوي على أسئلة.";
    stopRolling();
    mainBtn.disabled = true;
    showAnswerBtn.disabled = true;
    updateStatus();
    return;
  }

  if (remaining.length === 0) {
    numberEl.textContent = "—";
    questionEl.textContent = "لا توجد أسئلة متبقية في هذه اللوحة.";
    stopRolling();
    mainBtn.disabled = true;
    showAnswerBtn.disabled = true;
    updateStatus();
    return;
  }

  isRolling = true;
  showAnswerBtn.disabled = true;

  mainBtn.textContent = "إيقاف";
  mainBtn.classList.add("stop");

  questionEl.textContent = "جاري الاختيار...";
  setTabsDisabled(true);
  if (variantTabsEl) {
    variantTabsEl.querySelectorAll("button.tab").forEach(b => (b.disabled = true));
  }

  rollTimer = setInterval(() => {
    currentIndex = getRandomRemainingIndex(key);
    // عرض رقم السؤال للمستخدم (1..N) وبأرقام عربية
    numberEl.textContent = toArabicDigits(currentIndex + 1);
  }, 60);
}

function revealQuestionAndConsume() {
  if (!activePane) return;

  const list = getPaneQuestions(activePane, activeVariant || "A");
  const key = paneKey(activePane, activeVariant || "A");
  const remaining = remainingByPane.get(key) || [];

  if (currentIndex === null || remaining.length === 0) return;

  // إزالة الرقم حتى لا يظهر مجددًا
  remainingByPane.set(
    key,
    remaining.filter(i => i !== currentIndex)
  );

  // عرض السؤال
  currentItem = list[currentIndex];
  const q = (currentItem && typeof currentItem === "object") ? (currentItem.question ?? "") : String(currentItem ?? "");
  questionEl.textContent = q;

  // جهّز الإجابة (مخفية) وزر الإظهار
  prepareAnswerForItem(currentItem);

  // ابدأ شريط المؤقت (15 ثانية) بمجرد ظهور السؤال
  startTimerBorder();

  // تأثيرات
  beep(880, 120);
  setTimeout(() => beep(660, 120), 130);
  vibrate([40, 30, 40]);

  updateStatus();

  // إذا انتهت الأسئلة
  if ((remainingByPane.get(key) || []).length === 0) {
    mainBtn.disabled = true;
    questionEl.textContent += " (هذا آخر سؤال)";
  }
}

function renderVariantTabs(paneName) {
  if (!variantTabsEl) return;

  const variants = getPaneVariants(paneName);

  // إذا لا يوجد إلا نسخة واحدة (أو شكل قديم)، نخفي التبويبات ونثبت النسخة A
  if (variants.length <= 1) {
    variantTabsEl.hidden = true;
    activeVariant = "A";
    selectedVariantByPane.set(paneName, "A");
    ensurePaneState(paneName, activeVariant);
    return;
  }

  variantTabsEl.hidden = false;
  variantTabsEl.innerHTML = "";

  // لا نفرض اختيار تلقائي: المستخدم لازم يختار قبل "ابدأ"
  activeVariant = selectedVariantByPane.get(paneName) || null;

  variants.forEach(v => {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.type = "button";
    btn.textContent = `النسخة ${v}`;
    btn.dataset.variant = v;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(activeVariant === v));
    btn.addEventListener("click", () => {
      if (isRolling) return;

      activeVariant = v;
      selectedVariantByPane.set(paneName, v);

      // تحديث شكل تبويبات النسخ
      variantTabsEl.querySelectorAll("button.tab").forEach(b => {
        b.setAttribute("aria-selected", String(b.dataset.variant === v));
      });

      ensurePaneState(paneName, activeVariant);

      // واجهة
      numberEl.textContent = "—";
      questionEl.textContent = "اضغط ابدأ لاختيار سؤال.";
      hideAnswer();
      mainBtn.disabled = false;
      showAnswerBtn.disabled = true;

      updateStatus();
    });

    variantTabsEl.appendChild(btn);
  });

  // إن لم يتم اختيار نسخة بعد
  if (!activeVariant) {
    numberEl.textContent = "—";
    questionEl.textContent = "اختر النسخة ثم اضغط ابدأ.";
    hideAnswer();
    mainBtn.disabled = true;
    showAnswerBtn.disabled = true;
  } else {
    ensurePaneState(paneName, activeVariant);
    mainBtn.disabled = false;
  }
}

function selectPane(paneName) {
  stopRolling();

  activePane = paneName;
  renderVariantTabs(activePane);

  // تحديث شكل التبويبات
  tabsEl.querySelectorAll("button.tab").forEach(btn => {
    const isActive = btn.dataset.pane === paneName;
    btn.setAttribute("aria-selected", String(isActive));
  });

  currentIndex = null;
  currentItem = null;
  numberEl.textContent = "—";
  questionEl.textContent = "اضغط ابدأ";

  hideAnswer();

  // تفعيل/تعطيل زر ابدأ حسب وجود أسئلة متبقية
  const remaining = (remainingByPane.get(paneKey(activePane, activeVariant || "A")) || []).length;
  mainBtn.disabled = remaining === 0;

  updateStatus();
}

function resetCurrentPane() {
  if (!activePane) return;
  resetPane(activePane);
}

function resetAllPanes() {
  stopRolling();

  for (const name of paneNames) {
    const variants = getPaneVariants(name);
    variants.forEach(v => {
      remainingByPane.set(paneKey(name, v), buildIndexesForPane(name, v));
    });
  }

  currentIndex = null;
  currentItem = null;

  numberEl.textContent = "—";
  questionEl.textContent = "تمت إعادة تعيين جميع اللوحات. اضغط ابدأ.";
  hideAnswer();

  // إذا اللوحة الحالية تحتاج اختيار نسخة، امنع البدء
  if (activePane) {
    renderVariantTabs(activePane);
  } else {
    mainBtn.disabled = false;
  }

  updateStatus();
}

function init() {
  tabsEl.innerHTML = "";

  if (paneNames.length === 0) {
    numberEl.textContent = "—";
    questionEl.textContent = "لم يتم العثور على لوحات. تأكد من تحميل set1.js إلى set4.js.";
    statusEl.textContent = "";

    mainBtn.disabled = true;
    if (showAnswerBtn) showAnswerBtn.disabled = true;
    resetBtn.disabled = true;
    resetAllBtn.disabled = true;
    if (fullscreenBtn) fullscreenBtn.disabled = true;
    return;
  }

  // إنشاء أزرار التبويبات
  paneNames.forEach((name, idx) => {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.type = "button";
    btn.textContent = name;
    btn.dataset.pane = name;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", "false");
    btn.addEventListener("click", () => selectPane(name));
    tabsEl.appendChild(btn);

    if (idx === 0) activePane = name;
  });

  selectPane(activePane);

  resetBtn.disabled = false;
  resetAllBtn.disabled = false;

  updateFullscreenBtnLabel();
}

// ===============================
// الأحداث
// ===============================

// زر ابدأ/إيقاف مع قفل الضغطات السريعة
mainBtn.addEventListener("click", () => {
  if (!activePane) return;
  if (clickLocked) return;

  lockClicks(350);

  // تهيئة الصوت على iOS (لازم أول تفاعل)
  if (!audioCtx && soundToggle?.checked) beep(1, 1);

  if (!isRolling) {
    startRolling();
  } else {
    stopRolling();
    revealQuestionAndConsume();
  }
});

// زر إظهار الإجابة
if (showAnswerBtn) {
  showAnswerBtn.addEventListener("click", () => {
    if (!answerEl) return;
    // لا نسمح بإظهار الإجابة أثناء الاختيار
    if (isRolling) return;

    const isHidden = answerEl.hidden;
    answerEl.hidden = !isHidden;
    showAnswerBtn.textContent = isHidden ? "إخفاء الإجابة" : "إظهار الإجابة";

    // تأثيرات خفيفة عند الإظهار
    if (isHidden) {
      beep(520, 90);
      vibrate(25);
    }
  });
}

resetBtn.addEventListener("click", () => {
  if (clickLocked) return;
  lockClicks(250);
  resetCurrentPane();
});

resetAllBtn.addEventListener("click", () => {
  if (clickLocked) return;
  lockClicks(250);
  resetAllPanes();
});

// ملء الشاشة
if (fullscreenBtn) {
  fullscreenBtn.addEventListener("click", async () => {
    if (clickLocked) return;
    lockClicks(250);
    await toggleFullscreen();
    updateFullscreenBtnLabel();
  });

  document.addEventListener("fullscreenchange", updateFullscreenBtnLabel);
}

init();