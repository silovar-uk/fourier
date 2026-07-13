const STORAGE_KEY = 'fourier-quest-state-v2';
const LEGACY_STORAGE_KEY = 'fourier-quest-state-v1';
const state = loadState();
let selectedModuleId = state.selectedModuleId || FOURIER_MODULES[0].id;
let activeFilter = 'all';
let activePreset = 'mix';
let quizIndex = state.quizIndex || 0;
let currentQuizView = null;
let activeScreen = 'home';
let activeLabModuleId = null;

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
  labSummary: document.getElementById('labSummary'),
  quizBox: document.getElementById('quizBox'),
  stuckNote: document.getElementById('stuckNote'),
  badgeGrid: document.getElementById('badgeGrid'),
  sourceList: document.getElementById('sourceList'),
  resetBtn: document.getElementById('resetBtn'),
  saveNoteBtn: document.getElementById('saveNoteBtn'),
  topProgressBar: document.getElementById('topProgressBar'),
  mapDialog: document.getElementById('mapDialog'),
  openMapBtn: document.getElementById('openMapBtn'),
  openMapFromLessonBtn: document.getElementById('openMapFromLessonBtn'),
  closeMapBtn: document.getElementById('closeMapBtn'),
  continueModuleNo: document.getElementById('continueModuleNo'),
  continueTitle: document.getElementById('continueTitle'),
  continueSubtitle: document.getElementById('continueSubtitle'),
  continueStepLabel: document.getElementById('continueStepLabel'),
  continueStepTitle: document.getElementById('continueStepTitle'),
  continueMinutes: document.getElementById('continueMinutes'),
  continueLessonBtn: document.getElementById('continueLessonBtn'),
  continueCard: document.getElementById('continueCard'),
  journeyPreview: document.getElementById('journeyPreview'),
  returnToLessonBtn: document.getElementById('returnToLessonBtn'),
  labMissionTitle: document.getElementById('labMissionTitle'),
  labMissionInstruction: document.getElementById('labMissionInstruction'),
  labMissionStatus: document.getElementById('labMissionStatus'),
  sampleCount: document.getElementById('sampleCount'),
  windowToggle: document.getElementById('windowToggle'),
  sampleCountValue: document.getElementById('sampleCountValue'),
  windowToggleValue: document.getElementById('windowToggleValue'),
  labGrid: document.querySelector('.lab-grid'),
  controlPanel: document.querySelector('.control-panel'),
  toggleAllControlsBtn: document.getElementById('toggleAllControlsBtn')
};

const controls = ['amp1', 'amp2', 'amp3', 'phase', 'noise', 'sampleCount'].map(id => document.getElementById(id));

init();

function init() {
  if (!isModuleUnlocked(selectedModuleId)) {
    selectedModuleId = getCurrentModule().id;
  }
  renderAll();
  drawLab();
  bindEvents();
  registerServiceWorker();
}

function bindEvents() {
  controls.forEach(input => input.addEventListener('input', () => {
    markLabInteraction(input.id);
    updateControlValues();
    drawLab();
  }));
  els.windowToggle.addEventListener('change', () => {
    markLabInteraction('windowToggle');
    updateControlValues();
    drawLab();
  });
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activePreset = btn.dataset.preset;
      document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
      applyPreset(activePreset);
      updateControlAvailability();
      markLabInteraction('preset');
      drawLab();
    });
  });
  document.querySelectorAll('.mobile-graph-tabs [data-mobile-graph]').forEach(btn => {
    btn.addEventListener('click', () => setMobileGraph(btn.dataset.mobileGraph));
  });
  els.toggleAllControlsBtn.addEventListener('click', () => {
    const showAll = els.controlPanel.classList.toggle('show-all');
    els.toggleAllControlsBtn.textContent = showAll ? '章のつまみだけ' : 'ほかのつまみ';
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
  els.saveNoteBtn.addEventListener('click', saveNote);
  document.querySelectorAll('[data-screen-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.screenTarget === 'lab') activeLabModuleId = null;
      showScreen(btn.dataset.screenTarget);
    });
  });
  els.continueLessonBtn.addEventListener('click', () => {
    const current = getCurrentModule();
    selectedModuleId = current.id;
    saveState();
    renderLesson();
    showScreen('learn');
  });
  els.returnToLessonBtn.addEventListener('click', () => {
    if (activeLabModuleId && !state.labVisited[activeLabModuleId]) {
      showToast('指定された操作をひとつ試してみよう');
      return;
    }
    showScreen('learn');
  });
  [els.openMapBtn, els.openMapFromLessonBtn].forEach(btn => btn.addEventListener('click', openMap));
  els.closeMapBtn.addEventListener('click', () => els.mapDialog.close());
  els.mapDialog.addEventListener('click', event => {
    if (event.target === els.mapDialog) els.mapDialog.close();
  });
}

