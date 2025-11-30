// API Base URL configuration
const API_BASE = window.SOUL_API_BASE || 'http://localhost:8000';

// 简易全局状态
const state = {
  conversation: [], // {role:"user"|"peer", text, ts}
  persona: { enabled: false, mbti: null, functions: null },
  alwaysOn: true,
  lastSuggestPayload: null,
  opponentDifficulty: 'realistic', // friendly | realistic | challenging | custom
  scenario: {
    enabled: false,
    applied: null, // 已生效的场景快照
    draft: { scenario: '', opponent: { roleTitle: '', traits: [] }, userGoal: { goal: '', reason: '' } },
    locks: { roleTitle: false, traits: false, goal: false },
    autoAnalyze: false,
    dirty: false
  },
  opening: {
    startingParty: 'either', // user | opponent | either
    userStartOverride: false // 用户选择"我先开场"时置为true
  }
};

// DOM
const $messages = document.getElementById('messages');
const $tipBar = document.getElementById('tipBar');
const $cands = document.getElementById('cands');
const $draft = document.getElementById('draft');
const $btnSend = document.getElementById('btnSend');
const $btnPeer = document.getElementById('btnPeer');
const $alwaysOn = document.getElementById('alwaysOn');
const $relBar = document.getElementById('relBar');
const $relText = document.getElementById('relText');
const $btnFetchTip = document.getElementById('btnFetchTip');
const $btnPersona = document.getElementById('btnPersona');
const $personaPanel = document.getElementById('personaPanel');
const $personaEnabled = document.getElementById('personaEnabled');
const $btnInfer = document.getElementById('btnInfer');
const $mbtiModal = document.getElementById('mbtiModal');
const $modalClose = document.getElementById('modalClose');
const $quizContainer = document.getElementById('quizContainer');
const $btnSubmitQuiz = document.getElementById('btnSubmitQuiz');
const $quizResult = document.getElementById('quizResult');
const $personaSummary = document.getElementById('personaSummary');
const $aiOpponent = document.getElementById('aiOpponent');
const $scenarioEnabled = document.getElementById('scenarioEnabled');
const $scenarioAutoAnalyze = document.getElementById('scenarioAutoAnalyze');
const $scenarioTemplate = document.getElementById('scenarioTemplate');
const $scenarioText = document.getElementById('scenarioText');
const $opponentRoleTitle = document.getElementById('opponentRoleTitle');
const $userGoal = document.getElementById('userGoal');
const $lockRoleTitle = document.getElementById('lockRoleTitle');
const $lockTraits = document.getElementById('lockTraits');
const $lockGoal = document.getElementById('lockGoal');
const $btnAnalyzeScenario = document.getElementById('btnAnalyzeScenario');
const $btnAnalyzeApplyScenario = document.getElementById('btnAnalyzeApplyScenario');
const $btnApplyScenario = document.getElementById('btnApplyScenario');
const $analyzeStatus = document.getElementById('analyzeStatus');
const $analysisResultBlock = document.getElementById('analysisResultBlock');
const $opponentTraits = document.getElementById('opponentTraits');
const $opponentTraitsInput = document.getElementById('opponentTraitsInput');
const $btnRegenGoal = document.getElementById('btnRegenGoal');
const $userGoalReason = document.getElementById('userGoalReason');
const $scenarioAppliedChip = document.getElementById('scenarioAppliedChip');
const $scenarioAppliedText = document.getElementById('scenarioAppliedText');
const $btnEditScenario = document.getElementById('btnEditScenario');
const $btnDisableScenario = document.getElementById('btnDisableScenario');
const $openingGuidance = document.getElementById('openingGuidance');
const $openingText = document.getElementById('openingText');
const $btnLetOpponentStart = document.getElementById('btnLetOpponentStart');
const $btnUserStartOverride = document.getElementById('btnUserStartOverride');
const $opponentDifficulty = document.getElementById('opponentDifficulty');

