/**
 * AWS Quiz – Frontend Application
 * Handles quiz flow: start → questions → evaluation → results
 */

(() => {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────
  const state = {
    allQuestions: [],    // all questions from API
    questions: [],       // selected subset for this quiz
    currentIndex: 0,
    answers: [],         // user-selected index per question (null if unanswered)
    evaluated: [],       // boolean per question: has been evaluated?
    score: 0,
    phase: "loading",    // loading | start | quiz | results
    playerName: "",
    questionCount: 0,
  };

  const $main = document.getElementById("main-content");
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // ── Boot ───────────────────────────────────────────────────────────
  init();

  async function init() {
    try {
      const res = await fetch("/api/quiz");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.allQuestions = data.questions;
      state.phase = "start";
      render();
    } catch (err) {
      $main.innerHTML = `
        <div class="loading">
          <p class="loading__text" style="color: var(--color-incorrect);">
            Error al cargar las preguntas: ${err.message}
          </p>
        </div>`;
    }
  }

  // ── Render Router ──────────────────────────────────────────────────
  function render() {
    switch (state.phase) {
      case "start":   renderStart();   break;
      case "quiz":    renderQuiz();    break;
      case "results": renderResults(); break;
    }
  }

  // ── Start Screen ───────────────────────────────────────────────────
  function renderStart() {
    const totalAvailable = state.allQuestions.length;

    $main.innerHTML = `
      <div class="start-screen">
        <div class="start-screen__badge">📋 Examen de Práctica</div>
        <h1 class="start-screen__title">¿Estás listo para<br/>el desafío AWS?</h1>
        <p class="start-screen__desc">
          Pon a prueba tus conocimientos sobre los servicios y herramientas de
          Amazon Web Services. Las preguntas aparecerán en orden aleatorio.
        </p>

        <!-- Config form -->
        <div class="start-form">
          <div class="start-form__field">
            <label class="start-form__label" for="input-name">👤 Tu nombre</label>
            <input class="start-form__input" type="text" id="input-name"
              placeholder="Escribe tu nombre..." maxlength="40" autocomplete="off" />
          </div>
          <div class="start-form__field">
            <label class="start-form__label" for="input-count">📝 Cantidad de preguntas</label>
            <div class="start-form__range-wrap">
              <input class="start-form__range" type="range" id="input-count"
                min="5" max="${totalAvailable}" value="${totalAvailable}" step="1" />
              <span class="start-form__range-value" id="count-display">${totalAvailable}</span>
            </div>
            <span class="start-form__hint">Disponibles: ${totalAvailable}</span>
          </div>
        </div>

        <div class="start-screen__stats">
          <div class="stat">
            <div class="stat__value" id="stat-count">${totalAvailable}</div>
            <div class="stat__label">Preguntas</div>
          </div>
          <div class="stat">
            <div class="stat__value">∞</div>
            <div class="stat__label">Tiempo</div>
          </div>
          <div class="stat">
            <div class="stat__value">70%</div>
            <div class="stat__label">Para aprobar</div>
          </div>
        </div>
        <button class="btn btn--primary btn--lg" id="btn-start">
          Comenzar Quiz →
        </button>
      </div>`;

    // Range slider live update
    const rangeInput = document.getElementById("input-count");
    const countDisplay = document.getElementById("count-display");
    const statCount = document.getElementById("stat-count");
    rangeInput.addEventListener("input", () => {
      countDisplay.textContent = rangeInput.value;
      statCount.textContent = rangeInput.value;
    });

    document.getElementById("btn-start").addEventListener("click", () => {
      const nameInput = document.getElementById("input-name").value.trim();
      state.playerName = nameInput || "Participante";
      state.questionCount = parseInt(rangeInput.value);

      // Select the requested number of questions
      state.questions = state.allQuestions.slice(0, state.questionCount);
      state.answers = new Array(state.questionCount).fill(null);
      state.evaluated = new Array(state.questionCount).fill(false);
      state.score = 0;
      state.currentIndex = 0;

      state.phase = "quiz";
      render();
    });
  }

  // ── Quiz Screen ────────────────────────────────────────────────────
  function renderQuiz() {
    const q = state.questions[state.currentIndex];
    const i = state.currentIndex;
    const total = state.questions.length;
    const progress = ((i + 1) / total) * 100;
    const selected = state.answers[i];
    const evaluated = state.evaluated[i];
    const isCorrect = evaluated && selected === q.correct;

    let feedbackHTML = "";
    if (evaluated) {
      if (isCorrect) {
        feedbackHTML = `
          <div class="feedback feedback--correct">
            <span>✅</span> ¡Correcto! Bien hecho.
          </div>`;
      } else {
        feedbackHTML = `
          <div class="feedback feedback--incorrect">
            <span>❌</span>
            <div>
              Incorrecto.
              <span class="feedback__correct-answer">
                Respuesta correcta: <strong>${LETTERS[q.correct]})</strong> ${q.options[q.correct]}
              </span>
            </div>
          </div>`;
      }
    }

    const optionsHTML = q.options
      .map((opt, idx) => {
        let classes = "option-item";
        if (selected === idx) classes += " selected";
        if (evaluated) {
          classes += " disabled";
          if (idx === q.correct) classes += " correct";
          else if (idx === selected) classes += " incorrect";
        }
        return `
          <li class="${classes}" data-idx="${idx}">
            <span class="option-item__radio"></span>
            <span class="option-item__letter">${LETTERS[idx]})</span>
            <span class="option-item__label">${opt}</span>
          </li>`;
      })
      .join("");

    // Button logic
    const isLast = i === total - 1;
    let actionBtnHTML = "";

    if (!evaluated) {
      actionBtnHTML = `
        <button class="btn btn--primary" id="btn-evaluate" ${selected === null ? "disabled" : ""}>
          Evaluar ✓
        </button>`;
    } else if (isLast) {
      actionBtnHTML = `
        <button class="btn btn--primary" id="btn-finish">
          Ver Resultados 🏆
        </button>`;
    } else {
      actionBtnHTML = `
        <button class="btn btn--primary" id="btn-next">
          Siguiente →
        </button>`;
    }

    $main.innerHTML = `
      <!-- Progress -->
      <div class="progress-section">
        <div class="progress-info">
          <span class="progress-info__label">Progreso</span>
          <span class="progress-info__count">${i + 1} / ${total}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar__fill" style="width: ${progress}%"></div>
        </div>
      </div>

      <!-- Question -->
      <div class="question-card">
        <div class="question-card__number">Pregunta ${i + 1} de ${total}</div>
        <h2 class="question-card__text">${q.question}</h2>
        <ul class="options-list" id="options-list">
          ${optionsHTML}
        </ul>
      </div>

      <!-- Feedback -->
      ${feedbackHTML}

      <!-- Nav -->
      <div class="nav-buttons">
        <button class="btn btn--secondary" id="btn-prev" ${i === 0 ? "disabled" : ""}>
          ← Anterior
        </button>
        ${actionBtnHTML}
      </div>`;

    // ── Event Listeners ──
    // Option selection (only if not evaluated)
    if (!evaluated) {
      document.querySelectorAll("#options-list .option-item").forEach((el) => {
        el.addEventListener("click", () => {
          state.answers[i] = parseInt(el.dataset.idx);
          renderQuiz(); // re-render to update selection
        });
      });
    }

    // Previous
    const btnPrev = document.getElementById("btn-prev");
    if (btnPrev) {
      btnPrev.addEventListener("click", () => {
        if (state.currentIndex > 0) {
          state.currentIndex--;
          renderQuiz();
        }
      });
    }

    // Evaluate
    const btnEval = document.getElementById("btn-evaluate");
    if (btnEval) {
      btnEval.addEventListener("click", () => {
        state.evaluated[i] = true;
        if (state.answers[i] === q.correct) {
          state.score++;
        }
        renderQuiz();
      });
    }

    // Next
    const btnNext = document.getElementById("btn-next");
    if (btnNext) {
      btnNext.addEventListener("click", () => {
        state.currentIndex++;
        renderQuiz();
      });
    }

    // Finish
    const btnFinish = document.getElementById("btn-finish");
    if (btnFinish) {
      btnFinish.addEventListener("click", () => {
        state.phase = "results";
        render();
      });
    }
  }

  // ── Results Screen ─────────────────────────────────────────────────
  function renderResults() {
    const total = state.questions.length;
    const correct = state.score;
    const incorrect = total - correct;
    const pct = Math.round((correct / total) * 100);
    const passed = pct >= 70;

    // Score ring SVG
    const circumference = 2 * Math.PI * 76; // radius=76
    const offset = circumference - (pct / 100) * circumference;
    const ringColor = passed ? "var(--color-correct)" : "var(--color-incorrect)";

    // Review list
    const reviewHTML = state.questions
      .map((q, idx) => {
        const selected = state.answers[idx];
        const wasCorrect = selected === q.correct;
        const cls = wasCorrect ? "review-item--correct" : "review-item--incorrect";
        const userAnswer =
          selected !== null
            ? `${LETTERS[selected]}) ${q.options[selected]}`
            : "Sin respuesta";
        const correctAnswer = `${LETTERS[q.correct]}) ${q.options[q.correct]}`;

        return `
          <div class="review-item ${cls}">
            <div class="review-item__question">${idx + 1}. ${q.question}</div>
            <div class="review-item__answer">
              Tu respuesta: ${wasCorrect ? `<strong>${userAnswer}</strong>` : `<em>${userAnswer}</em>`}
              ${!wasCorrect ? `<br/>Correcta: <strong>${correctAnswer}</strong>` : ""}
            </div>
          </div>`;
      })
      .join("");

    $main.innerHTML = `
      <div class="results-screen">
        <div class="results-card">
          <div class="results-card__icon">${passed ? "🏆" : "📘"}</div>
          <h2 class="results-card__title">
            ${passed ? `¡Felicidades, ${state.playerName}! Aprobaste` : `${state.playerName}, sigue practicando`}
          </h2>
          <p class="results-card__subtitle">
            ${passed
              ? "Tu nivel de conocimiento de AWS es sólido."
              : "Necesitas un 70% para aprobar. ¡Inténtalo de nuevo!"}
          </p>

          <!-- Score Ring -->
          <div class="score-ring">
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle class="score-ring__bg" cx="90" cy="90" r="76" />
              <circle class="score-ring__fill"
                cx="90" cy="90" r="76"
                stroke="${ringColor}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${circumference}"
                id="score-ring-fill" />
            </svg>
            <div class="score-ring__text">
              <span class="score-ring__percent" id="score-pct">0%</span>
              <span class="score-ring__label">Aciertos</span>
            </div>
          </div>

          <!-- Stats -->
          <div class="results-stats">
            <div class="results-stat">
              <div class="results-stat__value results-stat__value--correct">${correct}</div>
              <div class="results-stat__label">Correctas</div>
            </div>
            <div class="results-stat">
              <div class="results-stat__value results-stat__value--incorrect">${incorrect}</div>
              <div class="results-stat__label">Incorrectas</div>
            </div>
            <div class="results-stat">
              <div class="results-stat__value results-stat__value--total">${total}</div>
              <div class="results-stat__label">Total</div>
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div style="display: flex; gap: var(--space-4); justify-content: center; flex-wrap: wrap;">
          <button class="btn btn--primary btn--lg" id="btn-retry">
            🔄 Reiniciar Quiz
          </button>
          <button class="btn btn--secondary btn--lg" id="btn-review">
            📋 Revisar Respuestas
          </button>
        </div>

        <!-- Review (hidden by default) -->
        <div class="review-toggle" id="review-section" style="display:none;">
          <div class="review-list">${reviewHTML}</div>
        </div>
      </div>`;

    // Animate score ring
    requestAnimationFrame(() => {
      const ring = document.getElementById("score-ring-fill");
      const pctEl = document.getElementById("score-pct");
      if (ring) {
        ring.style.strokeDashoffset = offset;
      }
      // Animate percentage counter
      animateCounter(pctEl, 0, pct, 1200);
    });

    // Retry
    document.getElementById("btn-retry").addEventListener("click", () => {
      // Re-fetch to get new random order
      state.phase = "loading";
      $main.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p class="loading__text">Cargando preguntas…</p>
        </div>`;
      init();
    });

    // Review toggle
    document.getElementById("btn-review").addEventListener("click", () => {
      const section = document.getElementById("review-section");
      const btn = document.getElementById("btn-review");
      if (section.style.display === "none") {
        section.style.display = "block";
        btn.textContent = "🙈 Ocultar Respuestas";
      } else {
        section.style.display = "none";
        btn.textContent = "📋 Revisar Respuestas";
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function animateCounter(el, start, end, duration) {
    const startTime = performance.now();
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      el.textContent = `${current}%`;
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }
    requestAnimationFrame(update);
  }
})();