function showScreen(name) {
  activeScreen = name;
  document.querySelectorAll('[data-screen]').forEach(screen => {
    screen.classList.toggle('active', screen.dataset.screen === name);
  });
  document.querySelectorAll('.bottom-nav [data-screen-target]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.screenTarget === name);
  });
  if (name === 'learn') renderLesson();
  if (name === 'lab') {
    renderLabMission();
    drawLab();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMap() {
  renderModules();
  if (typeof els.mapDialog.showModal === 'function') els.mapDialog.showModal();
  else els.mapDialog.setAttribute('open', '');
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
    labVisited: { ...defaults.labVisited, ...(saved.labVisited || {}) },
    lessonStepByModule: { ...defaults.lessonStepByModule, ...(saved.lessonStepByModule || {}) },
    lessonPredictions: { ...defaults.lessonPredictions, ...(saved.lessonPredictions || {}) },
    lessonExplanations: { ...defaults.lessonExplanations, ...(saved.lessonExplanations || {}) }
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
    lessonStepByModule: {},
    lessonPredictions: {},
    lessonExplanations: {},
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
  renderHome();
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
  els.topProgressBar.style.width = `${percent}%`;
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

function getCurrentModule() {
  return FOURIER_MODULES.find(m => !state.completed[m.id]) || FOURIER_MODULES[FOURIER_MODULES.length - 1];
}

function isModuleUnlocked(moduleId) {
  const index = FOURIER_MODULES.findIndex(m => m.id === moduleId);
  if (index <= 0) return index === 0;
  return !!state.completed[moduleId] || !!state.completed[FOURIER_MODULES[index - 1].id];
}

function renderHome() {
  const current = getCurrentModule();
  const index = FOURIER_MODULES.indexOf(current);
  const steps = getLessonSteps(current);
  const stepCount = steps.length;
  const step = Math.min(state.lessonStepByModule[current.id] || 0, stepCount - 1);
  els.continueModuleNo.textContent = String(index + 1).padStart(2, '0');
  els.continueTitle.textContent = current.title;
  els.continueSubtitle.textContent = current.subtitle;
  els.continueStepLabel.textContent = `STEP ${step + 1} / ${stepCount}`;
  els.continueStepTitle.textContent = steps[step].title;
  els.continueMinutes.textContent = `この一歩 約${Math.max(3, Math.ceil(current.minutes / stepCount))}分`;
  els.continueLessonBtn.textContent = '→';
  els.continueLessonBtn.setAttribute('aria-label', `${step ? 'つづきから' : 'はじめる'}：${steps[step].title}`);
  const visible = [index - 1, index, index + 1].filter(i => i >= 0 && i < FOURIER_MODULES.length);
  els.journeyPreview.innerHTML = visible.map(i => {
    const m = FOURIER_MODULES[i];
    const status = state.completed[m.id] ? 'done' : i === index ? 'current' : 'locked';
    const mark = status === 'done' ? '✓' : String(i + 1).padStart(2, '0');
    return `<div class="journey-node ${status}"><div class="journey-dot">${mark}</div><strong>${i === index ? 'いまここ' : status === 'done' ? 'クリア' : 'つぎ'}</strong><small>${m.title}</small></div>`;
  }).join('');
}

function renderModules() {
  const modules = activeFilter === 'all' ? FOURIER_MODULES : FOURIER_MODULES.filter(m => m.level === activeFilter);
  els.moduleList.innerHTML = modules.map((m, index) => {
    const realIndex = FOURIER_MODULES.findIndex(item => item.id === m.id) + 1;
    const unlocked = isModuleUnlocked(m.id);
    return `<li>
      <button class="module-card ${m.id === selectedModuleId ? 'active' : ''} ${state.completed[m.id] ? 'done' : ''} ${unlocked ? '' : 'locked'}" data-id="${m.id}" type="button" ${unlocked ? '' : 'disabled'}>
        <span class="module-no">${String(realIndex).padStart(2, '0')}</span>
        <span class="module-text"><strong>${m.title}</strong><span>${m.subtitle}</span></span>
        <span class="module-meta">${unlocked ? `${m.minutes}分 / ${m.xp}XP` : '🔒 順番に開きます'}</span>
      </button>
    </li>`;
  }).join('');
  els.moduleList.querySelectorAll('.module-card').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedModuleId = btn.dataset.id;
      saveState();
      renderModules();
      renderLesson();
      if (els.mapDialog.open) els.mapDialog.close();
      showScreen('learn');
    });
  });
}