// Utils
function nowTs() { return Date.now() / 1000; }
let lastSuggestAt = 0;
function renderMessages() {
  $messages.innerHTML = '';
  state.conversation.forEach(turn => {
    const wrap = document.createElement('div');
    wrap.className = 'bubble ' + (turn.role === 'user' ? 'me' : 'peer');
    wrap.textContent = turn.text;
    $messages.appendChild(wrap);
  });
  $messages.scrollTop = $messages.scrollHeight;
}
function renderTip(text) {
  $tipBar.textContent = text || '...';
}
function renderRelation(index) {
  const val = Math.max(0, Math.min(100, index|0));
  $relBar.style.width = `${val}%`;
  $relText.textContent = val;
}
function renderCandidates(cands) {
  $cands.innerHTML = '';
  cands.forEach(c => {
    const card = document.createElement('div');
    card.className = 'card';
    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = c.text;
    const why = document.createElement('div');
    why.className = 'why';
    why.textContent = `${c.why || ''}`;
    const risk = document.createElement('div');
    risk.className = 'foot ' + (c.risk === 'high' ? 'risk-high' : c.risk === 'mid' ? 'risk-mid' : 'risk-low');
    risk.textContent = `风险: ${c.risk}`;
    card.appendChild(text);
    card.appendChild(why);
    card.appendChild(risk);
    card.onclick = () => {
      $draft.value = c.text;
    };
    $cands.appendChild(card);
  });
}

function setAnalyzeUiBusy(busy) {
  if ($btnAnalyzeScenario) $btnAnalyzeScenario.disabled = !!busy;
  if ($btnAnalyzeApplyScenario) $btnAnalyzeApplyScenario.disabled = !!busy;
  if ($analyzeStatus) {
    $analyzeStatus.style.color = '#888';
    $analyzeStatus.textContent = busy ? '分析中…' : '';
  }
}

