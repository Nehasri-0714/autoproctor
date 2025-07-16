/**
 * MCQ Quiz for 360DigiTMG
 * Author: [Your Name/Team]
 */

// === CONFIG: AutoProctor Credentials ===
const CLIENT_ID = null; // INSERT YOUR ID HERE!!!!
const CLIENT_SECRET = null; // INSERT YOUR SECRET HERE!!!!

const getTestAttemptId = () => Math.random().toString(36).slice(2, 7);

function getHashTestAttemptId(testAttemptId) {
  if (CLIENT_SECRET === null) {
    return null;
  } else {
    const secretWordArray = CryptoJS.enc.Utf8.parse(CLIENT_SECRET);
    const messageWordArray = CryptoJS.enc.Utf8.parse(testAttemptId);
    const hash = CryptoJS.HmacSHA256(messageWordArray, secretWordArray);
    const base64HashedString = CryptoJS.enc.Base64.stringify(hash);
    return base64HashedString;
  }
}

function getCredentials() {
  const testAttemptId = getTestAttemptId();
  const hashedTestAttemptId = getHashTestAttemptId(testAttemptId);
  return {
    clientId: CLIENT_ID,
    testAttemptId,
    hashedTestAttemptId
  };
}

const getReportOptions = () => {
  return {
    groupReportsIntoTabs: true,
    userDetails: {
      name: "First Last",
      email: "user@gmail.com"
    }
  };
};

// === Proctor Setup ===
let proctorReady = false;

async function setupProctoring() {
  try {
    const creds = getCredentials();
    window.apconfig = {
      testCode: "LAuLBQfDu0",
      userId: creds.clientId,
      hashedTestAttemptId: creds.hashedTestAttemptId,
      startAutomatically: true
    };
    proctorReady = true;
  } catch (err) {
    snackbar('Unable to initialize proctor. Reload the page.', 7000);
    proctorReady = false;
  }
}

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
    snackbar("Quiz started. Good luck!", 1800);
  } catch (err) {
    snackbar('Unable to load questions. Please reload.', 5000);
  }
}

function renderQuestion() {
  const q = questions[currentIdx];
  $questionText.textContent = q.question;
  $optionsList.innerHTML = '';
  const opts = shuffle(q.options);
  opts.forEach(opt => {
    const row = document.createElement('div');
    row.className = 'option-row';
    const iid = `option_${currentIdx}_${opt.replace(/\W+/g,'')}`;
    const checked = answers[currentIdx] === opt;
    row.innerHTML = `
      <input type="radio" name="option" id="${iid}" value="${opt}" ${checked ? 'checked' : ''}/>
      <label class="option-label" tabindex="0" for="${iid}">
        <span class="option-bullet"></span>
        <span>${opt}</span>
      </label>
    `;
    row.querySelector('input').onchange = (e) => {
      answers[currentIdx] = e.target.value;
      row.classList.add('just-checked');
      setTimeout(()=>row.classList.remove('just-checked'), 500);
    };
    $optionsList.appendChild(row);
  });
  $progressText.textContent = `Question ${currentIdx+1} of ${questions.length}`;
  $progressBar.style.width = `${((currentIdx+1)/questions.length)*100}%`;
}

function shuffle(array) {
  let a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

function formatTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

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

function submitQuiz() {
  isLocked = true;
  clearInterval(timerHandle);
  $quizCard.classList.add('hide');
  setTimeout(() => {
    showResult();
    $resultCard.focus();
  }, 420);
}

function showResult() {
  let score = 0;
  for(let i=0;i<questions.length;i++) {
    if(answers[i] === questions[i].answer) score++;
  }
  $resultCard.classList.remove('hide');
  $resultCard.setAttribute('tabindex','0');
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
