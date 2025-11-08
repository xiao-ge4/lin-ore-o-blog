// 简易全局状态
const state = {
  conversation: [], // {role:"user"|"peer", text, ts}
  persona: { enabled: false, mbti: null, functions: null },
  alwaysOn: true,
  lastSuggestPayload: null
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
const $aiStyle = document.getElementById('aiStyle');

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

async function callSuggest(entryType) {
  try {
    const now = Date.now();
    if (entryType === 'typing' && now - lastSuggestAt < 1200) {
      return; // 频控：避免请求过密
    }
    const payload = {
      conversation: state.conversation,
      draft: $draft.value,
      entryType,
      userProfile: {},
      peerProfile: {},
      memory: [],
      personaWeights: state.persona.enabled && state.persona.functions ? {
        ...state.persona.functions, enabled: true
      } : null
    };
    state.lastSuggestPayload = payload;
    const res = await fetch('/api/suggest', {
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

async function callAiReply() {
  try {
    const payload = {
      conversation: state.conversation,
      opponent: {
        style: $aiStyle ? $aiStyle.value : '自然',
        persona_hint: ''
      },
      personaWeights: state.persona.enabled && state.persona.functions ? {
        ...state.persona.functions, enabled: true
      } : null
    };
    const res = await fetch('/api/peer/reply', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const text = (data && data.text) ? String(data.text) : '我们可以继续聊聊刚才的话题～';
    state.conversation.push({role:'peer', text, ts: nowTs()});
    renderMessages();
    await callSuggest('peerMsg');
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
  const res = await fetch('/api/mbti/submit', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ answers, mode: 'quick' })
  });
  const data = await res.json();
  state.persona.mbti = data.mbti;
  state.persona.functions = data.functions;
  state.persona.enabled = true;
  await fetch('/api/persona/apply', {
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
  const res = await fetch('/api/mbti/infer-from-chat', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ conversation: state.conversation })
  });
  const data = await res.json();
  state.persona.mbti = data.mbtiGuess || null;
  state.persona.functions = data.functionsGuess || null;
  state.persona.enabled = true;
  await fetch('/api/persona/apply', {
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
$btnPersona.addEventListener('click', () => {
  $mbtiModal.classList.remove('hidden');
  renderQuiz($quizContainer, QUIZ_12);
  $quizResult.classList.add('hidden');
});
$modalClose.addEventListener('click', () => $mbtiModal.classList.add('hidden'));
$btnSubmitQuiz.addEventListener('click', submitQuiz);
$personaEnabled.addEventListener('change', async (e) => {
  state.persona.enabled = !!e.target.checked;
  await fetch('/api/persona/apply', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ mbti: state.persona.mbti, functions: state.persona.functions, enabled: state.persona.enabled })
  });
  // 变更后刷新建议
  callSuggest('typing');
});
$btnInfer.addEventListener('click', inferFromChat);
// 手动“提示”按钮
$btnFetchTip.addEventListener('click', () => callSuggest('typing'));

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