// Scenario helpers
function getTraits() {
  return Array.isArray(state.scenario.draft.opponent.traits) ? state.scenario.draft.opponent.traits : [];
}
function setTraits(arr) {
  const list = (arr || []).map(s => String(s).trim()).filter(Boolean);
  // 去重并限长
  const seen = new Set();
  const uniq = [];
  for (const s of list) { if (!seen.has(s)) { seen.add(s); uniq.push(s); } }
  state.scenario.draft.opponent.traits = uniq.slice(0, 8);
  renderTraits();
  markScenarioDirty();
}
function renderTraits() {
  if (!$opponentTraits) return;
  $opponentTraits.innerHTML = '';
  getTraits().forEach((t, idx) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = t;
    const x = document.createElement('button');
    x.textContent = '×';
    x.onclick = () => {
      const arr = getTraits().slice();
      arr.splice(idx, 1);
      setTraits(arr);
    };
    chip.appendChild(x);
    $opponentTraits.appendChild(chip);
  });
}
function addTraitsFromInput() {
  if (!$opponentTraitsInput) return;
  const raw = ($opponentTraitsInput.value || '').trim();
  if (!raw) return;
  const parts = raw.split(/[，,、\n]/).map(s => s.trim()).filter(Boolean);
  const arr = getTraits().slice();
  for (const p of parts) { if (p && !arr.includes(p)) arr.push(p); }
  setTraits(arr);
  $opponentTraitsInput.value = '';
}
function collectDraftFromDom() {
  return {
    scenario: ($scenarioText && $scenarioText.value) || '',
    opponent: {
      roleTitle: ($opponentRoleTitle && $opponentRoleTitle.value) || '',
      traits: getTraits()
    },
    userGoal: { goal: ($userGoal && $userGoal.value) || '', reason: (state.scenario.draft.userGoal && state.scenario.draft.userGoal.reason) || '' }
  };
}
function getAppliedScenario() {
  if (state.scenario.enabled && state.scenario.applied) return state.scenario.applied;
  return null;
}
function updateScenarioChip() {
  const applied = state.scenario.applied;
  const enabled = !!state.scenario.enabled && !!applied;
  if (!enabled) {
    $scenarioAppliedChip && $scenarioAppliedChip.classList.add('hidden');
    if ($scenarioAppliedText) $scenarioAppliedText.textContent = '未生效';
    return;
  }
  const roleTitle = (applied.opponent && applied.opponent.roleTitle) || '';
  const traits = (applied.opponent && applied.opponent.traits) || [];
  const goal = (applied.userGoal && applied.userGoal.goal) || '';
  const traitsPreview = traits.slice(0,2).join('、') || '形象未设';
  let txt = `已生效：${roleTitle || '未设'} | 形象：${traitsPreview} | 目标：${goal || '-'}`;
  if (state.scenario.dirty) txt += '（有未应用更改）';
  $scenarioAppliedText && ($scenarioAppliedText.textContent = txt);
  $scenarioAppliedChip && $scenarioAppliedChip.classList.remove('hidden');
}
function markScenarioDirty() {
  const d = collectDraftFromDom();
  const a = state.scenario.applied || { scenario: '', opponent: { roleTitle: '', traits: [] }, userGoal: { goal: '' } };
  const dirty = (
    (d.scenario || '') !== (a.scenario || '') ||
    ((d.opponent && d.opponent.roleTitle) || '') !== ((a.opponent && a.opponent.roleTitle) || '') ||
    (Array.isArray(d.opponent?.traits) ? d.opponent.traits.join(',') : '') !== (Array.isArray(a.opponent?.traits) ? a.opponent.traits.join(',') : '') ||
    ((d.userGoal && d.userGoal.goal) || '') !== ((a.userGoal && a.userGoal.goal) || '')
  );
  state.scenario.dirty = dirty;
  updateScenarioChip();
}
let analyzeDebTimer = null;
async function analyzeScenario(applyAfter = false) {
  setAnalyzeUiBusy(true);
  const before = collectDraftFromDom();
  const payload = {
    templateId: ($scenarioTemplate && $scenarioTemplate.value && $scenarioTemplate.value !== 'custom') ? $scenarioTemplate.value : null,
    scenarioText: ($scenarioText && $scenarioText.value) || '',
    opponentHint: ($opponentRoleTitle && $opponentRoleTitle.value) || '',
    userGoalHint: ($userGoal && $userGoal.value) || '',
    opponentTraits: getTraits(),
    mode: 'full'
  };
  try {
    const res = await fetch(API_BASE + '/api/scenario/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    // 展开分析区
    if ($analysisResultBlock) $analysisResultBlock.classList.remove('hidden');
    // 合并到草稿（尊重锁定），并统计变更/跳过项
    const updated = [];
    const skipped = [];
    if ($scenarioText && data && typeof data.scenario === 'string') {
      if (($scenarioText.value || '') !== (data.scenario || '')) updated.push('场景描述');
      $scenarioText.value = data.scenario || '';
    }
    if (data && data.opponent && typeof data.opponent.roleTitle === 'string') {
      const newVal = data.opponent.roleTitle || '';
      const oldVal = before.opponent.roleTitle || '';
      if ($lockRoleTitle && $lockRoleTitle.checked) {
        if (newVal && newVal !== oldVal) skipped.push('称谓');
      } else if ($opponentRoleTitle) {
        if (newVal !== oldVal) updated.push('称谓');
        $opponentRoleTitle.value = newVal;
      }
    }
    if (data && data.opponent && Array.isArray(data.opponent.traits)) {
      const newArr = (data.opponent.traits || []).map(String);
      const oldArr = getTraits();
      if ($lockTraits && $lockTraits.checked) {
        if (newArr.join(',') !== oldArr.join(',') && newArr.length) skipped.push('形象');
      } else {
        if (newArr.join(',') !== oldArr.join(',')) updated.push('形象');
        setTraits(newArr);
      }
    }
    if (data && data.userGoal && typeof data.userGoal.goal === 'string') {
      const newVal = data.userGoal.goal || '';
      const oldVal = before.userGoal.goal || '';
      if ($lockGoal && $lockGoal.checked) {
        if (newVal && newVal !== oldVal) skipped.push('目标');
      } else if ($userGoal) {
        if (newVal !== oldVal) updated.push('目标');
        $userGoal.value = newVal;
      }
    }
    if ($userGoalReason && data && data.userGoal && typeof data.userGoal.reason === 'string') {
      state.scenario.draft.userGoal.reason = data.userGoal.reason;
      $userGoalReason.textContent = data.userGoal.reason ? `原因：${data.userGoal.reason}` : '';
    }
    state.scenario.draft = collectDraftFromDom();
    markScenarioDirty();
    if ($analyzeStatus) {
      let msg = '';
      if (updated.length) msg += `已更新：${updated.join('、')}`;
      if (skipped.length) msg += (msg ? '；' : '') + `跳过（已锁定）：${skipped.join('、')}`;
      if (!msg) msg = '无变化';
      if (applyAfter) msg += '，已应用。';
      $analyzeStatus.style.color = updated.length ? '#28a745' : (skipped.length ? '#f0ad4e' : '#888');
      $analyzeStatus.textContent = msg;
    }
    if (applyAfter) applyScenario();
  } catch (e) {
    if ($analyzeStatus) {
      $analyzeStatus.style.color = '#d9534f';
      $analyzeStatus.textContent = '分析失败，请稍后重试';
    }
  }
  setAnalyzeUiBusy(false);
}
function applyScenario() {
  state.scenario.enabled = true;
  if ($scenarioEnabled) $scenarioEnabled.checked = true;
  state.scenario.applied = collectDraftFromDom();
  state.scenario.dirty = false;
  updateScenarioChip();
  updateOpeningGuidance();
  callSuggest('typing');
}
function updateOpeningGuidance() {
  const applied = state.scenario.applied;
  const flow = (applied && applied.flow) || {};
  state.opening.startingParty = flow.startingParty || 'either';
  const isEmpty = state.conversation.length === 0;
  const shouldShow = state.scenario.enabled && isEmpty && state.opening.startingParty === 'opponent' && !state.opening.userStartOverride;
  if (shouldShow && $openingGuidance) {
    const hints = (flow.openingHints || []).join('；') || '对方先开场';
    if ($openingText) $openingText.textContent = `当前场景通常由对方先开场。开场建议：${hints}`;
    $openingGuidance.classList.remove('hidden');
  } else if ($openingGuidance) {
    $openingGuidance.classList.add('hidden');
  }
}

async function callSuggest(entryType) {
  try {
    const now = Date.now();
    if (entryType === 'typing' && now - lastSuggestAt < 1200) {
      return; // 频控：避免请求过密
    }
    const sc = getAppliedScenario();
    const payload = {
      conversation: state.conversation,
      draft: $draft.value,
      entryType,
      userProfile: {},
      peerProfile: {},
      memory: [],
      personaWeights: state.persona.enabled && state.persona.functions ? {
        ...state.persona.functions, enabled: true
      } : null,
      scenario: sc
    };
    state.lastSuggestPayload = payload;
    const res = await fetch(API_BASE + '/api/suggest', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    renderTip(data.tip?.text || '');
    renderCandidates(data.candidates || []);
    renderRelation(data.relationship?.index || 50);
    lastSuggestAt = now;
  } catch (e) {
    console.error(e);
    renderTip('建议生成暂时不可用，已采用本地兜底。稍后再试～');
  }
}

// Debounce
let typingTimer = null;
function onDraftChange() {
  if (!state.alwaysOn) return;
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => callSuggest('typing'), 400);
}

async function onPreSend() {
  await callSuggest('preSend'); // 强审校
}
async function onSend() {
  const text = ($draft.value || '').trim();
  if (!text) return;
  await onPreSend();
  state.conversation.push({role:'user', text, ts: nowTs()});
  $draft.value = '';
  renderMessages();
  updateOpeningGuidance(); // 发送后隐藏开场指引
  await callSuggest('postSend');
  if ($aiOpponent && $aiOpponent.checked) {
    await callAiReply();
  }
}

async function onPeerSim() {
  const samples = [
    '哈哈这事儿挺有意思的，你怎么看？',
    '周末还没安排呢，可能去走走～',
    '我最近有点忙，回得慢一点别介意哈',
  ];
  const s = samples[(Math.random()*samples.length)|0];
  state.conversation.push({role:'peer', text: s, ts: nowTs()});
  renderMessages();
  await callSuggest('peerMsg');
}

// 态度映射（用于表情和中文标签）
const ATTITUDE_MAP = {
  'positive': { emoji: '😊', label: '积极', color: '#4CAF50' },
  'neutral': { emoji: '😐', label: '中立', color: '#FF9800' },
  'negative': { emoji: '😅', label: '委婉拒绝', color: '#9E9E9E' }
};

// 根据难度模式选择回复
function selectReplyByDifficulty(replies, difficulty) {
  if (!replies || replies.length === 0) {
    return { id: 'default', text: '我们可以继续聊聊刚才的话题～', tone: 'neutral' };
  }

  // 确保至少有一条回复
  if (replies.length === 1) return replies[0];

  switch(difficulty) {
    case 'friendly': // 总是选择积极的
      return replies.find(r => r.tone === 'positive') || replies[0];

    case 'realistic': // 随机选择
      return replies[Math.floor(Math.random() * replies.length)];

    case 'challenging': // 倾向中立/拒绝（70%概率）
      if (Math.random() < 0.7) {
        const negatives = replies.filter(r => r.tone === 'neutral' || r.tone === 'negative');
        if (negatives.length > 0) {
          return negatives[Math.floor(Math.random() * negatives.length)];
        }
      }
      return replies[Math.floor(Math.random() * replies.length)];

    case 'custom': // 用户手动选择（此函数不处理，返回null）
      return null;

    default:
      return replies[0];
  }
}

// 渲染回复选择卡片UI
function renderReplySelectionCards(replies, onSelect) {
  // 创建卡片容器
  const container = document.createElement('div');
  container.className = 'reply-selection-container';
  container.innerHTML = `
    <div class="reply-selection-overlay"></div>
    <div class="reply-selection-panel">
      <div class="reply-selection-header">
        <h4>对方可能这样回复，请选择：</h4>
      </div>
      <div class="reply-selection-cards" id="replyCards"></div>
    </div>
  `;

  document.body.appendChild(container);

  const cardsContainer = container.querySelector('#replyCards');

  // 渲染每个回复卡片
  replies.forEach((reply, idx) => {
    const attitude = ATTITUDE_MAP[reply.tone] || ATTITUDE_MAP['neutral'];
    const card = document.createElement('div');
    card.className = 'reply-card';
    card.innerHTML = `
      <div class="reply-card-header">
        <span class="reply-emoji">${attitude.emoji}</span>
        <span class="reply-label" style="color: ${attitude.color}">${attitude.label}</span>
      </div>
      <div class="reply-text">${reply.text}</div>
      ${reply.why ? `<div class="reply-why">💭 ${reply.why}</div>` : ''}
      <button class="reply-select-btn">选择此回复</button>
    `;

    const btn = card.querySelector('.reply-select-btn');
    btn.addEventListener('click', () => {
      document.body.removeChild(container);
      onSelect(reply);
    });

    cardsContainer.appendChild(card);
  });

  // 点击遮罩关闭（选择第一条作为默认）
  const overlay = container.querySelector('.reply-selection-overlay');
  overlay.addEventListener('click', () => {
    document.body.removeChild(container);
    onSelect(replies[0]);
  });
}

async function callAiReply() {
  try {
    const sc = getAppliedScenario();
    const payload = {
      conversation: state.conversation,
      opponent: { persona_hint: '' },
      personaWeights: state.persona.enabled && state.persona.functions ? {
        ...state.persona.functions, enabled: true
      } : null,
      scenario: sc
    };
    const res = await fetch(API_BASE + '/api/peer/reply', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    // 获取所有回复选项
    const replies = (data && data.replies) ? data.replies : [];

    // 如果没有回复，使用fallback
    if (replies.length === 0) {
      const fallbackText = (data && data.text) ? String(data.text) : '我们可以继续聊聊刚才的话题～';
      state.conversation.push({role:'peer', text: fallbackText, ts: nowTs()});
      renderMessages();
      updateOpeningGuidance();
      await callSuggest('peerMsg');
      return;
    }

    // 根据难度模式处理
    const difficulty = state.opponentDifficulty;

    if (difficulty === 'custom') {
      // 自定义模式：展示卡片让用户选择
      renderReplySelectionCards(replies, async (selectedReply) => {
        state.conversation.push({role:'peer', text: selectedReply.text, ts: nowTs()});
        renderMessages();
        updateOpeningGuidance();
        await callSuggest('peerMsg');
      });
    } else {
      // 其他模式：自动选择
      const selectedReply = selectReplyByDifficulty(replies, difficulty);
      if (selectedReply) {
        state.conversation.push({role:'peer', text: selectedReply.text, ts: nowTs()});
        renderMessages();
        updateOpeningGuidance();
        await callSuggest('peerMsg');
      }
    }
  } catch (e) {
    console.error(e);
    await onPeerSim();
  }
}

// Persona & MBTI
const QUIZ_12 = [
  { q: '聚会后你更需要独处恢复还是更有能量？', dim:'EI', reverse:false },
  { q: '做决定更依赖事实与逻辑还是感受与价值？', dim:'TF', reverse:false },
  { q: '交流更喜欢具体细节还是宏观想法与可能性？', dim:'SN', reverse:true },
  { q: '计划外变化更倾向维持计划还是灵活应对？', dim:'JP', reverse:false },
  { q: '初识你更主动开场还是观察后再加入？', dim:'EI', reverse:false },
  { q: '描述事物更常用数据与因果还是体验与意义？', dim:'TF', reverse:false },
  { q: '看电影更在意剧情逻辑还是人物情感？', dim:'TF', reverse:false },
  { q: '旅行更偏行程表还是随心走？', dim:'JP', reverse:false },
  { q: '聊天更常举实例还是展开联想？', dim:'SN', reverse:false },
  { q: '空闲更愿社交还是宅家？', dim:'EI', reverse:false },
  { q: '学习时更看重概念框架还是动手实践？', dim:'SN', reverse:true },
  { q: '面对分歧更讲道理还是先安抚情绪？', dim:'TF', reverse:true },
];

function renderQuiz(container, qs) {
  container.innerHTML = '';
  qs.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'quiz-item';
    const title = document.createElement('div');
    title.textContent = `${idx+1}. ${item.q}`;
    const options = document.createElement('div');
    for (let v=1; v<=5; v++) {
      const id = `q_${idx}_${v}`;
      const label = document.createElement('label');
      label.style.marginRight = '8px';
      const input = document.createElement('input');
      input.type = 'radio'; input.name = `q_${idx}`; input.value = String(v); input.id = id;
      label.appendChild(input);
      label.appendChild(document.createTextNode(` ${v}`));
      options.appendChild(label);
    }
    div.appendChild(title);
    div.appendChild(options);
    container.appendChild(div);
  });
}

