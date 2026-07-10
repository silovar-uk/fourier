const STORAGE_KEY = 'fourier-quest-state-v2';
const LEGACY_STORAGE_KEY = 'fourier-quest-state-v1';
const state = loadState();
let selectedModuleId = state.selectedModuleId || FOURIER_MODULES[0].id;
let activeFilter = 'all';
let activePreset = 'mix';
let quizIndex = state.quizIndex || 0;
let currentQuizView = null;

const els = {
  moduleList: document.getElementById('moduleList'),
  lessonPanel: document.getElementById('lessonPanel'),
  waveCanvas: document.getElementById('waveCanvas'),
  spectrumCanvas: document.getElementById('spectrumCanvas'),
  rankLabel: document.getElementById('rankLabel'),
  progressPercent: document.getElementById('progressPercent'),
  ringProgress: document.getElementById('ringProgress'),
  xpValue: document.getElementById('xpValue'),
  streakValue: document.getElementById('streakValue'),
  doneValue: document.getElementById('doneValue'),
  confidenceValue: document.getElementById('confidenceValue'),
  dailyMissionText: document.getElementById('dailyMissionText'),
  missionFeedback: document.getElementById('missionFeedback'),
  labSummary: document.getElementById('labSummary'),
  moduleDrawer: document.getElementById('moduleDrawer'),
  quizBox: document.getElementById('quizBox'),
  stuckNote: document.getElementById('stuckNote'),
  badgeGrid: document.getElementById('badgeGrid'),
  sourceList: document.getElementById('sourceList'),
  resetBtn: document.getElementById('resetBtn'),
  todayBtn: document.getElementById('todayBtn'),
  completeDailyBtn: document.getElementById('completeDailyBtn'),
  saveNoteBtn: document.getElementById('saveNoteBtn')
};

const controls = ['amp1', 'amp2', 'amp3', 'phase', 'noise'].map(id => document.getElementById(id));

init();

function init() {
  if (window.matchMedia('(max-width: 980px)').matches) els.moduleDrawer.removeAttribute('open');
  renderAll();
  drawLab();
  bindEvents();
  registerServiceWorker();
}

function bindEvents() {
  controls.forEach(input => input.addEventListener('input', () => {
    updateControlValues();
    drawLab();
  }));
  document.querySelectorAll('[data-prediction]').forEach(btn => {
    btn.addEventListener('click', () => choosePrediction(btn.dataset.prediction));
  });
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activePreset = btn.dataset.preset;
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
      applyPreset(activePreset);
      updateControlAvailability();
      drawLab();
    });
  });
  document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      document.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b === btn));
      renderModules();
    });
  });
  els.resetBtn.addEventListener('click', () => {
    if (!confirm('進捗・メモ・バッジをリセットしますか？')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    location.reload();
  });
  els.todayBtn.addEventListener('click', () => document.getElementById('daily').scrollIntoView({ behavior: 'smooth' }));
  els.completeDailyBtn.addEventListener('click', completeDaily);
  els.saveNoteBtn.addEventListener('click', saveNote);
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return normalizeState(stored ? JSON.parse(stored) : {});
  } catch {
    return getDefaultState();
  }
}

function normalizeState(saved) {
  const defaults = getDefaultState();
  return {
    ...defaults,
    ...saved,
    completed: { ...defaults.completed, ...(saved.completed || {}) },
    confidence: { ...defaults.confidence, ...(saved.confidence || {}) },
    badges: { ...defaults.badges, ...(saved.badges || {}) },
    quizCorrect: { ...defaults.quizCorrect, ...(saved.quizCorrect || {}) },
    moduleChecks: { ...defaults.moduleChecks, ...(saved.moduleChecks || {}) },
    labVisited: { ...defaults.labVisited, ...(saved.labVisited || {}) }
  };
}

function getDefaultState() {
  return {
    completed: {},
    confidence: {},
    xp: 0,
    streak: 0,
    lastDaily: null,
    notes: '',
    badges: {},
    quizCorrect: {},
    moduleChecks: {},
    labVisited: {},
    missionPrediction: null,
    quizIndex: 0,
    selectedModuleId: 'm01'
  };
}

