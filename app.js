const STORAGE_KEY = 'fourier-quest-state-v1';
const state = loadState();
let selectedModuleId = state.selectedModuleId || FOURIER_MODULES[0].id;
let activeFilter = 'all';
let activePreset = 'mix';
let quizIndex = state.quizIndex || 0;

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
  renderAll();
  drawLab();
  bindEvents();
  registerServiceWorker();
}

function bindEvents() {
  controls.forEach(input => input.addEventListener('input', drawLab));
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activePreset = btn.dataset.preset;
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
      applyPreset(activePreset);
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
    location.reload();
  });
  els.todayBtn.addEventListener('click', () => document.getElementById('daily').scrollIntoView({ behavior: 'smooth' }));
  els.completeDailyBtn.addEventListener('click', completeDaily);
  els.saveNoteBtn.addEventListener('click', saveNote);
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || getDefaultState();
  } catch {
    return getDefaultState();
  }
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
  els.dailyMissionText.innerHTML = `<strong>${next.title}</strong>：${next.drills[0]} <br><span class="muted">目安 ${Math.min(15, next.minutes)}分。完璧に理解するより、今日も接触することを勝ちにする。</span>`;
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
    <div class="lesson-block"><h4>到達目標</h4><p>${m.goal}</p></div>
    <div class="lesson-block"><h4>本文</h4><p>${m.story}</p></div>
    <div class="lesson-block"><h4>ドリル</h4><ul>${m.drills.map(d => `<li>${d}</li>`).join('')}</ul></div>
    <div class="lesson-block"><h4>実務演習</h4><p>${m.practice}</p></div>
    <div class="lesson-block"><h4>チェックポイント</h4><p>${m.checkpoint}</p></div>
    <div class="confidence-row">
      <strong>今の自信</strong>
      <div class="confidence-buttons">
        ${[1,2,3,4,5].map(n => `<button class="${conf === n ? 'active' : ''}" data-confidence="${n}" type="button">${n}</button>`).join('')}
      </div>
    </div>
    <div class="action-row">
      <button class="primary-button" id="completeModuleBtn" type="button">${done ? '完了済みを取り消す' : 'この章を完了'}</button>
      <button class="secondary-button" id="nextModuleBtn" type="button">次の章へ</button>
    </div>
  `;
  document.getElementById('completeModuleBtn').addEventListener('click', () => toggleModule(m));
  document.getElementById('nextModuleBtn').addEventListener('click', goNextModule);
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

function levelLabel(level) {
  return { intro: '直感', math: '数学', applied: '応用', advanced: '大学' }[level] || level;
}

function toggleModule(m) {
  if (state.completed[m.id]) {
    delete state.completed[m.id];
    state.xp = Math.max(0, state.xp - m.xp);
  } else {
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
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastDaily === today) {
    showToast('今日はもう完了済み。えらい。');
    return;
  }
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak = state.lastDaily === yesterday ? (state.streak || 0) + 1 : 1;
  state.lastDaily = today;
  state.xp += 15;
  if (state.streak >= 3) unlockBadge('daily3');
  saveState();
  renderStatus();
  renderBadges();
  showToast('今日の一手を完了。15XP獲得！');
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
  els.quizBox.innerHTML = `
    <p><strong>Q${quizIndex + 1}.</strong> ${q.question}</p>
    <div>${q.options.map((opt, i) => `<button class="quiz-option" data-index="${i}" type="button">${String.fromCharCode(65+i)}. ${opt}</button>`).join('')}</div>
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
  const chosen = Number(btn.dataset.index);
  const feedback = document.getElementById('quizFeedback');
  els.quizBox.querySelectorAll('.quiz-option').forEach((option, i) => {
    option.disabled = true;
    if (i === q.answer) option.classList.add('correct');
    if (i === chosen && chosen !== q.answer) option.classList.add('wrong');
  });
  if (chosen === q.answer) {
    feedback.textContent = `正解。${q.explanation}`;
    state.quizCorrect[quizIndex] = true;
    state.xp += 10;
    unlockBadge('quiz');
  } else {
    feedback.textContent = `惜しい。${q.explanation}`;
  }
  saveState();
  renderStatus();
  renderBadges();
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
    square: [1.25, 0.0, 0.42, 0.0, 0.0],
    chirp: [0.8, 0.55, 0.35, 1.4, 0.03]
  }[preset];
  ['amp1','amp2','amp3','phase','noise'].forEach((id, i) => document.getElementById(id).value = values[i]);
}

function drawLab() {
  drawWave();
  drawSpectrum();
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
      y = a1 * Math.sign(Math.sin(2 * Math.PI * 3 * t)) + a3 * Math.sin(2 * Math.PI * 9 * t) / 3;
    } else if (activePreset === 'chirp') {
      const f = 2 + 10 * t;
      y = a1 * Math.sin(2 * Math.PI * f * t + phase) + a2 * Math.sin(2 * Math.PI * 4 * t);
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
  const max = Math.max(1, ...samples.map(v => Math.abs(v)));
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#fb7185';
  ctx.beginPath();
  samples.forEach((v, i) => {
    const x = i / (samples.length - 1) * w;
    const y = h / 2 - (v / max) * (h * 0.36);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  drawLabel(ctx, 'time', 18, h - 18);
}

function drawSpectrum() {
  const canvas = els.spectrumCanvas;
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const samples = getSignalSamples(128);
  const mags = dftMagnitudes(samples).slice(1, 32);
  clearCanvas(ctx, w, h);
  drawGrid(ctx, w, h);
  const max = Math.max(0.01, ...mags);
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
  drawLabel(ctx, 'frequency bins', 18, h - 18);
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

function drawLabel(ctx, text, x, y) {
  ctx.fillStyle = 'rgba(255,255,255,.58)';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText(text, x, y);
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
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