async function submitQuiz() {
  const answers = [];
  for (let i=0; i<QUIZ_12.length; i++) {
    const val = document.querySelector(`input[name="q_${i}"]:checked`);
    const v = val ? Number(val.value) : 3;
    answers.push({ dim: QUIZ_12[i].dim, value: v, reverse: QUIZ_12[i].reverse });
  }
  const res = await fetch(API_BASE + '/api/mbti/submit', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ answers, mode: 'quick' })
  });
  const data = await res.json();
  state.persona.mbti = data.mbti;
  state.persona.functions = data.functions;
  state.persona.enabled = true;
  await fetch(API_BASE + '/api/persona/apply', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ mbti: data.mbti, functions: data.functions, enabled: true })
  });
  $quizResult.classList.remove('hidden');
  $quizResult.textContent = `MBTI: ${data.mbti}  可信度: ${data.confidence}  已应用建议偏好`;
  renderPersonaSummary();
  // 提交成功后自动关闭弹窗
  $mbtiModal.classList.add('hidden');
  // 触发一次建议刷新以使用最新 persona
  callSuggest('typing');
}

function renderPersonaSummary() {
  if (!state.persona.functions) {
    $personaSummary.textContent = '未设置';
    return;
  }
  $personaSummary.textContent = `MBTI: ${state.persona.mbti || '-'} | 八维: ` +
    Object.entries(state.persona.functions).map(([k,v]) => `${k}:${v}`).join(' ');
  $personaEnabled.checked = !!state.persona.enabled;
  $personaPanel.classList.remove('hidden');
}