function saveState() {
  state.selectedModuleId = selectedModuleId;
  state.quizIndex = quizIndex;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  renderStatus();
  renderDaily();
  renderModules();
  renderLesson();
  renderQuiz();
  renderBadges();
  renderSources();
  els.stuckNote.value = state.notes || '';
}

function renderStatus() {
  const total = FOURIER_MODULES.length;
  const done = Object.keys(state.completed).filter(id => state.completed[id]).length;
  const percent = Math.round((done / total) * 100);
  const avgConfidence = getAverageConfidence();
  els.progressPercent.textContent = `${percent}%`;
  els.ringProgress.style.strokeDashoffset = `${327 - (327 * percent / 100)}`;
  els.xpValue.textContent = state.xp;
  els.streakValue.textContent = `${state.streak || 0}日`;
  els.doneValue.textContent = `${done}/${total}`;
  els.confidenceValue.textContent = avgConfidence ? `${avgConfidence}/5` : '--';
  els.rankLabel.textContent = getRank(done, percent);
}

function getRank(done, percent) {
  if (percent === 100) return 'Fourier Navigator';
  if (done >= 8) return '大学入口';
  if (done >= 5) return 'スペクトル見習い';
  if (done >= 2) return '波形探索中';
  return '一歩目';
}

function getAverageConfidence() {
  const vals = Object.values(state.confidence).filter(Number.isFinite);
  if (!vals.length) return null;
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

function renderDaily() {
  const next = FOURIER_MODULES.find(m => !state.completed[m.id]) || FOURIER_MODULES[FOURIER_MODULES.length - 1];
  els.dailyMissionText.innerHTML = `位相だけを動かすと、<strong>周波数成分の強さ</strong>は変わる？ <span class="muted">予想後、ラボで位相を動かして確かめます。</span><br><small>次の学習：${next.title}（約${Math.min(15, next.minutes)}分）</small>`;
  document.querySelectorAll('[data-prediction]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.prediction === state.missionPrediction);
  });
  els.completeDailyBtn.disabled = !state.missionPrediction;
  els.missionFeedback.textContent = state.missionPrediction
    ? '予想を保存しました。「答えを確認する」で観察ポイントを表示します。'
    : '予想を選ぶと、波形ラボで確かめられます。';
}

function choosePrediction(prediction) {
  state.missionPrediction = prediction;
  saveState();
  renderDaily();
  activePreset = 'mix';
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.preset === 'mix'));
  applyPreset('mix');
  document.getElementById('phase').value = prediction === 'change' ? '0.20' : '2.60';
  updateControlValues();
  drawLab();
}

