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

// 标记最后一条用户消息为"对方未回复"
function markLastUserMessageNoReply() {
  // 从后往前找最后一条用户消息
  for (let i = state.conversation.length - 1; i >= 0; i--) {
    if (state.conversation[i].role === 'user') {
      const msg = state.conversation[i];
      // 累计未回复次数
      if (msg.no_reply) {
        msg.no_reply_count = (msg.no_reply_count || 1) + 1;
      } else {
        msg.no_reply = true;
        msg.no_reply_count = 1;
      }
      break;
    }
  }
}

function renderMessages() {
  $messages.innerHTML = '';
  state.conversation.forEach((turn, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'bubble ' + (turn.role === 'user' ? 'me' : 'peer');
    wrap.textContent = turn.text;
    $messages.appendChild(wrap);
    
    // 如果是用户消息且对方未回复，显示提示
    if (turn.role === 'user' && turn.no_reply) {
      const noReplyHint = document.createElement('div');
      noReplyHint.className = 'no-reply-hint';
      const count = turn.no_reply_count || 1;
      noReplyHint.textContent = count > 1 
        ? `（对方连续第${count}次未回复）` 
        : '（对方未回复）';
      noReplyHint.style.cssText = 'text-align: center; color: #999; font-size: 12px; margin: 4px 0;';
      $messages.appendChild(noReplyHint);
    }
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
  // 用户消息发送后立即保存
  notifyStateChange();
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
  // 模拟回复后立即保存
  notifyStateChange();
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

  // 添加"自定义输入"卡片
  const customCard = document.createElement('div');
  customCard.className = 'reply-card';
  customCard.style.borderStyle = 'dashed';
  customCard.innerHTML = `
    <div class="reply-card-header">
      <span class="reply-emoji">✏️</span>
      <span class="reply-label" style="color: #6366F1">自定义输入</span>
    </div>
    <div class="reply-text" style="color: #666;">我更了解对方，想自己输入对方的回复</div>
    <textarea id="customReplyInput" rows="2" placeholder="输入对方会说的话..." 
      style="width: 100%; margin-top: 8px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; resize: none;"></textarea>
    <button class="reply-select-btn" id="customReplyBtn" style="margin-top: 8px;">使用自定义回复</button>
  `;
  cardsContainer.appendChild(customCard);

  // 自定义输入的提交
  const $customInput = customCard.querySelector('#customReplyInput');
  const $customBtn = customCard.querySelector('#customReplyBtn');
  $customBtn.addEventListener('click', () => {
    const text = ($customInput.value || '').trim();
    if (text) {
      document.body.removeChild(container);
      onSelect({ text: text, tone: 'custom', why: '用户自定义输入' });
    }
  });
  // 回车提交
  $customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = ($customInput.value || '').trim();
      if (text) {
        document.body.removeChild(container);
        onSelect({ text: text, tone: 'custom', why: '用户自定义输入' });
      }
    }
  });

  // 添加"不回复"卡片
  const noReplyCard = document.createElement('div');
  noReplyCard.className = 'reply-card';
  noReplyCard.style.borderStyle = 'dashed';
  noReplyCard.style.opacity = '0.8';
  noReplyCard.innerHTML = `
    <div class="reply-card-header">
      <span class="reply-emoji">🤐</span>
      <span class="reply-label" style="color: #9E9E9E">不回复</span>
    </div>
    <div class="reply-text" style="color: #999;">模拟对方已读不回的场景</div>
    <button class="reply-select-btn" id="noReplyBtn" style="margin-top: 8px; background: #9E9E9E;">选择不回复</button>
  `;
  cardsContainer.appendChild(noReplyCard);

  // 不回复按钮
  const $noReplyBtn = noReplyCard.querySelector('#noReplyBtn');
  $noReplyBtn.addEventListener('click', async () => {
    document.body.removeChild(container);
    // 标记最后一条用户消息为"未回复"
    markLastUserMessageNoReply();
    renderMessages();
    notifyStateChange();
    // 触发 AI 教练给出新建议
    await callSuggest('peerMsg');
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
      // fallback 回复后立即保存
      notifyStateChange();
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
        // 用户选择后立即触发保存
        notifyStateChange();
      });
    } else {
      // 其他模式：自动选择
      const selectedReply = selectReplyByDifficulty(replies, difficulty);
      if (selectedReply) {
        state.conversation.push({role:'peer', text: selectedReply.text, ts: nowTs()});
        renderMessages();
        updateOpeningGuidance();
        await callSuggest('peerMsg');
        // AI 回复后立即触发保存
        notifyStateChange();
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

// --- ReadM.md 折叠展示（Vue 版） ---
function createReadmeUi() {
  const container = document.createElement('div');
  container.className = 'readme-container';
  const btn = document.createElement('button');
  btn.id = 'readmeToggle';
  btn.className = 'secondary small readme-toggle';
  btn.innerHTML = '📖 查看 README';
  const panel = document.createElement('div');
  panel.id = 'readmePanel';
  panel.className = 'readme-panel hidden';
  container.appendChild(btn);
  container.appendChild(panel);
  const app = document.getElementById('soul-app');
  if (app) app.appendChild(container);
  return { btn, panel };
}

function ensureMarked() {
  return new Promise((resolve, reject) => {
    if (window.marked) return resolve();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
}

let _readmeLoaded = false;
async function loadReadme(panel) {
  try {
    const res = await fetch('/ReadM.md', { cache: 'no-store' });
    const md = await res.text();
    try {
      await ensureMarked();
      if (window.marked && window.marked.parse) {
        panel.innerHTML = window.marked.parse(md);
      } else if (window.marked) {
        panel.innerHTML = window.marked(md);
      } else {
        panel.innerHTML = md.replace(/\n/g, '<br>');
      }
    } catch {
      panel.innerHTML = md.replace(/\n/g, '<br>');
    }
    _readmeLoaded = true;
  } catch (e) {
    console.error('Load ReadM.md failed', e);
    panel.textContent = 'README 加载失败，请稍后重试';
  }
}

function initReadme() {
  const { btn, panel } = createReadmeUi();
  btn.addEventListener('click', async () => {
    if (panel.classList.contains('hidden')) {
      if (!_readmeLoaded) await loadReadme(panel);
      panel.classList.remove('hidden');
      btn.innerHTML = '📖 隐藏 README';
    } else {
      panel.classList.add('hidden');
      btn.innerHTML = '📖 查看 README';
    }
  });
}

// 初始化 README 折叠面板
initReadme();


// ============================================
// 存档系统钩子 (Save System Hooks)
// ============================================

/**
 * 全局 SoulApp 对象，供 Vue 组件调用
 */
window.SoulApp = {
  /**
   * 从存档数据加载状态
   * @param {Object} saveData - 存档数据
   */
  loadFromSave(saveData) {
    if (!saveData) return;
    
    console.log('📂 开始加载存档:', saveData);
    
    // 恢复对话历史
    const session = saveData.current_session || {};
    state.conversation = (session.conversation || []).map(turn => ({
      role: turn.role,
      text: turn.text,
      ts: turn.ts || Date.now() / 1000
    }));
    
    // 恢复关系指数（使用 relationship_index 字段）
    const relIndex = session.relationship_index || session.start_relationship || 50;
    renderRelation(relIndex);
    
    // 恢复场景配置
    const scenarioConfig = saveData.scenario_config;
    // 检查 scenarioConfig 是否有实际内容（不只是空对象）
    const hasScenarioConfig = scenarioConfig && (
      scenarioConfig.scenario || 
      scenarioConfig.opponent?.roleTitle || 
      (scenarioConfig.opponent?.traits && scenarioConfig.opponent.traits.length > 0) ||
      scenarioConfig.userGoal?.goal
    );
    console.log('📂 场景配置检查:', {
      scenarioConfig,
      hasScenario: !!scenarioConfig?.scenario,
      hasRoleTitle: !!scenarioConfig?.opponent?.roleTitle,
      hasTraits: scenarioConfig?.opponent?.traits?.length > 0,
      hasGoal: !!scenarioConfig?.userGoal?.goal,
      hasScenarioConfig
    });
    if (hasScenarioConfig) {
      console.log('📂 恢复场景配置:', scenarioConfig);
      
      // 展开分析结果区域
      if ($analysisResultBlock) {
        $analysisResultBlock.classList.remove('hidden');
      }
      
      // 填充场景面板
      if ($scenarioText) {
        $scenarioText.value = scenarioConfig.scenario || '';
      }
      if ($opponentRoleTitle) {
        $opponentRoleTitle.value = scenarioConfig.opponent?.roleTitle || '';
      }
      if (scenarioConfig.opponent?.traits) {
        setTraits(scenarioConfig.opponent.traits);
      } else {
        setTraits([]);
      }
      if ($userGoal) {
        $userGoal.value = scenarioConfig.userGoal?.goal || '';
      }
      if ($userGoalReason && scenarioConfig.userGoal?.reason) {
        $userGoalReason.textContent = scenarioConfig.userGoal.reason ? `原因：${scenarioConfig.userGoal.reason}` : '';
      }
      if ($opponentDifficulty && scenarioConfig.difficulty) {
        $opponentDifficulty.value = scenarioConfig.difficulty;
        state.opponentDifficulty = scenarioConfig.difficulty;
      }
      
      // 应用场景到 state
      state.scenario.applied = {
        scenario: scenarioConfig.scenario || '',
        opponent: scenarioConfig.opponent || { roleTitle: '', traits: [] },
        userGoal: scenarioConfig.userGoal || { goal: '', reason: '' },
        flow: scenarioConfig.flow || {}
      };
      state.scenario.enabled = true;
      state.scenario.draft = collectDraftFromDom();
      state.scenario.dirty = false;
      
      if ($scenarioEnabled) $scenarioEnabled.checked = true;
    } else {
      // 没有场景配置或配置为空，清空
      console.log('📂 无有效场景配置，将显示引导向导');
      state.scenario.applied = null;
      state.scenario.enabled = false;
      if ($scenarioEnabled) $scenarioEnabled.checked = false;
    }
    
    // 渲染界面
    renderMessages();
    updateScenarioChip();
    updateOpeningGuidance();
    
    // 如果有对话历史，触发一次建议刷新
    if (state.conversation.length > 0 && state.alwaysOn) {
      callSuggest('typing');
    }
    
    // 如果是空存档（新建的），显示引导向导
    if (state.conversation.length === 0 && !state.scenario.applied) {
      setTimeout(() => showSetupWizard(true), 300);
    }
    
    console.log('✅ 存档已加载，对话轮数:', state.conversation.length, '场景:', state.scenario.applied?.scenario);
  },
  
  /**
   * 获取当前状态用于保存
   * @returns {Object} 可保存的状态数据
   */
  getStateForSave() {
    const relIndex = parseInt($relText?.textContent || '50') || 50;
    
    return {
      conversation: state.conversation.map(turn => ({
        role: turn.role,
        text: turn.text,
        ts: turn.ts
      })),
      relationship_index: relIndex,
      scenario_config: state.scenario.applied ? {
        scenario: state.scenario.applied.scenario || '',
        opponent: state.scenario.applied.opponent || { roleTitle: '', traits: [] },
        userGoal: state.scenario.applied.userGoal || { goal: '', reason: '' },
        difficulty: state.opponentDifficulty || 'realistic',
        flow: state.scenario.applied.flow || {}
      } : null
    };
  },
  
  /**
   * 清空当前状态（用于切换存档或重新开始）
   */
  clearState() {
    state.conversation = [];
    state.scenario.applied = null;
    state.scenario.enabled = false;
    state.scenario.draft = { scenario: '', opponent: { roleTitle: '', traits: [] }, userGoal: { goal: '', reason: '' } };
    state.scenario.dirty = false;
    state.opening.userStartOverride = false;
    
    // 清空 DOM
    if ($scenarioText) $scenarioText.value = '';
    if ($opponentRoleTitle) $opponentRoleTitle.value = '';
    if ($userGoal) $userGoal.value = '';
    if ($userGoalReason) $userGoalReason.textContent = '';
    setTraits([]);
    if ($scenarioEnabled) $scenarioEnabled.checked = false;
    
    renderMessages();
    renderRelation(50);
    renderCandidates([]);
    renderTip('点击左侧"提示"按钮获取建议；或开启"始终提示"。');
    updateScenarioChip();
    
    console.log('✅ 状态已清空');
  },
  
  /**
   * 状态变化回调（由 Vue 组件设置）
   */
  onStateChange: null,
  
  /**
   * 获取当前对话轮数
   */
  getConversationLength() {
    return state.conversation.length;
  },
  
  /**
   * 获取当前关系指数
   */
  getRelationshipIndex() {
    return parseInt($relText?.textContent || '50') || 50;
  }
};

/**
 * 通知状态变化（触发自动保存）
 */
function notifyStateChange() {
  if (window.SoulApp.onStateChange) {
    const data = window.SoulApp.getStateForSave();
    console.log('📤 notifyStateChange 触发，数据:', data);
    console.log('📤 scenario_config:', data.scenario_config);
    window.SoulApp.onStateChange(data);
  }
}

// 在关键操作后触发状态变化通知
// 重写 onSend 以添加通知
const _originalOnSend = onSend;
onSend = async function() {
  await _originalOnSend.apply(this, arguments);
  notifyStateChange();
};

// 重写 callAiReply 以添加通知
const _originalCallAiReply = callAiReply;
callAiReply = async function() {
  await _originalCallAiReply.apply(this, arguments);
  notifyStateChange();
};

// 重写 onPeerSim 以添加通知
const _originalOnPeerSim = onPeerSim;
onPeerSim = async function() {
  await _originalOnPeerSim.apply(this, arguments);
  notifyStateChange();
};

// 场景应用后也通知
const _originalApplyScenario = applyScenario;
applyScenario = function() {
  _originalApplyScenario.apply(this, arguments);
  console.log('📤 applyScenario 完成，state.scenario.applied:', state.scenario.applied);
  notifyStateChange();
};

console.log('✅ Soul TalkBuddy 存档钩子已加载');


// ============================================
// 引导弹窗向导
// ============================================

const PRESET_SCENARIOS = [
  { id: 'interview', emoji: '💼', label: '面试', desc: '求职面试，展示自己', scenario: '求职面试现场，面试官正在考察你', roleTitle: 'HR面试官', traits: ['专业严谨', '善于提问', '观察细致'], goal: '展示自己的能力和价值' },
  { id: 'confession', emoji: '💕', label: '表白', desc: '向心仪的人表达心意', scenario: '和心仪的人单独相处，想要表达心意', roleTitle: '心仪对象', traits: ['温柔体贴', '有些害羞'], goal: '成功表达心意，获得积极回应' },
  { id: 'social', emoji: '🤝', label: '社交', desc: '认识新朋友，破冰聊天', scenario: '社交场合，初次认识一位新朋友', roleTitle: '新朋友', traits: ['自然随和', '表达简洁'], goal: '建立融洽关系，留下好印象' },
  { id: 'apologize', emoji: '😅', label: '道歉', desc: '修复关系，真诚道歉', scenario: '因为某件事需要向对方道歉', roleTitle: '朋友', traits: ['有些生气', '但愿意沟通'], goal: '获得对方的谅解，修复关系' },
  { id: 'negotiate', emoji: '📢', label: '谈判', desc: '薪资谈判或商务合作', scenario: '薪资谈判或商务合作洽谈', roleTitle: '对方代表', traits: ['精明务实', '注重利益'], goal: '达成对双方都有利的协议' },
  { id: 'custom', emoji: '✏️', label: '自定义', desc: '自己设定场景', scenario: '', roleTitle: '', traits: [], goal: '' }
];

const PRESET_TRAITS = ['自然随和', '表达简洁', '专业严谨', '善于提问', '温柔体贴', '有些害羞', '热情开朗', '内向安静', '幽默风趣', '认真负责'];

const PRESET_GOALS = ['建立融洽关系', '展示自己的能力', '获得对方认可', '成功邀约', '解决问题', '获得信息', '达成共识'];

/**
 * 显示引导弹窗
 * @param {boolean} isNewSave - 是否是新建存档触发
 */
function showSetupWizard(isNewSave = false) {
  // 如果已经有弹窗，先移除
  const existing = document.getElementById('setupWizardOverlay');
  if (existing) existing.remove();

  let currentStep = 1;
  const wizardData = {
    scenario: '',
    roleTitle: '',
    traits: [],
    goal: ''
  };

  // 创建弹窗容器
  const overlay = document.createElement('div');
  overlay.id = 'setupWizardOverlay';
  overlay.innerHTML = `
    <style>
      #setupWizardOverlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .wizard-modal {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease;
      }
      @keyframes slideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .wizard-header {
        padding: 20px 24px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .wizard-steps {
        display: flex;
        gap: 8px;
      }
      .wizard-step-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #E0E0E0;
        transition: all 0.3s;
      }
      .wizard-step-dot.active {
        background: #7C4DFF;
        transform: scale(1.2);
      }
      .wizard-step-dot.done {
        background: #4CAF50;
      }
      .wizard-skip {
        color: #999;
        font-size: 14px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s;
      }
      .wizard-skip:hover {
        background: #f5f5f5;
        color: #666;
      }
      .wizard-content {
        padding: 24px;
      }
      .wizard-title {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #333;
      }
      .wizard-subtitle {
        font-size: 14px;
        color: #666;
        margin-bottom: 20px;
        line-height: 1.5;
      }
      .wizard-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }
      .wizard-card {
        padding: 16px 12px;
        border: 2px solid #E0E0E0;
        border-radius: 12px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
      }
      .wizard-card:hover {
        border-color: #7C4DFF;
        background: #F3E5F5;
      }
      .wizard-card.selected {
        border-color: #7C4DFF;
        background: #EDE7F6;
      }
      .wizard-card-emoji {
        font-size: 28px;
        margin-bottom: 8px;
      }
      .wizard-card-label {
        font-size: 14px;
        font-weight: 500;
        color: #333;
      }
      .wizard-card-desc {
        font-size: 11px;
        color: #999;
        margin-top: 4px;
      }
      .wizard-input {
        width: 100%;
        padding: 12px;
        border: 2px solid #E0E0E0;
        border-radius: 8px;
        font-size: 14px;
        resize: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }
      .wizard-input:focus {
        outline: none;
        border-color: #7C4DFF;
      }
      .wizard-input-label {
        font-size: 13px;
        color: #666;
        margin-bottom: 8px;
        display: block;
      }
      .wizard-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }
      .wizard-tag {
        padding: 6px 12px;
        background: #F5F5F5;
        border: 1px solid #E0E0E0;
        border-radius: 16px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .wizard-tag:hover {
        background: #EDE7F6;
        border-color: #7C4DFF;
      }
      .wizard-tag.selected {
        background: #7C4DFF;
        color: white;
        border-color: #7C4DFF;
      }
      .wizard-footer {
        padding: 16px 24px 24px;
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .wizard-btn {
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }
      .wizard-btn-secondary {
        background: #F5F5F5;
        color: #666;
      }
      .wizard-btn-secondary:hover {
        background: #E0E0E0;
      }
      .wizard-btn-primary {
        background: #7C4DFF;
        color: white;
        flex: 1;
      }
      .wizard-btn-primary:hover {
        background: #651FFF;
      }
      .wizard-btn-primary:disabled {
        background: #BDBDBD;
        cursor: not-allowed;
      }
      .wizard-summary {
        background: #F5F5F5;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .wizard-summary-item {
        display: flex;
        margin-bottom: 8px;
      }
      .wizard-summary-item:last-child {
        margin-bottom: 0;
      }
      .wizard-summary-label {
        width: 80px;
        color: #999;
        font-size: 13px;
      }
      .wizard-summary-value {
        flex: 1;
        color: #333;
        font-size: 13px;
      }
      .wizard-tip {
        background: #E3F2FD;
        border-radius: 8px;
        padding: 12px;
        font-size: 13px;
        color: #1976D2;
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }
      .wizard-tip-icon {
        font-size: 16px;
      }
    </style>
    <div class="wizard-modal">
      <div class="wizard-header">
        <div class="wizard-steps">
          <div class="wizard-step-dot active" data-step="1"></div>
          <div class="wizard-step-dot" data-step="2"></div>
          <div class="wizard-step-dot" data-step="3"></div>
          <div class="wizard-step-dot" data-step="4"></div>
        </div>
        <span class="wizard-skip" id="wizardSkip">跳过向导</span>
      </div>
      <div class="wizard-content" id="wizardContent"></div>
      <div class="wizard-footer" id="wizardFooter"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const $content = overlay.querySelector('#wizardContent');
  const $footer = overlay.querySelector('#wizardFooter');
  const $skip = overlay.querySelector('#wizardSkip');
  const $dots = overlay.querySelectorAll('.wizard-step-dot');

  // 更新步骤指示器
  function updateSteps() {
    $dots.forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      if (i + 1 < currentStep) dot.classList.add('done');
      if (i + 1 === currentStep) dot.classList.add('active');
    });
  }

  // 渲染步骤1：选择场景
  function renderStep1() {
    $content.innerHTML = `
      <div class="wizard-title">👋 欢迎来到 Soul Talk Buddy！</div>
      <div class="wizard-subtitle">我是你的 AI 沟通教练，帮你练习重要对话。<br>让我们先设置一下今天的练习场景吧～</div>
      <div class="wizard-cards" id="scenarioCards"></div>
      <label class="wizard-input-label">或者描述你的场景：</label>
      <textarea class="wizard-input" id="customScenario" rows="2" placeholder="例如：社团招新现场，初次认识一位学弟...">${wizardData.scenario}</textarea>
    `;
    const $cards = $content.querySelector('#scenarioCards');
    PRESET_SCENARIOS.forEach(s => {
      const card = document.createElement('div');
      card.className = 'wizard-card' + (wizardData.scenario === s.scenario && s.id !== 'custom' ? ' selected' : '');
      card.dataset.id = s.id;
      card.innerHTML = `
        <div class="wizard-card-emoji">${s.emoji}</div>
        <div class="wizard-card-label">${s.label}</div>
        <div class="wizard-card-desc">${s.desc}</div>
      `;
      card.onclick = () => {
        if (s.id === 'custom') {
          $content.querySelector('#customScenario').focus();
          return;
        }
        wizardData.scenario = s.scenario;
        wizardData.roleTitle = s.roleTitle;
        wizardData.traits = [...s.traits];
        wizardData.goal = s.goal;
        $cards.querySelectorAll('.wizard-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        $content.querySelector('#customScenario').value = s.scenario;
      };
      $cards.appendChild(card);
    });
    $content.querySelector('#customScenario').addEventListener('input', (e) => {
      wizardData.scenario = e.target.value;
      $cards.querySelectorAll('.wizard-card').forEach(c => c.classList.remove('selected'));
    });
    $footer.innerHTML = `
      <button class="wizard-btn wizard-btn-primary" id="btnNext1">下一步 →</button>
    `;
    $footer.querySelector('#btnNext1').onclick = () => {
      if (!wizardData.scenario.trim()) {
        wizardData.scenario = '日常对话场景';
      }
      currentStep = 2;
      updateSteps();
      renderStep2();
    };
  }

  // 渲染步骤2：设定对方
  function renderStep2() {
    $content.innerHTML = `
      <div class="wizard-title">🎭 对方是什么样的人？</div>
      <div class="wizard-subtitle">给对方一个角色和性格，让练习更真实～</div>
      <label class="wizard-input-label">对方的角色称谓：</label>
      <input class="wizard-input" id="inputRoleTitle" type="text" placeholder="例如：学弟、HR、心仪对象..." value="${wizardData.roleTitle}">
      <label class="wizard-input-label" style="margin-top: 16px;">对方的性格特征（点击选择或自定义）：</label>
      <div class="wizard-tags" id="traitTags"></div>
      <input class="wizard-input" id="inputCustomTrait" type="text" placeholder="输入自定义特征，按回车添加">
    `;
    const $tags = $content.querySelector('#traitTags');
    const renderTags = () => {
      $tags.innerHTML = '';
      const allTraits = [...new Set([...PRESET_TRAITS, ...wizardData.traits])];
      allTraits.forEach(t => {
        const tag = document.createElement('span');
        tag.className = 'wizard-tag' + (wizardData.traits.includes(t) ? ' selected' : '');
        tag.textContent = t;
        tag.onclick = () => {
          if (wizardData.traits.includes(t)) {
            wizardData.traits = wizardData.traits.filter(x => x !== t);
          } else {
            wizardData.traits.push(t);
          }
          renderTags();
        };
        $tags.appendChild(tag);
      });
    };
    renderTags();
    $content.querySelector('#inputRoleTitle').addEventListener('input', (e) => {
      wizardData.roleTitle = e.target.value;
    });
    $content.querySelector('#inputCustomTrait').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = e.target.value.trim();
        if (val && !wizardData.traits.includes(val)) {
          wizardData.traits.push(val);
          renderTags();
        }
        e.target.value = '';
      }
    });
    $footer.innerHTML = `
      <button class="wizard-btn wizard-btn-secondary" id="btnPrev2">← 上一步</button>
      <button class="wizard-btn wizard-btn-primary" id="btnNext2">下一步 →</button>
    `;
    $footer.querySelector('#btnPrev2').onclick = () => { currentStep = 1; updateSteps(); renderStep1(); };
    $footer.querySelector('#btnNext2').onclick = () => {
      if (!wizardData.roleTitle.trim()) wizardData.roleTitle = '对方';
      currentStep = 3;
      updateSteps();
      renderStep3();
    };
  }

  // 渲染步骤3：明确目标
  function renderStep3() {
    $content.innerHTML = `
      <div class="wizard-title">🎯 你希望达成什么目标？</div>
      <div class="wizard-subtitle">明确目标能让 AI 教练给你更精准的建议～</div>
      <div class="wizard-tags" id="goalTags"></div>
      <label class="wizard-input-label" style="margin-top: 8px;">或者自定义目标：</label>
      <input class="wizard-input" id="inputGoal" type="text" placeholder="例如：建立融洽关系、获得面试机会..." value="${wizardData.goal}">
    `;
    const $tags = $content.querySelector('#goalTags');
    PRESET_GOALS.forEach(g => {
      const tag = document.createElement('span');
      tag.className = 'wizard-tag' + (wizardData.goal === g ? ' selected' : '');
      tag.textContent = g;
      tag.onclick = () => {
        wizardData.goal = g;
        $tags.querySelectorAll('.wizard-tag').forEach(t => t.classList.remove('selected'));
        tag.classList.add('selected');
        $content.querySelector('#inputGoal').value = g;
      };
      $tags.appendChild(tag);
    });
    $content.querySelector('#inputGoal').addEventListener('input', (e) => {
      wizardData.goal = e.target.value;
      $tags.querySelectorAll('.wizard-tag').forEach(t => t.classList.remove('selected'));
    });
    $footer.innerHTML = `
      <button class="wizard-btn wizard-btn-secondary" id="btnPrev3">← 上一步</button>
      <button class="wizard-btn wizard-btn-primary" id="btnNext3">完成设置 ✓</button>
    `;
    $footer.querySelector('#btnPrev3').onclick = () => { currentStep = 2; updateSteps(); renderStep2(); };
    $footer.querySelector('#btnNext3').onclick = () => {
      if (!wizardData.goal.trim()) wizardData.goal = '自然交流';
      currentStep = 4;
      updateSteps();
      renderStep4();
    };
  }

  // 渲染步骤4：确认并开始
  function renderStep4() {
    $content.innerHTML = `
      <div class="wizard-title">✅ 设置完成！</div>
      <div class="wizard-subtitle">确认一下你的练习设置：</div>
      <div class="wizard-summary">
        <div class="wizard-summary-item">
          <span class="wizard-summary-label">场景</span>
          <span class="wizard-summary-value">${wizardData.scenario || '日常对话'}</span>
        </div>
        <div class="wizard-summary-item">
          <span class="wizard-summary-label">对方</span>
          <span class="wizard-summary-value">${wizardData.roleTitle || '对方'}${wizardData.traits.length ? '（' + wizardData.traits.join('、') + '）' : ''}</span>
        </div>
        <div class="wizard-summary-item">
          <span class="wizard-summary-label">目标</span>
          <span class="wizard-summary-value">${wizardData.goal || '自然交流'}</span>
        </div>
      </div>
      <div class="wizard-tip">
        <span class="wizard-tip-icon">💡</span>
        <span>这些设置已同步到左侧面板，你可以随时在那里修改。</span>
      </div>
    `;
    $footer.innerHTML = `
      <button class="wizard-btn wizard-btn-secondary" id="btnPrev4">← 返回修改</button>
      <button class="wizard-btn wizard-btn-primary" id="btnStart">🚀 开始练习</button>
    `;
    $footer.querySelector('#btnPrev4').onclick = () => { currentStep = 3; updateSteps(); renderStep3(); };
    $footer.querySelector('#btnStart').onclick = () => {
      applyWizardData();
      closeWizard();
    };
  }

  // 应用向导数据到场景配置
  function applyWizardData() {
    // 填充左侧面板
    if ($scenarioText) $scenarioText.value = wizardData.scenario;
    if ($opponentRoleTitle) $opponentRoleTitle.value = wizardData.roleTitle;
    if ($userGoal) $userGoal.value = wizardData.goal;
    setTraits(wizardData.traits);
    
    // 更新 state
    state.scenario.draft = {
      scenario: wizardData.scenario,
      opponent: { roleTitle: wizardData.roleTitle, traits: wizardData.traits },
      userGoal: { goal: wizardData.goal, reason: '' }
    };
    
    // 启用场景并应用
    if ($scenarioEnabled) $scenarioEnabled.checked = true;
    state.scenario.enabled = true;
    
    // 直接应用（不调用 AI 分析，使用用户设置的值）
    state.scenario.applied = {
      scenario: wizardData.scenario,
      opponent: { roleTitle: wizardData.roleTitle, traits: wizardData.traits },
      userGoal: { goal: wizardData.goal, reason: '' },
      flow: { startingParty: 'either' }
    };
    state.scenario.dirty = false;
    
    // 更新 UI
    updateScenarioChip();
    updateOpeningGuidance();
    
    // 展开分析结果区域
    if ($analysisResultBlock) {
      $analysisResultBlock.classList.remove('hidden');
    }
    
    // 通知状态变化
    notifyStateChange();
    
    console.log('✅ 向导设置已应用:', wizardData);
  }

  // 关闭弹窗
  function closeWizard() {
    overlay.style.animation = 'fadeIn 0.2s ease reverse';
    setTimeout(() => overlay.remove(), 200);
    // 记录已完成向导
    localStorage.setItem('soulWizardCompleted', 'true');
  }

  // 跳过向导
  $skip.onclick = () => {
    closeWizard();
  };

  // 点击遮罩不关闭（防止误操作）
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      // 可以选择关闭或不关闭，这里选择不关闭
    }
  };

  // 初始渲染
  updateSteps();
  renderStep1();
}

/**
 * 检查是否需要显示引导弹窗
 */
function checkShowWizard() {
  // 如果是 Vue 组件环境（有 onStateChange 回调），由 loadFromSave 触发向导
  if (window.SoulApp.onStateChange) {
    return;
  }
  // 如果是从存档加载的，不显示向导
  if (state.conversation.length > 0 || state.scenario.applied) {
    return;
  }
  // 延迟显示，等页面渲染完成
  setTimeout(() => showSetupWizard(), 500);
}

// 暴露给外部调用
window.SoulApp.showSetupWizard = showSetupWizard;

// 页面加载完成后检查是否显示向导
// 注意：如果是 Vue 组件加载存档，会在 loadFromSave 中处理
setTimeout(checkShowWizard, 1000);

console.log('✅ 引导弹窗向导已加载');