async function inferFromChat() {
  const res = await fetch(API_BASE + '/api/mbti/infer-from-chat', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ conversation: state.conversation })
  });
  const data = await res.json();
  state.persona.mbti = data.mbtiGuess || null;
  state.persona.functions = data.functionsGuess || null;
  state.persona.enabled = true;
  await fetch(API_BASE + '/api/persona/apply', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ mbti: state.persona.mbti, functions: state.persona.functions, enabled: true })
  });
  renderPersonaSummary();
}

// Events
$draft.addEventListener('input', onDraftChange);
$btnSend.addEventListener('click', onSend);
$btnPeer.addEventListener('click', () => {
  if ($aiOpponent && $aiOpponent.checked) return callAiReply();
  return onPeerSim();
});
$alwaysOn.addEventListener('change', (e) => {
  state.alwaysOn = !!e.target.checked;
});
$aiOpponent && $aiOpponent.addEventListener('change', () => {
  $btnPeer.textContent = ($aiOpponent.checked ? 'AI回复' : '对方回复');
});
$opponentDifficulty && $opponentDifficulty.addEventListener('change', (e) => {
  state.opponentDifficulty = e.target.value;
});
$btnPersona.addEventListener('click', () => {
  $mbtiModal.classList.remove('hidden');
  renderQuiz($quizContainer, QUIZ_12);
  $quizResult.classList.add('hidden');
});
$modalClose.addEventListener('click', () => $mbtiModal.classList.add('hidden'));
$btnSubmitQuiz.addEventListener('click', submitQuiz);
$personaEnabled.addEventListener('change', async (e) => {
  state.persona.enabled = !!e.target.checked;
  await fetch(API_BASE + '/api/persona/apply', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ mbti: state.persona.mbti, functions: state.persona.functions, enabled: state.persona.enabled })
  });
  // 变更后刷新建议
  callSuggest('typing');
});
$btnInfer.addEventListener('click', inferFromChat);
// 手动“提示”按钮
$btnFetchTip.addEventListener('click', () => callSuggest('typing'));