function renderLesson() {
  const m = FOURIER_MODULES.find(item => item.id === selectedModuleId) || FOURIER_MODULES[0];
  const done = !!state.completed[m.id];
  const steps = getLessonSteps(m);
  const stepIndex = Math.min(state.lessonStepByModule[m.id] || 0, steps.length - 1);
  const step = steps[stepIndex];
  const canAdvance = canAdvanceLessonStep(m, stepIndex);

  els.lessonPanel.innerHTML = `
    <div class="lesson-top">
      <div>
        <p class="section-kicker">Module ${FOURIER_MODULES.findIndex(item => item.id === m.id) + 1}</p>
        <h2>${m.title}</h2>
        <p>${m.subtitle}</p>
      </div>
      <span class="level-pill">${levelLabel(m.level)} / 全${steps.length}歩 / ${m.xp}XP</span>
    </div>
    <div class="concept-row"><span>今回 約${Math.max(3, Math.ceil(m.minutes / steps.length))}分</span>${m.concepts.slice(0, 4).map(c => `<span>${c}</span>`).join('')}</div>
    <div class="lesson-stepper">
      <div class="step-meta"><span class="step-count">${stepIndex + 1} / ${steps.length}</span><div class="step-track"><span style="width:${((stepIndex + 1) / steps.length) * 100}%"></span></div></div>
      <div class="lesson-step-content">
        <h3>${step.title}</h3>
        ${renderLessonStep(m, stepIndex, done)}
      </div>
      <div class="step-actions">
        <button class="secondary-button" id="prevLessonStepBtn" type="button" ${stepIndex === 0 ? 'disabled' : ''}>← もどる</button>
        <div class="step-dots" aria-label="学習ステップ">${steps.map((_, i) => `<span class="${i === stepIndex ? 'active' : ''}"></span>`).join('')}</div>
        ${stepIndex === steps.length - 1
          ? `<button class="primary-button" id="completeModuleBtn" type="button" ${done || isModuleReady(m.id) ? '' : 'disabled'}>${done ? 'クリア済み ✓' : 'この章をクリア'}</button>`
          : `<button class="primary-button" id="nextLessonStepBtn" type="button" ${canAdvance ? '' : 'disabled'}>${nextStepLabel(stepIndex)} →</button>`}
      </div>
    </div>
  `;
  document.getElementById('prevLessonStepBtn').addEventListener('click', () => setLessonStep(m, stepIndex - 1));
  document.getElementById('nextLessonStepBtn')?.addEventListener('click', () => setLessonStep(m, stepIndex + 1));
  bindLessonStep(m, stepIndex);
}

function getLessonSteps(m) {
  return [
    { title: 'まず、章の入口を読む', kind: 'overview' },
    { title: '大事な言葉をつかむ', kind: 'concepts' },
    { title: '読んだあとに、予想する', kind: 'predict' },
    { title: '触って、確かめる', kind: 'act' },
    { title: '自分の言葉にする', kind: 'explain' },
    { title: '数式まで、きちんと読む', kind: 'formalize' },
    { title: '資料を閉じて思い出す', kind: 'recall' },
    { title: '現実で使って、クリア', kind: 'apply' }
  ];
}

function getExperience(m) {
  return FOURIER_EXPERIENCES[m.id];
}

