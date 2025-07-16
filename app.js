/**
 * MCQ Quiz for 360DigiTMG
 * Author: [Your Name/Team]
 */

// === DOM Elements ===
const $startBtn = document.getElementById('startQuizBtn');
const $instructions = document.getElementById('instructionsCard');
const $quizCard = document.getElementById('quizCard');
const $resultCard = document.getElementById('resultCard');
const $timer = document.getElementById('timer');
const $snackbar = document.getElementById('snackbar');
const $pageFade = document.getElementById('pageFade');

const $questionText = document.getElementById('questionText');
const $optionsList = document.getElementById('optionsList');
const $progressText = document.getElementById('progressText');
const $progressBar = document.getElementById('progressBar');
const $prevBtn = document.getElementById('prevBtn');
const $nextBtn = document.getElementById('nextBtn');
const $submitBtn = document.getElementById('submitBtn');

// === Quiz State ===
let questions = [];
let currentIdx = 0;
let answers = [];
let timerSeconds = 0;
let timerHandle = null;
const maxTime = 20 * 60, numQuestions = 20;

let isLocked = false;

// === Utility ===
function shuffle(array) {
  let a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ==== Proctor Integration: SAFE API Fetch ====
let proctorReady = false;
async function setupProctoring() {
  try {
    // Fetch hashedTestAttemptId from backend REST API (should be auth-protected)
    const resp = await fetch('/api/getAutoproctorId', { credentials: 'include' });
    const data = await resp.json();
    window.apconfig = {
      testCode: "YOUR_AUTO_PROCTOR_TEST_CODE", // <-- replace as needed
      userId: data.userEmail, // should be from the current logged in session
      hashedTestAttemptId: data.hashedAttemptId,
      startAutomatically: true
    };
    proctorReady = true;
  } catch (err) {
    snackbar('Unable to initialize proctor. Reload the page.', 7000);
    proctorReady = false;
  }
}

// ==== Timer ====
function formatTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
function startTimer() {
  timerSeconds = maxTime;
  $timer.textContent = formatTime(timerSeconds);
  timerHandle = setInterval(() => {
    timerSeconds--;
    $timer.textContent = formatTime(timerSeconds);
    if(timerSeconds <= 60 && timerSeconds > 0)
      $timer.style.background = "#e57300";
    else if(timerSeconds === 0) {
      $timer.style.background = "#ad3322";
      clearInterval(timerHandle);
      submitQuiz();
    }
  }, 1000);
}

// ==== Loader: entrance fade ====
window.addEventListener('DOMContentLoaded', () => {
  $pageFade.classList.add('hide');
  setupProctoring();
});

// ==== Snackbar ====
function snackbar(msg, duration=2600) {
  $snackbar.textContent = msg;
  $snackbar.classList.add('show');
  setTimeout(() => $snackbar.classList.remove('show'), duration);
}

// ==== Start Quiz ====
$startBtn.onclick = async function() {
  if (!proctorReady) {
    snackbar("Quiz proctoring not ready...", 5000);
    return;
  }
  // Fade out instructions – microtransition
  $instructions.classList.add('hide');
  setTimeout(() => {
    $instructions.style.display="none";
    $quizCard.classList.remove('hide');
    $quizCard.focus();
  }, 300);
  fetchQuestions();
};

// ==== Fetch & Init Questions ====
async function fetchQuestions() {
  try {
    let res = await fetch('/questions.json');
    let data = await res.json();
    questions = data.slice(0, numQuestions);
    answers = Array(questions.length).fill(null);
    currentIdx = 0;
    renderQuestion();
    updateNav();
    startTimer();
    announceQuiz();
  } catch (err) {
    snackbar('Unable to load questions. Please reload.', 5000);
  }
}

function announceQuiz() {
  snackbar("Quiz started. Good luck!", 1800);
}

// ==== Render ====
function renderQuestion() {
  const q = questions[currentIdx];
  $questionText.textContent = q.question;
  $optionsList.innerHTML = '';
  // Option shuffling for randomness
  const opts = shuffle(q.options);
  opts.forEach(opt => {
    const row = document.createElement('div');
    row.className = 'option-row';
    // Checked status
    const iid = `option_${currentIdx}_${opt.replace(/\W+/g,'')}`;
    const checked = answers[currentIdx] === opt;
    row.innerHTML = `
      <input type="radio" name="option" id="${iid}" value="${opt}" ${checked ? 'checked' : ''}/>
      <label class="option-label" tabindex="0" for="${iid}">
        <span class="option-bullet"></span>
        <span>${opt}</span>
      </label>
    `;
    // Selection Event
    row.querySelector('input').onchange = (e) => {
      answers[currentIdx] = e.target.value;
      // Optionally, transient checkmark/animation
      row.classList.add('just-checked');
      setTimeout(()=>row.classList.remove('just-checked'), 500);
    };
    $optionsList.appendChild(row);
  });
  // Progress
  $progressText.textContent = `Question ${currentIdx+1} of ${questions.length}`;
  $progressBar.style.width = `${((currentIdx+1)/questions.length)*100}%`;

  // Accessibility
  setTimeout(()=> {
    $questionText.focus && $questionText.focus();
  }, 110);
}

// ==== Navigation ====
function updateNav() {
  $prevBtn.style.display = currentIdx > 0 ? '' : 'none';
  $nextBtn.style.display = currentIdx < questions.length-1 ? '' : 'none';
  $submitBtn.style.display = (currentIdx === questions.length-1) ? '' : 'none';
}

$prevBtn.onclick = function() {
  if (isLocked || currentIdx === 0) return;
  currentIdx--;
  renderQuestion();
  updateNav();
};
$nextBtn.onclick = function() {
  if (isLocked || currentIdx === questions.length-1) return;
  if (!answers[currentIdx]) return snackbar("Select an answer before proceeding.");
  currentIdx++;
  renderQuestion();
  updateNav();
};
$submitBtn.onclick = function() {
  if (isLocked) return;
  if (!answers[currentIdx]) return snackbar("Select an answer before submitting.");
  submitQuiz();
};

// ==== Submission Logic ====
function submitQuiz() {
  // Lock further interaction
  isLocked = true;
  clearInterval(timerHandle);
  $quizCard.classList.add('hide');
  setTimeout(() => {
    showResult();
    // Focus for accessibility, reader
    $resultCard.focus();
  }, 420);
}

function showResult() {
  let score = 0;
  for(let i=0;i<questions.length;i++) {
    if(answers[i] === questions[i].answer) score++;
  }
  // Celebrate with animated score + confetti emoji + CTA
  $resultCard.classList.remove('hide');
  $resultCard.setAttribute('tabindex','0');
  // Progressive Score Reveal (animated)
  $resultCard.innerHTML = `
    <div class="confetti-emoji">🎉</div>
    <div id="animatedScore" style="font-size:3.3rem; font-family: inherit; margin:14px 0;">Score: 0 / ${questions.length}</div>
    <div style="font-size:1.3rem; color:#444; margin:14px 0 26px 0; font-weight:400">
      ${score >= 16 ? "Excellent work!" : score >= 12 ? "Well done!" : score >= 8 ? "Keep going!" : "Review the concepts and try again!"}
    </div>
    <button class="button-primary" onclick="window.location.reload()">Retake Quiz</button>
  `;
  animateScoreReveal(score, questions.length);
}

function animateScoreReveal(score, total) {
  let displayed = 0;
  const $animated = document.getElementById('animatedScore');
  const interval = setInterval(() => {
    if(displayed > score) { clearInterval(interval); return; }
    $animated.textContent = `Score: ${displayed} / ${total}`;
    displayed++;
  }, Math.max(18, 140 - score*6));
}

// ==== Focus & Accessibility ====
window.onkeydown = e => {
  if(!$quizCard.classList.contains('hide')){
    if(e.key === "ArrowRight" && $nextBtn.style.display !== 'none') $nextBtn.click();
    if(e.key === "ArrowLeft" && $prevBtn.style.display !== 'none') $prevBtn.click();
  }
};
// Allow focus on first option after question render
$optionsList && $optionsList.addEventListener('keydown', function(e){
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    const radios = $optionsList.querySelectorAll('input[type="radio"]');
    let idx = Array.from(radios).findIndex(r=>r===document.activeElement);
    if(e.key === 'ArrowDown') idx = (idx+1)%radios.length;
    if(e.key === 'ArrowUp') idx = (idx-1+radios.length)%radios.length;
    radios[idx].focus();
  }
});

// ==== Micro-animations for engagement ====
// Transition overlays, highlight answer, cta pulse
