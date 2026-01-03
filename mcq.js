(function () {
  const sets = window.MCQ_SETS || {};

  const setSelect = document.getElementById("setSelect");
  const startBtn = document.getElementById("startBtn");
  const checkBtn = document.getElementById("checkBtn");
  const restartBtn = document.getElementById("restartBtn");

  const statusText = document.getElementById("statusText");
  const quizEl = document.getElementById("quiz");
  const resultEl = document.getElementById("result");

  const summary = document.getElementById("summary");
  const sumAnswered = document.getElementById("sumAnswered");
  const sumCorrect = document.getElementById("sumCorrect");
  const sumScore = document.getElementById("sumScore");
  const sumPercent = document.getElementById("sumPercent");

  const letters = ["A", "B", "C", "D"];

  function normalizePoints(p) {
    const n = Number(p);
    return Number.isFinite(n) ? n : 0;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Populate sets
  const setNames = Object.keys(sets);
  if (setNames.length === 0) {
    setSelect.innerHTML = `<option value="">لا توجد مجموعات</option>`;
    startBtn.disabled = true;
    statusText.textContent = "أضف أسئلة في mcq-data.js";
    return;
  }

  setSelect.innerHTML = setNames.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");

  let currentSetName = setNames[0];
  let questions = [];
  let userAnswers = {}; // { [index]: "A"|"B"|"C"|"D" }
  let checked = false;

  function resetAll() {
    quizEl.innerHTML = "";
    resultEl.style.display = "none";
    resultEl.innerHTML = "";

    summary.style.display = "none";
    sumAnswered.textContent = "تمت الإجابة: 0";
    sumCorrect.textContent = "إجابات صحيحة: 0";
    sumScore.textContent = "النقاط: 0";
    sumPercent.textContent = "النسبة: 0%";

    userAnswers = {};
    checked = false;

    checkBtn.disabled = true;
    restartBtn.style.display = "none";
    startBtn.style.display = "";
    setSelect.disabled = false;

    statusText.textContent = "اختر مجموعة ثم اضغط بدء";
  }

  function renderAllQuestions() {
    quizEl.innerHTML = "";

    questions.forEach((q, i) => {
      const pts = normalizePoints(q.points);
      const card = document.createElement("div");
      card.className = "qcard";
      card.dataset.index = String(i);

      const optsHtml = letters.map(L => {
        const txt = q[L] ?? "";
        const name = `q_${i}`;
        const id = `q_${i}_${L}`;
        const checkedAttr = userAnswers[i] === L ? "checked" : "";
        return `
          <label class="opt" for="${id}">
            <input ${checkedAttr} id="${id}" type="radio" name="${name}" value="${L}">
            <div><strong>${L})</strong> ${escapeHtml(txt)}</div>
          </label>
        `;
      }).join("");

      card.innerHTML = `
        <div class="qhead">
          <div class="qnum">سؤال ${i + 1}</div>
          <div class="qpts">النقاط: ${pts}</div>
        </div>
        <div class="qtext">${escapeHtml(q.question || "")}</div>
        <div class="opts">${optsHtml}</div>
        <div class="qbadge" style="display:none;"></div>
      `;

      // Listen changes
      card.querySelectorAll("input[type=radio]").forEach((radio) => {
        radio.addEventListener("change", () => {
          if (checked) return; // after check, lock answers
          userAnswers[i] = radio.value;
          checkBtn.disabled = Object.keys(userAnswers).length === 0; // enable once any answered
          statusText.textContent = `تمت الإجابة عن ${Object.keys(userAnswers).length} سؤال`;
        });
      });

      quizEl.appendChild(card);
    });

    summary.style.display = "";
    statusText.textContent = "أجب ما تريد ثم اضغط تحقّق";
  }

  function computeAndMark() {
    checked = true;
    setSelect.disabled = true;
    startBtn.style.display = "none";
    restartBtn.style.display = "";

    let answeredCount = 0;
    let correctCount = 0;

    let earned = 0;          // points earned (only from answered & correct)
    let possibleAnswered = 0; // total possible points ONLY for answered questions

    questions.forEach((q, i) => {
      const ans = userAnswers[i] || null;
      const pts = normalizePoints(q.points);
      const card = quizEl.querySelector(`.qcard[data-index="${i}"]`);
      const badge = card.querySelector(".qbadge");

      // lock inputs
      card.querySelectorAll("input[type=radio]").forEach(r => r.disabled = true);

      badge.style.display = "";

      if (!ans) {
        // not answered (ignored)
        badge.innerHTML = `<span class="miss">⏳ لم يُجب</span>`;
        return;
      }

      answeredCount += 1;
      possibleAnswered += pts;

      if (ans === q.correct) {
        correctCount += 1;
        earned += pts;
        card.classList.add("correct");
        badge.innerHTML = `<span class="ok">✅ صحيح</span>`;
      } else {
        card.classList.add("wrong");
        badge.innerHTML = `<span class="no">❌ خطأ</span> — الصحيح: <strong>${escapeHtml(q.correct)}</strong>`;
      }

      // optional: visually outline the correct option
      const correctId = `q_${i}_${q.correct}`;
      const correctInput = document.getElementById(correctId);
      if (correctInput) correctInput.closest(".opt")?.classList.add("correct");
    });

    const percent = possibleAnswered > 0 ? Math.round((earned / possibleAnswered) * 100) : 0;

    sumAnswered.textContent = `تمت الإجابة: ${answeredCount} / ${questions.length}`;
    sumCorrect.textContent = `إجابات صحيحة: ${correctCount} / ${answeredCount || 0}`;
    sumScore.textContent = `النقاط: ${earned} / ${possibleAnswered}`;
    sumPercent.textContent = `النسبة: ${percent}%`;

    resultEl.style.display = "";
    resultEl.innerHTML = `
      <h2 style="margin:0 0 10px">✅ تم التصحيح</h2>
      <div style="opacity:.9; line-height:1.8">
        <div>المجموعة: <strong>${escapeHtml(currentSetName)}</strong></div>
        <div>أجبت على: <strong>${answeredCount}</strong> من <strong>${questions.length}</strong></div>
        <div>مجموع نقاط الأسئلة المُجابة: <strong>${possibleAnswered}</strong></div>
        <div>نقاطك الصحيحة: <strong>${earned}</strong></div>
        <div>النسبة (على المُجاب فقط): <strong>${percent}%</strong></div>
      </div>
    `;

    statusText.textContent = "انتهى التصحيح";
    checkBtn.disabled = true;
  }

  function start() {
    currentSetName = setSelect.value || setNames[0];
    questions = Array.isArray(sets[currentSetName]) ? sets[currentSetName].slice() : [];
	// 🔀 shuffle الأسئلة للمجموعة المختارة فقط (مرة واحدة)
	shuffleArrayOnce(questions);
    
	userAnswers = {};
    checked = false;

    if (questions.length === 0) {
      quizEl.innerHTML = "";
      resultEl.style.display = "";
      resultEl.innerHTML = `<p>لا توجد أسئلة في هذه المجموعة.</p>`;
      statusText.textContent = "لا توجد أسئلة";
      return;
    }

    setSelect.disabled = false;
    startBtn.style.display = "none";
    restartBtn.style.display = "";
    checkBtn.disabled = true; // enable after any answer

    renderAllQuestions();
  }

function shuffleArrayOnce(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

  function restart() {
    resetAll();
  }

  // events
  setSelect.addEventListener("change", () => {
    if (checked) return;
    currentSetName = setSelect.value;
    statusText.textContent = "اختر مجموعة ثم اضغط بدء";
  });

  startBtn.addEventListener("click", start);
  restartBtn.addEventListener("click", restart);
  checkBtn.addEventListener("click", computeAndMark);

  resetAll();
})();