function renderLessonStep(m, stepIndex, done) {
  const exp = getExperience(m);
  const prediction = state.lessonPredictions[m.id];
  const explanation = state.lessonExplanations[m.id] || '';
  if (stepIndex === 0) {
    return `<article class="reading-step">
      <p class="reading-progress">読む 1 / 3</p>
      <p class="reading-lead">この章で答えられるようになる問い</p>
      <div class="learning-goal"><span>学習目標</span><p>${m.goal}</p></div>
      <div class="reading-body"><p>${m.story}</p></div>
      <div class="reading-summary"><strong>この章の着地点</strong><p>${m.checkpoint}</p></div>
    </article>`;
  }
  if (stepIndex === 1) {
    const notes = FOURIER_READING_NOTES[m.id] || [];
    return `<article class="reading-step">
      <p class="reading-progress">読む 2 / 3</p>
      <div class="reading-body"><p>${m.bridge}</p><p>${m.textbook}</p></div>
      <div class="term-guide" aria-label="重要語句">
        ${notes.map(([term, definition]) => `<section><strong>${term}</strong><p>${definition}</p></section>`).join('')}
      </div>
      <p class="step-hint">用語を丸暗記せず、「何を表す言葉か」を一つずつ確認しよう。</p>
    </article>`;
  }
  if (stepIndex === 2) {
    return `<div class="prediction-card">
      <p class="step-lead">読んだ内容を使い、実験の結果を先に考えよう。</p>
      <p class="prediction-question">${exp.question}</p>
      <div class="prediction-options">${exp.options.map((option, i) => `<button class="choice-button ${prediction === i ? 'active' : ''}" data-lesson-prediction="${i}" type="button">${option}</button>`).join('')}</div>
      <p class="step-hint">間違っても失点はありません。予想が学びのスタートです。</p>
    </div>`;
  }
  if (stepIndex === 3) {
    return `<div class="action-step">
      <div class="action-icon" aria-hidden="true">∿</div>
      <p>${exp.task}</p>
      <button class="primary-button" id="openLessonLabBtn" type="button">${state.labVisited[m.id] ? '操作できた ✓' : 'ラボで試す'} →</button>
      <p class="step-hint">${state.labVisited[m.id] ? '観察できました。次は、起きたことを言葉にします。' : 'ラボでは指定された操作を1回すると、この一歩が完了します。'}</p>
    </div>`;
  }
  if (stepIndex === 4) {
    return `<div class="explain-step">
      <div class="result-reveal"><span>${prediction === exp.answer ? '予想どおり' : 'ここが発見'}</span><p>${exp.observation}</p></div>
      <label class="explanation-label" for="lessonExplanation">あなたの言葉で、理由を1文にすると？</label>
      <textarea id="lessonExplanation" rows="3" placeholder="例：〜を動かすと、〜が変わった。なぜなら…">${explanation}</textarea>
      <p class="step-hint" id="explanationHint">8文字以上で書くと次へ進めます。現在 ${explanation.trim().length}文字</p>
    </div>`;
  }
  if (stepIndex === 5) {
    return `<article class="formalize-step reading-step">
      <p class="reading-progress">読む 3 / 3</p>
      <div class="equation-card"><span>式を意味から読む</span><p>${m.equation}</p></div>
      <div class="mistake-card"><span>ここを区別する</span><p>${m.commonMistake}</p></div>
      <div class="reading-drills"><strong>読みながら考える3問</strong><ol>${m.drills.map(item => `<li>${item}</li>`).join('')}</ol></div>
      <p class="step-hint">式を計算できなくても、記号が何を入力し、何を出力するか説明できれば前進です。</p>
    </article>`;
  }
  if (stepIndex === 6) {
    return `<section class="lesson-check" id="lessonCheckBox" aria-labelledby="lessonCheckTitle"></section>`;
  }
  const conf = state.confidence[m.id];
  return `<div class="lesson-final">
    <p class="step-lead">最後は、知識を現実へ持ち出します。</p>
    <div class="application-card"><span>今回の応用</span><p>${m.practice}</p></div>
    <details class="application-examples"><summary>活用例を見る</summary><ul>${m.realWorld.map(item => `<li>${item}</li>`).join('')}</ul></details>
    <div class="confidence-row"><strong>今の自信</strong><span>説明できそう？</span><div class="confidence-buttons">${[1,2,3,4,5].map(n => `<button class="${conf === n ? 'active' : ''}" data-confidence="${n}" type="button">${n}</button>`).join('')}</div></div>
    ${done ? '<div class="step-callout">この章はクリア済みです。次の道が開いています。</div>' : '<p class="step-hint">自信度を選ぶとクリアできます。</p>'}
  </div>`;
}

