// ===============================
// عناصر الواجهة
// ===============================
const numberEl = document.getElementById("number");
const questionEl = document.getElementById("question");
const statusEl = document.getElementById("status");

const tabsEl = document.getElementById("tabs");
const mainBtn = document.getElementById("mainBtn");
const resetBtn = document.getElementById("resetBtn");
const resetAllBtn = document.getElementById("resetAllBtn");

const fullscreenBtn = document.getElementById("fullscreenBtn");
const soundToggle = document.getElementById("soundToggle");
const vibrateToggle = document.getElementById("vibrateToggle");

// مجموعات الأسئلة من ملفات set1..set4
const sets = window.QUESTION_SETS || {};
const paneNames = Object.keys(sets);

let activePane = null;

let isRolling = false;
let rollTimer = null;
let currentIndex = null;

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
      const remaining = (remainingByPane.get(activePane) || []).length;
      if (remaining > 0 || isRolling) mainBtn.disabled = false;
    } else {
      mainBtn.disabled = false;
    }
  }, ms);
}

// ===============================
// منطق الأسئلة
// ===============================
function buildIndexesForPane(paneName) {
  const list = sets[paneName] || [];
  return Array.from({ length: list.length }, (_, i) => i);
}

function ensurePaneState(paneName) {
  if (!remainingByPane.has(paneName)) {
    remainingByPane.set(paneName, buildIndexesForPane(paneName));
  }
}

function updateStatus() {
  if (!activePane) {
    statusEl.textContent = "";
    return;
  }
  const total = (sets[activePane] || []).length;
  const remaining = (remainingByPane.get(activePane) || []).length;
  const used = total - remaining;

  statusEl.textContent =
    `اللوحة: ${activePane} • المستخدم: ${toArabicDigits(used)}/${toArabicDigits(total)} • المتبقي: ${toArabicDigits(remaining)}`;
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

  mainBtn.textContent = "ابدأ";
  mainBtn.classList.remove("stop");

  setTabsDisabled(false);
}

function getRandomRemainingIndex(paneName) {
  const remaining = remainingByPane.get(paneName);
  const r = Math.floor(Math.random() * remaining.length);
  return remaining[r];
}

function startRolling() {
  if (!activePane) return;

  const list = sets[activePane] || [];
  ensurePaneState(activePane);
  const remaining = remainingByPane.get(activePane);

  if (list.length === 0) {
    numberEl.textContent = "—";
    questionEl.textContent = "هذه اللوحة لا تحتوي على أسئلة.";
    stopRolling();
    updateStatus();
    return;
  }

  if (remaining.length === 0) {
    numberEl.textContent = "—";
    questionEl.textContent = "تم استخدام جميع الأسئلة في هذه اللوحة.";
    stopRolling();
    updateStatus();
    mainBtn.disabled = true;
    return;
  }

  isRolling = true;

  mainBtn.textContent = "إيقاف";
  mainBtn.classList.add("stop");

  questionEl.textContent = "جاري الاختيار...";
  setTabsDisabled(true);

  rollTimer = setInterval(() => {
    currentIndex = getRandomRemainingIndex(activePane);
    // عرض رقم السؤال للمستخدم (1..N) وبأرقام عربية
    numberEl.textContent = toArabicDigits(currentIndex + 1);
  }, 60);
}

function revealQuestionAndConsume() {
  if (!activePane) return;

  const list = sets[activePane] || [];
  const remaining = remainingByPane.get(activePane) || [];

  if (currentIndex === null || remaining.length === 0) return;

  // إزالة الرقم حتى لا يظهر مجددًا
  remainingByPane.set(
    activePane,
    remaining.filter(i => i !== currentIndex)
  );

  // عرض السؤال
  questionEl.textContent = list[currentIndex];

  // تأثيرات
  beep(880, 120);
  setTimeout(() => beep(660, 120), 130);
  vibrate([40, 30, 40]);

  updateStatus();

  // إذا انتهت الأسئلة
  if (remainingByPane.get(activePane).length === 0) {
    mainBtn.disabled = true;
    questionEl.textContent += " (هذا آخر سؤال)";
  }
}

function selectPane(paneName) {
  stopRolling();

  activePane = paneName;
  ensurePaneState(activePane);

  // تحديث شكل التبويبات
  tabsEl.querySelectorAll("button.tab").forEach(btn => {
    const isActive = btn.dataset.pane === paneName;
    btn.setAttribute("aria-selected", String(isActive));
  });

  currentIndex = null;
  numberEl.textContent = "—";
  questionEl.textContent = "اضغط ابدأ";

  // تفعيل/تعطيل زر ابدأ حسب وجود أسئلة متبقية
  const remaining = (remainingByPane.get(activePane) || []).length;
  mainBtn.disabled = remaining === 0;

  updateStatus();
}

function resetCurrentPane() {
  if (!activePane) return;

  remainingByPane.set(activePane, buildIndexesForPane(activePane));
  currentIndex = null;

  numberEl.textContent = "—";
  questionEl.textContent = "تمت إعادة تعيين اللوحة. اضغط ابدأ.";
  mainBtn.disabled = false;

  stopRolling();
  updateStatus();
}

function resetAllPanes() {
  for (const name of paneNames) {
    remainingByPane.set(name, buildIndexesForPane(name));
  }
  currentIndex = null;

  numberEl.textContent = "—";
  questionEl.textContent = "تمت إعادة تعيين جميع اللوحات. اضغط ابدأ.";
  mainBtn.disabled = false;

  stopRolling();
  updateStatus();
}

function init() {
  tabsEl.innerHTML = "";

  if (paneNames.length === 0) {
    numberEl.textContent = "—";
    questionEl.textContent = "لم يتم العثور على لوحات. تأكد من تحميل set1.js إلى set4.js.";
    statusEl.textContent = "";

    mainBtn.disabled = true;
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