function renderModules() {
  const modules = activeFilter === 'all' ? FOURIER_MODULES : FOURIER_MODULES.filter(m => m.level === activeFilter);
  els.moduleList.innerHTML = modules.map((m, index) => {
    const realIndex = FOURIER_MODULES.findIndex(item => item.id === m.id) + 1;
    return `<li>
      <button class="module-card ${m.id === selectedModuleId ? 'active' : ''} ${state.completed[m.id] ? 'done' : ''}" data-id="${m.id}" type="button">
        <span class="module-no">${String(realIndex).padStart(2, '0')}</span>
        <span class="module-text"><strong>${m.title}</strong><span>${m.subtitle}</span></span>
        <span class="module-meta">${m.minutes}分 / ${m.xp}XP</span>
      </button>
    </li>`;
  }).join('');
  els.moduleList.querySelectorAll('.module-card').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedModuleId = btn.dataset.id;
      saveState();
      renderModules();
      renderLesson();
      if (window.matchMedia('(max-width: 980px)').matches) {
        els.moduleDrawer.removeAttribute('open');
        els.lessonPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function renderLesson() {
  const m = FOURIER_MODULES.find(item => item.id === selectedModuleId) || FOURIER_MODULES[0];
  const done = !!state.completed[m.id];
  const conf = state.confidence[m.id];

  els.lessonPanel.innerHTML = `
    <div class="lesson-top">
      <div>
        <p class="section-kicker">Module ${FOURIER_MODULES.findIndex(item => item.id === m.id) + 1}</p>
        <h2>${m.title}</h2>
        <p>${m.subtitle}</p>
      </div>
      <span class="level-pill">${levelLabel(m.level)} / ${m.minutes}分 / ${m.xp}XP</span>
    </div>
    <div class="concept-row">${m.concepts.map(c => `<span>${c}</span>`).join('')}</div>
    ${lessonTextBlock('到達目標', m.goal)}
    ${lessonTextBlock('高校生向けの言い換え', m.bridge)}
    ${lessonTextBlock('教科書メモ', m.textbook)}
    ${lessonTextBlock('本文', m.story)}
    ${lessonTextBlock('式の読み方', m.equation)}
    ${lessonListBlock('現実の世界では', m.realWorld)}
    ${lessonTextBlock('よくある誤解', m.commonMistake)}
    ${lessonListBlock('ドリル', m.drills)}
    ${lessonTextBlock('実務演習', m.practice)}
    ${lessonTextBlock('チェックポイント', m.checkpoint)}
    <div class="lesson-block lesson-lab-link">
      <h3>操作して確かめる</h3>
      <p>この章の説明を読むだけで終わらせず、波形と周波数成分を1回動かしてから理解チェックへ進みます。</p>
      <button class="secondary-button" id="openLessonLabBtn" type="button">${state.labVisited[m.id] ? 'ラボ確認済み ✓' : '波形ラボを開く'}</button>
    </div>
    <section class="lesson-check" id="lessonCheckBox" aria-labelledby="lessonCheckTitle"></section>
    <div class="confidence-row">
      <strong>今の自信</strong>
      <div class="confidence-buttons">
        ${[1,2,3,4,5].map(n => `<button class="${conf === n ? 'active' : ''}" data-confidence="${n}" type="button">${n}</button>`).join('')}
      </div>
    </div>
    <div class="action-row">
      <button class="primary-button" id="completeModuleBtn" type="button" ${done || isModuleReady(m.id) ? '' : 'disabled'}>${done ? '完了済みを取り消す' : 'ラボ＋2問正解で完了'}</button>
      <button class="secondary-button" id="nextModuleBtn" type="button">次の章へ</button>
    </div>
  `;
  document.getElementById('completeModuleBtn').addEventListener('click', () => toggleModule(m));
  document.getElementById('nextModuleBtn').addEventListener('click', goNextModule);
  document.getElementById('openLessonLabBtn').addEventListener('click', () => {
    state.labVisited[m.id] = true;
    saveState();
    renderLesson();
    document.getElementById('lab').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  renderLessonCheck(m);
  els.lessonPanel.querySelectorAll('[data-confidence]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.confidence[m.id] = Number(btn.dataset.confidence);
      saveState();
      renderLesson();
      renderStatus();
      showToast('自信度を保存しました');
    });
  });
}

function getLessonCheckQuestions(m) {
  const others = FOURIER_MODULES.filter(item => item.id !== m.id);
  return [
    {
      id: 'summary',
      question: 'この章の要点として最も適切なのは？',
      correct: m.checkpoint,
      distractors: [others[(FOURIER_MODULES.indexOf(m) + 2) % others.length].checkpoint, others[(FOURIER_MODULES.indexOf(m) + 5) % others.length].checkpoint]
    },
    {
      id: 'mistake',
      question: 'この章で避けたい誤解として最も近いものは？',
      correct: m.commonMistake,
      distractors: [others[(FOURIER_MODULES.indexOf(m) + 1) % others.length].commonMistake, others[(FOURIER_MODULES.indexOf(m) + 4) % others.length].commonMistake]
    }
  ];
}

function renderLessonCheck(m) {
  const box = document.getElementById('lessonCheckBox');
  const progress = state.moduleChecks[m.id] || {};
  const questions = getLessonCheckQuestions(m);
  const correctCount = questions.filter(q => progress[q.id]).length;
  box.innerHTML = `
    <h3 id="lessonCheckTitle">資料を閉じて理解チェック</h3>
    <p class="lesson-check-intro">2問とも正解すると、この章を完了できます。誤答しても何度でも試せます。</p>
    ${questions.map((q, questionIndex) => {
      const options = shuffleArray([q.correct, ...q.distractors].map(text => ({ text, correct: text === q.correct })));
      return `<div class="lesson-check-question" data-check-id="${q.id}">
        <strong>Q${questionIndex + 1}. ${q.question}</strong>
        <div class="lesson-check-options">${options.map(option => `<button class="lesson-check-option ${progress[q.id] && option.correct ? 'correct' : ''}" data-correct="${option.correct}" type="button" ${progress[q.id] ? 'disabled' : ''}>${option.text}</button>`).join('')}</div>
        <div class="lesson-check-feedback" aria-live="polite">${progress[q.id] ? '正解。自分の言葉でも説明してみよう。' : ''}</div>
      </div>`;
    }).join('')}
    <p class="lesson-check-status">現在 ${correctCount}/2問正解</p>
  `;
  box.querySelectorAll('.lesson-check-option').forEach(btn => {
    btn.addEventListener('click', () => answerLessonCheck(m, btn));
  });
}

function answerLessonCheck(m, btn) {
  const question = btn.closest('[data-check-id]');
  const checkId = question.dataset.checkId;
  const feedback = question.querySelector('.lesson-check-feedback');
  question.querySelectorAll('.lesson-check-option').forEach(option => option.classList.remove('wrong'));
  if (btn.dataset.correct === 'true') {
    state.moduleChecks[m.id] = { ...(state.moduleChecks[m.id] || {}), [checkId]: true };
    saveState();
    renderLesson();
    showToast(isModuleCheckPassed(m.id) ? '2問正解。この章を完了できます' : '正解。あと1問');
  } else {
    btn.classList.add('wrong');
    feedback.textContent = 'もう一度。章の「チェックポイント」か「よくある誤解」を読み直してみよう。';
  }
}

function isModuleCheckPassed(moduleId) {
  const progress = state.moduleChecks[moduleId] || {};
  return progress.summary === true && progress.mistake === true;
}

function isModuleReady(moduleId) {
  return state.labVisited[moduleId] === true && isModuleCheckPassed(moduleId);
}

function lessonTextBlock(title, body) {
  if (!body) return '';
  const paragraphs = String(body).split('\n').filter(Boolean).map(text => `<p>${text}</p>`).join('');
  return `<div class="lesson-block"><h3>${title}</h3>${paragraphs}</div>`;
}

function lessonListBlock(title, items) {
  if (!items || !items.length) return '';
  return `<div class="lesson-block"><h3>${title}</h3><ul>${items.map(item => `<li>${item}</li>`).join('')}</ul></div>`;
}

function levelLabel(level) {
  return { intro: '直感', math: '数学', applied: '応用', advanced: '大学' }[level] || level;
}

function toggleModule(m) {
  if (state.completed[m.id]) {
    delete state.completed[m.id];
    state.xp = Math.max(0, state.xp - m.xp);
  } else {
    if (!isModuleReady(m.id)) {
      showToast('先にラボを開き、理解チェック2問に正解してください');
      return;
    }
    state.completed[m.id] = new Date().toISOString();
    state.xp += m.xp;
    unlockBadge('first');
    const doneCount = Object.keys(state.completed).length;
    if (doneCount >= 5) unlockBadge('five');
    if (doneCount >= FOURIER_MODULES.length) unlockBadge('all');
  }
  saveState();
  renderAll();
}

function goNextModule() {
  const current = FOURIER_MODULES.findIndex(m => m.id === selectedModuleId);
  selectedModuleId = FOURIER_MODULES[Math.min(current + 1, FOURIER_MODULES.length - 1)].id;
  saveState();
  renderModules();
  renderLesson();
}

function completeDaily() {
  if (!state.missionPrediction) return;
  const today = getJapanDateKey();
  const correct = state.missionPrediction === 'same';
  els.missionFeedback.textContent = `${correct ? '予想どおり。' : '答えは「ほぼ変わらない」。'} 位相は波形の開始位置を変えますが、理想的なDFTの振幅スペクトルでは各周波数成分の強さは変わりません。`;
  if (state.lastDaily === today) {
    showToast('今日は完了済み。答えは何度でも確認できます');
    return;
  }
  const yesterday = getJapanDateKey(new Date(Date.now() - 86400000));
  state.streak = state.lastDaily === yesterday ? (state.streak || 0) + 1 : 1;
  state.lastDaily = today;
  state.xp += 15;
  if (state.streak >= 3) unlockBadge('daily3');
  saveState();
  renderStatus();
  renderBadges();
  showToast('今日の一手を完了。15XP獲得！');
}

function getJapanDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function saveNote() {
  state.notes = els.stuckNote.value.trim();
  if (state.notes) unlockBadge('note');
  saveState();
  renderBadges();
  showToast('つまずきログを保存しました');
}

function renderQuiz() {
  const q = FOURIER_QUIZ[quizIndex % FOURIER_QUIZ.length];
  currentQuizView = shuffleArray(q.options.map((text, originalIndex) => ({ text, originalIndex })));
  els.quizBox.innerHTML = `
    <p><strong>Q${quizIndex + 1}.</strong> ${q.question}</p>
    <div>${currentQuizView.map((opt, i) => `<button class="quiz-option" data-original-index="${opt.originalIndex}" type="button">${String.fromCharCode(65+i)}. ${opt.text}</button>`).join('')}</div>
    <div class="quiz-feedback" id="quizFeedback">答えを選ぶと解説が出ます。</div>
    <button class="secondary-button" id="nextQuizBtn" type="button">次の問題</button>
  `;
  els.quizBox.querySelectorAll('.quiz-option').forEach(btn => btn.addEventListener('click', () => answerQuiz(q, btn)));
  document.getElementById('nextQuizBtn').addEventListener('click', () => {
    quizIndex = (quizIndex + 1) % FOURIER_QUIZ.length;
    saveState();
    renderQuiz();
  });
}

function answerQuiz(q, btn) {
  const chosen = Number(btn.dataset.originalIndex);
  const feedback = document.getElementById('quizFeedback');
  els.quizBox.querySelectorAll('.quiz-option').forEach(option => {
    option.disabled = true;
    const originalIndex = Number(option.dataset.originalIndex);
    if (originalIndex === q.answer) option.classList.add('correct');
    if (option === btn && chosen !== q.answer) option.classList.add('wrong');
  });
  if (chosen === q.answer) {
    feedback.textContent = `正解。${q.explanation}`;
    const firstCorrect = !state.quizCorrect[q.id];
    state.quizCorrect[q.id] = true;
    if (firstCorrect) state.xp += 10;
    unlockBadge('quiz');
    if (!firstCorrect) feedback.textContent += ' この問題のXPは取得済みです。';
  } else {
    feedback.textContent = `惜しい。${q.explanation}`;
  }
  saveState();
  renderStatus();
  renderBadges();
}

function shuffleArray(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function unlockBadge(id) {
  state.badges[id] = true;
}

function renderBadges() {
  els.badgeGrid.innerHTML = FOURIER_BADGES.map(b => `
    <div class="badge ${state.badges[b.id] ? '' : 'locked'}">
      <span class="icon">${b.icon}</span>
      <strong>${b.title}</strong>
      <span>${b.condition}</span>
    </div>
  `).join('');
}

function renderSources() {
  els.sourceList.innerHTML = FOURIER_SOURCES.map(s => `
    <li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title}</a><p>${s.note}</p></li>
  `).join('');
}

function applyPreset(preset) {
  const values = {
    mix: [1.0, 0.55, 0.3, 0.8, 0.04],
    square: [1.00, 0.0, 0.0, 0.0, 0.0],
    chirp: [0.8, 0.55, 0.35, 1.4, 0.03]
  }[preset];
  ['amp1','amp2','amp3','phase','noise'].forEach((id, i) => document.getElementById(id).value = values[i]);
  updateControlValues();
}

function drawLab() {
  updateControlValues();
  drawWave();
  drawSpectrum();
}

function updateControlValues() {
  const format = (id, suffix = '') => {
    const input = document.getElementById(id);
    const output = document.getElementById(`${id}Value`);
    if (input && output) output.textContent = `${Number(input.value).toFixed(2)}${suffix}`;
  };
  format('amp1');
  format('amp2');
  format('amp3');
  format('phase', ' rad');
  format('noise');
}

function updateControlAvailability() {
  const disabledByPreset = {
    mix: [],
    square: ['amp2', 'amp3', 'phase'],
    chirp: ['amp3']
  }[activePreset] || [];
  controls.forEach(control => {
    control.disabled = disabledByPreset.includes(control.id);
    control.closest('label').style.opacity = control.disabled ? '.45' : '1';
  });
}

function getSignalSamples(n = 256) {
  const a1 = Number(document.getElementById('amp1').value);
  const a2 = Number(document.getElementById('amp2').value);
  const a3 = Number(document.getElementById('amp3').value);
  const phase = Number(document.getElementById('phase').value);
  const noise = Number(document.getElementById('noise').value);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    let y;
    if (activePreset === 'square') {
      y = a1 * Math.sign(Math.sin(2 * Math.PI * 3 * t));
    } else if (activePreset === 'chirp') {
      // 瞬時周波数 f(t)=2+10t を位相として積分すると 2t+5t^2 になる。
      y = a1 * Math.sin(2 * Math.PI * (2 * t + 5 * t * t) + phase) + a2 * Math.sin(2 * Math.PI * 4 * t);
    } else {
      y = a1 * Math.sin(2 * Math.PI * 2 * t) + a2 * Math.sin(2 * Math.PI * 5 * t + phase) + a3 * Math.sin(2 * Math.PI * 11 * t - phase / 2);
    }
    const deterministicNoise = noise * Math.sin(2 * Math.PI * 37 * t + 1.7) * Math.cos(2 * Math.PI * 19 * t);
    samples.push(y + deterministicNoise);
  }
  return samples;
}

function drawWave() {
  const canvas = els.waveCanvas;
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const samples = getSignalSamples(512);
  clearCanvas(ctx, w, h);
  drawGrid(ctx, w, h);
  const max = 3.2;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#fb7185';
  ctx.beginPath();
  samples.forEach((v, i) => {
    const x = i / (samples.length - 1) * w;
    const y = h / 2 - (v / max) * (h * 0.36);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  drawAxisLabels(ctx, w, h, { x: '時間 t（秒）', y: '振幅', maxY: max });
}

function drawSpectrum() {
  const canvas = els.spectrumCanvas;
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const samples = getSignalSamples(128);
  const mags = dftMagnitudes(samples).slice(1, 32);
  clearCanvas(ctx, w, h);
  drawGrid(ctx, w, h);
  const max = 0.8;
  const gap = 5;
  const barW = (w - gap * (mags.length + 1)) / mags.length;
  mags.forEach((m, i) => {
    const x = gap + i * (barW + gap);
    const bh = (m / max) * (h * 0.72);
    const grad = ctx.createLinearGradient(0, h - bh, 0, h);
    grad.addColorStop(0, '#22d3ee');
    grad.addColorStop(1, '#ef4444');
    ctx.fillStyle = grad;
    roundRect(ctx, x, h - bh - 24, barW, bh, 9);
    ctx.fill();
  });
  drawAxisLabels(ctx, w, h, { x: '周波数ビン k（1秒区間ではHz）', y: '振幅', maxY: max, nonNegative: true });
  const strongest = mags
    .map((value, index) => ({ value, bin: index + 1 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map(item => `${item.bin}Hz: ${item.value.toFixed(2)}`)
    .join('、');
  els.labSummary.textContent = `現在の主な成分：${strongest}。縦軸は0〜${max.toFixed(1)}で固定しているため、操作前後の強さを比較できます。`;
}

function dftMagnitudes(samples) {
  const n = samples.length;
  const mags = [];
  for (let k = 0; k < n / 2; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      re += samples[t] * Math.cos(angle);
      im += samples[t] * Math.sin(angle);
    }
    mags.push(Math.sqrt(re * re + im * im) / n);
  }
  return mags;
}

function clearCanvas(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(7, 10, 20, .88)';
  ctx.fillRect(0, 0, w, h);
}

function drawGrid(ctx, w, h) {
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += w / 8) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += h / 4) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
}

function drawLabel(ctx, text, x, y, align = 'left') {
  ctx.fillStyle = 'rgba(255,255,255,.58)';
  ctx.font = '700 15px "Noto Sans JP", system-ui, sans-serif';
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

function drawAxisLabels(ctx, w, h, { x, y, maxY, nonNegative = false }) {
  drawLabel(ctx, x, w - 18, h - 14, 'right');
  drawLabel(ctx, y, 18, 24);
  drawLabel(ctx, maxY.toFixed(1), 18, 48);
  if (nonNegative) {
    drawLabel(ctx, '0', 18, h - 34);
  } else {
    drawLabel(ctx, '0', 18, h / 2 - 8);
    drawLabel(ctx, `-${maxY.toFixed(1)}`, 18, h - 34);
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(registration => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('新しい版を準備しました。次回表示から反映します');
          }
        });
      });
    }).catch(() => {});
  }
}