function nextStepLabel(stepIndex) {
  return ['用語へ', '予想へ', '操作へ', '言葉にする', '数式へ', '思い出す', '応用へ'][stepIndex] || '次へ';
}

function canAdvanceLessonStep(m, stepIndex) {
  if (stepIndex === 2) return Number.isInteger(state.lessonPredictions[m.id]);
  if (stepIndex === 3) return state.labVisited[m.id] === true;
  if (stepIndex === 4) return (state.lessonExplanations[m.id] || '').trim().length >= 8;
  if (stepIndex === 6) return isModuleCheckPassed(m.id);
  return true;
}

function setLessonStep(m, index) {
  const max = getLessonSteps(m).length - 1;
  state.lessonStepByModule[m.id] = Math.max(0, Math.min(index, max));
  saveState();
  renderLesson();
  renderHome();
  els.lessonPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bindLessonStep(m, stepIndex) {
  els.lessonPanel.querySelectorAll('[data-lesson-prediction]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.lessonPredictions[m.id] = Number(btn.dataset.lessonPrediction);
      recordDailyLearning();
      saveState();
      renderLesson();
      renderHome();
    });
  });
  document.getElementById('openLessonLabBtn')?.addEventListener('click', () => openModuleLab(m));
  const explanation = document.getElementById('lessonExplanation');
  explanation?.addEventListener('input', () => {
    state.lessonExplanations[m.id] = explanation.value;
    saveState();
    const ready = explanation.value.trim().length >= 8;
    document.getElementById('nextLessonStepBtn').disabled = !ready;
    document.getElementById('explanationHint').textContent = ready ? '自分の言葉にできました ✓' : `8文字以上で書くと次へ進めます。現在 ${explanation.value.trim().length}文字`;
  });
  if (stepIndex === 6) renderLessonCheck(m);
  document.getElementById('completeModuleBtn')?.addEventListener('click', () => toggleModule(m));
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

function recordDailyLearning() {
  const today = getJapanDateKey();
  if (state.lastDaily === today) return;
  const yesterday = getJapanDateKey(new Date(Date.now() - 86400000));
  state.streak = state.lastDaily === yesterday ? (state.streak || 0) + 1 : 1;
  state.lastDaily = today;
  state.xp += 15;
  if (state.streak >= 3) unlockBadge('daily3');
  showToast('今日の一歩を開始。15XP獲得！');
}

function openModuleLab(m) {
  activeLabModuleId = m.id;
  const exp = getExperience(m);
  activePreset = exp.preset === 'window' ? 'mix' : exp.preset;
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.preset === activePreset));
  applyPreset(activePreset);
  if (exp.preset === 'window') {
    els.windowToggle.checked = false;
  }
  updateControlAvailability();
  renderLabMission();
  drawLab();
  showScreen('lab');
}

function renderLabMission() {
  if (!activeLabModuleId) {
    els.labMissionTitle.textContent = '自由に波を動かす';
    els.labMissionInstruction.textContent = 'スライダーをひとつ動かし、左右のグラフを見比べよう。';
    els.labMissionStatus.textContent = '自由モード';
    els.returnToLessonBtn.disabled = false;
    configureMobileLab(null);
    return;
  }
  const m = FOURIER_MODULES.find(item => item.id === activeLabModuleId);
  const exp = getExperience(m);
  const done = state.labVisited[m.id] === true;
  els.labMissionTitle.textContent = `Module ${FOURIER_MODULES.indexOf(m) + 1} の実験`;
  els.labMissionInstruction.textContent = exp.task;
  els.labMissionStatus.textContent = done ? '✓ 観察できた' : '○ まだ';
  els.labMissionStatus.classList.toggle('done', done);
  els.returnToLessonBtn.disabled = !done;
  configureMobileLab(exp, m.id);
}