$btnAnalyzeScenario && $btnAnalyzeScenario.addEventListener('click', () => analyzeScenario(false));
$btnAnalyzeApplyScenario && $btnAnalyzeApplyScenario.addEventListener('click', () => analyzeScenario(true));
$btnRegenGoal && $btnRegenGoal.addEventListener('click', async () => {
  // 仅重新生成目标
  setAnalyzeUiBusy(true);
  try {
    const payload = {
      templateId: ($scenarioTemplate && $scenarioTemplate.value && $scenarioTemplate.value !== 'custom') ? $scenarioTemplate.value : null,
      scenarioText: ($scenarioText && $scenarioText.value) || '',
      opponentHint: ($opponentRoleTitle && $opponentRoleTitle.value) || '',
      opponentTraits: getTraits(),
      mode: 'goal_only'
    };
    const res = await fetch(API_BASE + '/api/scenario/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data && data.userGoal && typeof data.userGoal.goal === 'string' && !($lockGoal && $lockGoal.checked)) {
      const newVal = data.userGoal.goal || '';
      if ($userGoal) $userGoal.value = newVal;
      if ($userGoalReason && typeof data.userGoal.reason === 'string') {
        state.scenario.draft.userGoal.reason = data.userGoal.reason;
        $userGoalReason.textContent = data.userGoal.reason ? `原因：${data.userGoal.reason}` : '';
      }
      state.scenario.draft = collectDraftFromDom();
      markScenarioDirty();
      if ($analyzeStatus) { $analyzeStatus.style.color = '#28a745'; $analyzeStatus.textContent = '已更新：目标'; }
    } else {
      if ($analyzeStatus) { $analyzeStatus.style.color = '#888'; $analyzeStatus.textContent = '无变化（可能已锁定或分析结果相同）'; }
    }
  } catch (e) {
    if ($analyzeStatus) { $analyzeStatus.style.color = '#d9534f'; $analyzeStatus.textContent = '生成失败，请稍后重试'; }
  }
  setAnalyzeUiBusy(false);
});