function configureMobileLab(exp, moduleId = null) {
  els.controlPanel.querySelectorAll('label').forEach(label => label.classList.remove('mission-target'));
  document.querySelectorAll('.mode-tabs .tab').forEach(btn => btn.classList.remove('mission-target'));
  els.controlPanel.classList.remove('show-all', 'preset-mission');
  els.toggleAllControlsBtn.textContent = 'ほかのつまみ';
  els.toggleAllControlsBtn.hidden = !exp;
  if (!exp) {
    els.controlPanel.classList.add('show-all');
    setMobileGraph('wave');
    return;
  }
  if (exp.control === 'preset') {
    els.controlPanel.classList.add('preset-mission');
    document.querySelector(`.mode-tabs [data-preset="${activePreset}"]`)?.classList.add('mission-target');
  } else {
    document.getElementById(exp.control)?.closest('label')?.classList.add('mission-target');
  }
  const spectrumModules = ['m04', 'm05', 'm08', 'm09', 'm10'];
  setMobileGraph(spectrumModules.includes(moduleId) ? 'spectrum' : 'wave');
}

function setMobileGraph(graph) {
  els.labGrid.dataset.mobileGraph = graph;
  document.querySelectorAll('.mobile-graph-tabs [data-mobile-graph]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mobileGraph === graph);
  });
}

function markLabInteraction(controlId) {
  if (!activeLabModuleId) return;
  const exp = getExperience(FOURIER_MODULES.find(m => m.id === activeLabModuleId));
  if (exp.control !== controlId) return;
  state.labVisited[activeLabModuleId] = true;
  saveState();
  renderLabMission();
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
  return Number.isInteger(state.lessonPredictions[moduleId])
    && state.labVisited[moduleId] === true
    && (state.lessonExplanations[moduleId] || '').trim().length >= 8
    && isModuleCheckPassed(moduleId)
    && Number.isFinite(state.confidence[moduleId]);
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
    showToast('この章はクリア済みです');
    return;
  } else {
    if (!isModuleReady(m.id)) {
      showToast('6つの一歩を順番に完了してください');
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
  const currentIndex = FOURIER_MODULES.findIndex(item => item.id === m.id);
  const next = FOURIER_MODULES[currentIndex + 1];
  if (next) selectedModuleId = next.id;
  saveState();
  renderAll();
  showScreen('home');
  showToast(next ? 'クリア！ 次の道が開きました' : '全章クリア！ おめでとうございます');
}

function goNextModule() {
  const current = FOURIER_MODULES.findIndex(m => m.id === selectedModuleId);
  const next = FOURIER_MODULES[Math.min(current + 1, FOURIER_MODULES.length - 1)];
  if (!isModuleUnlocked(next.id)) {
    showToast('今の章をクリアすると、次の道が開きます');
    return;
  }
  selectedModuleId = next.id;
  saveState();
  renderModules();
  renderLesson();
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
  els.sampleCountValue.textContent = els.sampleCount.value;
  els.windowToggleValue.textContent = els.windowToggle.checked ? 'ON' : 'OFF';
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
      const middleFrequency = activeLabModuleId === 'm10' ? 5.5 : 5;
      y = a1 * Math.sin(2 * Math.PI * 2 * t) + a2 * Math.sin(2 * Math.PI * middleFrequency * t + phase) + a3 * Math.sin(2 * Math.PI * 11 * t - phase / 2);
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
  const sampleCount = Number(els.sampleCount.value);
  if (sampleCount <= 64) {
    const points = getSignalSamples(sampleCount);
    ctx.fillStyle = '#f5b83d';
    points.forEach((v, i) => {
      const x = i / sampleCount * w;
      const y = h / 2 - (v / max) * (h * 0.36);
      ctx.fillRect(x - 4, y - 4, 8, 8);
    });
  }
  drawAxisLabels(ctx, w, h, { x: '時間 t（秒）', y: '振幅', maxY: max });
}

function drawSpectrum() {
  const canvas = els.spectrumCanvas;
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const sampleCount = Number(els.sampleCount.value);
  let samples = getSignalSamples(sampleCount);
  if (els.windowToggle.checked) {
    samples = samples.map((value, i) => value * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (samples.length - 1))));
  }
  const mags = dftMagnitudes(samples).slice(1, Math.min(32, Math.floor(sampleCount / 2)));
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
  els.labSummary.textContent = `現在の主な成分：${strongest}。サンプル数 ${sampleCount}、窓関数 ${els.windowToggle.checked ? 'ON' : 'OFF'}。縦軸は0〜${max.toFixed(1)}で固定しています。`;
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