$btnApplyScenario && $btnApplyScenario.addEventListener('click', () => applyScenario());

$scenarioEnabled && $scenarioEnabled.addEventListener('change', (e) => {
  state.scenario.enabled = !!e.target.checked;
  updateScenarioChip();
  callSuggest('typing');
});

$scenarioTemplate && $scenarioTemplate.addEventListener('change', () => {
  const v = $scenarioTemplate.value;
  if (v === 'campus') {
    if ($scenarioText) $scenarioText.value = '社团招新现场，初次认识一位学弟，希望自然破冰并建立融洽。';
    if ($opponentRoleTitle && !($lockRoleTitle && $lockRoleTitle.checked)) $opponentRoleTitle.value = '学弟';
    if (!($lockTraits && $lockTraits.checked)) setTraits(['自然随和','表达简洁','对新鲜事好奇']);
    if ($userGoal && !($lockGoal && $lockGoal.checked)) $userGoal.value = '建立融洽';
  } else if (v === 'interview') {
    if ($scenarioText) $scenarioText.value = '技术面试环节，自我介绍后与面试官交流，希望展现契合度并获取正向反馈。';
    if ($opponentRoleTitle && !($lockRoleTitle && $lockRoleTitle.checked)) $opponentRoleTitle.value = '面试官';
    if (!($lockTraits && $lockTraits.checked)) setTraits(['专业理性','关注事实与例证','简洁直给']);
    if ($userGoal && !($lockGoal && $lockGoal.checked)) $userGoal.value = '展现契合度';
  } else if (v === 'cowork') {
    if ($scenarioText) $scenarioText.value = '向同事请教项目细节，希望高效获取关键信息并建立合作。';
    if ($opponentRoleTitle && !($lockRoleTitle && $lockRoleTitle.checked)) $opponentRoleTitle.value = '同事';
    if (!($lockTraits && $lockTraits.checked)) setTraits(['注重效率','信息导向','理性直接']);
    if ($userGoal && !($lockGoal && $lockGoal.checked)) $userGoal.value = '获取关键信息';
  } else if (v === 'dating') {
    if ($scenarioText) $scenarioText.value = '第一次约会的开场聊天，希望自然轻松并推进下一次邀约。';
    if ($opponentRoleTitle && !($lockRoleTitle && $lockRoleTitle.checked)) $opponentRoleTitle.value = '新认识的朋友';
    if (!($lockTraits && $lockTraits.checked)) setTraits(['温和体贴','幽默轻松','慢热']);
    if ($userGoal && !($lockGoal && $lockGoal.checked)) $userGoal.value = '推进邀约';
  } else if (v === 'reunion') {
    if ($scenarioText) $scenarioText.value = '多年未见的同学聚会，期望重建联系并延伸到会后互动。';
    if ($opponentRoleTitle && !($lockRoleTitle && $lockRoleTitle.checked)) $opponentRoleTitle.value = '同学';
    if (!($lockTraits && $lockTraits.checked)) setTraits(['自然亲切','怀旧倾向','愿意分享近况']);
    if ($userGoal && !($lockGoal && $lockGoal.checked)) $userGoal.value = '重建联系';
  }
  state.scenario.draft = collectDraftFromDom();
  markScenarioDirty();
  if (state.scenario.autoAnalyze) {
    clearTimeout(analyzeDebTimer);
    analyzeDebTimer = setTimeout(() => analyzeScenario(false), 800);
  }
});

// Auto analyze + locks + dirty tracking
$scenarioAutoAnalyze && $scenarioAutoAnalyze.addEventListener('change', (e) => {
  state.scenario.autoAnalyze = !!e.target.checked;
});
$scenarioText && $scenarioText.addEventListener('input', () => {
  state.scenario.draft = collectDraftFromDom();
  markScenarioDirty();
  if (state.scenario.autoAnalyze) {
    clearTimeout(analyzeDebTimer);
    analyzeDebTimer = setTimeout(() => analyzeScenario(false), 800);
  }
});
[$opponentRoleTitle, $userGoal].forEach(el => {
  el && el.addEventListener('change', () => {
    state.scenario.draft = collectDraftFromDom();
    markScenarioDirty();
  });
  el && el.addEventListener('input', () => {
    state.scenario.draft = collectDraftFromDom();
    markScenarioDirty();
  });
});
[$lockRoleTitle, $lockTraits, $lockGoal].forEach((lockEl, idx) => {
  lockEl && lockEl.addEventListener('change', () => {
    state.scenario.locks = {
      roleTitle: $lockRoleTitle ? !!$lockRoleTitle.checked : false,
      traits: $lockTraits ? !!$lockTraits.checked : false,
      goal: $lockGoal ? !!$lockGoal.checked : false
    };
  });
});

// chips 输入交互
$opponentTraitsInput && $opponentTraitsInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
    e.preventDefault();
    addTraitsFromInput();
  }
});

$btnEditScenario && $btnEditScenario.addEventListener('click', () => {
  // 简单滚动到场景面板
  document.getElementById('scenarioPanel')?.scrollIntoView({ behavior: 'smooth' });
});
$btnDisableScenario && $btnDisableScenario.addEventListener('click', () => {
  state.scenario.enabled = false;
  if ($scenarioEnabled) $scenarioEnabled.checked = false;
  updateScenarioChip();
  updateOpeningGuidance();
  callSuggest('typing');
});

$btnLetOpponentStart && $btnLetOpponentStart.addEventListener('click', async () => {
  // 让对方先开场：如果勾选了AI对手，自动触发一次对方回复
  if ($aiOpponent && $aiOpponent.checked) {
    await callAiReply();
  }
  if ($openingGuidance) $openingGuidance.classList.add('hidden');
});

$btnUserStartOverride && $btnUserStartOverride.addEventListener('click', () => {
  // 用户选择我先开场，设置 override 并隐藏指引，触发候选生成
  state.opening.userStartOverride = true;
  if ($openingGuidance) $openingGuidance.classList.add('hidden');
  callSuggest('typing');
});

// 初始渲染
renderMessages();
renderCandidates([]);
renderTip('点击左侧“提示”按钮获取建议；或开启“始终提示”。');
renderRelation(50);
// 首次进入仅在开启“始终提示”时拉取
if ($alwaysOn.checked) callSuggest('firstEnter');
// 同步开关状态
state.alwaysOn = !!$alwaysOn.checked;
$btnPeer.textContent = ($aiOpponent && $aiOpponent.checked) ? 'AI回复' : '对方回复';
updateScenarioChip();
// 初始化草稿与脏标识
state.scenario.draft = collectDraftFromDom();
markScenarioDirty();


