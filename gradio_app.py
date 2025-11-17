import os
import gradio as gr

from backend.models.types import (
	SuggestRequest, ConversationTurn, Profile, MemoryItem, PersonaWeights,
	MBTISubmitRequest, MBTIAnswer, PeerReplyRequest, OpponentProfile
)
from backend.services.suggest_service import handle_suggest
from backend.services.persona_service import compute_mbti_submit
from backend.services.peer_service import generate_peer_reply


def _conv_to_messages(conversation):
	"""
	Convert internal list[{role:'user|peer', text}] to gr.Chatbot(type='messages') messages:
	[{'role':'user'|'assistant','content':'...'}, ...]
	"""
	msgs = []
	for t in conversation:
		role = "user" if t.get("role") == "user" else "assistant"
		content = t.get("text") or ""
		msgs.append({"role": role, "content": content})
	return msgs


QUIZ_12 = [
	("聚会后更需要独处恢复还是更有能量？", "EI", False),
	("做决定更依赖事实与逻辑还是感受与价值？", "TF", False),
	("交流更喜欢具体细节还是宏观想法与可能性？", "SN", True),
	("计划外变化更倾向维持计划还是灵活应对？", "JP", False),
	("初识更主动开场还是观察后再加入？", "EI", False),
	("描述事物更常用数据因果还是体验意义？", "TF", False),
	("看电影更在意剧情逻辑还是人物情感？", "TF", False),
	("旅行更偏行程表还是随心走？", "JP", False),
	("聊天更常举实例还是展开联想？", "SN", False),
	("空闲更愿社交还是宅家？", "EI", False),
	("学习时更看重概念框架还是动手实践？", "SN", True),
	("面对分歧更讲道理还是先安抚情绪？", "TF", True),
]


def _render_cands(cands):
	"""将候选列表转换为 Gradio Radio 可用的格式"""
	choices = [f"{it['text']}（{it['why'] or '—'}）" for it in cands]
	return gr.update(choices=choices, value=None)


def do_suggest(conversation, draft, persona_enabled, persona_funcs, entry_type):
	persona = None
	if persona_enabled and persona_funcs:
		persona = PersonaWeights(**{**persona_funcs, "enabled": True})
	req = SuggestRequest(
		conversation=[ConversationTurn(**t) for t in conversation],
		draft=draft or "",
		entryType=entry_type,
		userProfile=Profile(),
		peerProfile=Profile(),
		memory=[],
		personaWeights=persona,
	)
	resp = handle_suggest(req)
	tip = resp.tip.text
	cands = [{"id": c.id, "text": c.text, "why": c.why, "risk": c.risk, "score": c.score} for c in resp.candidates]
	return tip, cands, resp.relationship.index


def ui_send(user_text, conversation, persona_enabled, persona_funcs):
	if not user_text.strip():
		return gr.update(), conversation, "请输入内容后再发送~", gr.update(choices=[], value=None), 0
	conversation = list(conversation)
	conversation.append({"role": "user", "text": user_text.strip()})
	# postSend 建议（用于下一步）
	tip, cands, rel = do_suggest(conversation, "", persona_enabled, persona_funcs, "postSend")
	return _conv_to_messages(conversation), conversation, tip, _render_cands(cands), rel


def ui_peer_reply(conversation, persona_enabled, persona_funcs, style):
	conversation = list(conversation)
	req = PeerReplyRequest(
		conversation=[ConversationTurn(**t) for t in conversation],
		opponent=OpponentProfile(style=style or "自然", persona_hint=""),
		personaWeights=PersonaWeights(**{**persona_funcs, "enabled": True}) if (persona_enabled and persona_funcs) else None,
	)
	reply = generate_peer_reply(req)
	conversation.append({"role": "peer", "text": reply.text})
	tip, cands, rel = do_suggest(conversation, "", persona_enabled, persona_funcs, "peerMsg")
	return _conv_to_messages(conversation), conversation, tip, _render_cands(cands), rel


def ui_tip(conversation, draft, persona_enabled, persona_funcs):
	tip, cands, rel = do_suggest(conversation, draft or "", persona_enabled, persona_funcs, "typing" if draft else "idle")
	return tip, _render_cands(cands), rel


def ui_apply_candidate(choice_text):
	return choice_text or ""


def ui_submit_mbti(*vals):
	answers = [MBTIAnswer(dim=dim, value=int((v or 3)), reverse=rev) for (_, dim, rev), v in zip(QUIZ_12, vals)]
	resp = compute_mbti_submit(MBTISubmitRequest(answers=answers, mode="quick"))
	persona_funcs = resp.functions
	msg = f"MBTI: {resp.mbti}  可信度: {resp.confidence}\n应用到建议：已开启"
	return True, persona_funcs, msg


with gr.Blocks(title="Echo 共情对话教练 - Demo（ModelScope版）") as demo:
	gr.Markdown("### Echo 共情对话教练（ModelScope Gradio Demo）")

	conversation = gr.State([])  # list of {role,text}
	persona_enabled = gr.State(False)
	persona_funcs = gr.State(None)

	with gr.Row():
		chat = gr.Chatbot(height=420, type="messages")
		with gr.Column(scale=1):
			tip_md = gr.Markdown(value="点击“提示”获取建议")
			cands_radio = gr.Radio(choices=[], label="候选（点选后可采纳到输入框）", interactive=True)
			rel_bar = gr.Slider(label="关系晴雨表", minimum=0, maximum=100, value=50, interactive=False)

	with gr.Row():
		user_in = gr.Textbox(label="输入消息", placeholder="输入内容...")
	with gr.Row():
		send_btn = gr.Button("发送", variant="primary")
		peer_btn = gr.Button("AI回复")
		tip_btn = gr.Button("提示")
		apply_btn = gr.Button("采纳候选到输入框")
		style_dd = gr.Dropdown(choices=["自然","活泼","理性","温和","专业","俏皮","克制"], value="自然", label="AI风格", scale=1)

	with gr.Accordion("MBTI / 八维（快速测评 12 题）", open=False):
		quiz_inputs = []
		for q, _, _ in QUIZ_12:
			quiz_inputs.append(gr.Slider(1, 5, value=3, step=1, label=q))
		mbti_btn = gr.Button("提交测评", variant="primary")
		mbti_tip = gr.Markdown("未设置")

	send_btn.click(
		ui_send,
		inputs=[user_in, conversation, persona_enabled, persona_funcs],
		outputs=[chat, conversation, tip_md, cands_radio, rel_bar]
	).then(lambda: gr.update(value=""), None, [user_in])

	peer_btn.click(
		ui_peer_reply,
		inputs=[conversation, persona_enabled, persona_funcs, style_dd],
		outputs=[chat, conversation, tip_md, cands_radio, rel_bar]
	)

	tip_btn.click(
		ui_tip,
		inputs=[conversation, user_in, persona_enabled, persona_funcs],
		outputs=[tip_md, cands_radio, rel_bar]
	)

	apply_btn.click(ui_apply_candidate, inputs=[cands_radio], outputs=[user_in])

	mbti_btn.click(
		ui_submit_mbti,
		inputs=quiz_inputs,
		outputs=[persona_enabled, persona_funcs, mbti_tip]
	)

	# 底部添加项目说明
	with gr.Accordion("📖 项目说明", open=False):
		gr.Markdown("""
# Soul TalkBuddy｜灵感搭子 💬✨

**和会"回"的AI一起练聊天，边聊边更会聊** 😎👉🗣️

一个面向Z世代的社交对话练习场，通过AI对手实战 + 实时建议，帮你把社交焦虑变成可练的肌肉记忆。

---

## 🎯 项目定位

**功能**：AI对话练习场 + 实时建议引擎 + MBTI个性化定制

**目标用户**：
- 🎓 高校学生（本科/硕士/博士）：想提升社交表达、减少"社死"瞬间
- 💼 初入职场新人：需要快速适应职场沟通、建立人脉
- 🌍 社交焦虑人群：希望在一个安全、无压力的环境中练习聊天技巧
- 🎮 年轻玩家：喜欢AI互动、想探索"人机共创"的社交新玩法

**核心价值**：把"不会聊天"变成"可以练习的技能"，让每一次对话都成为成长的机会。

---

## ✨ 创新点

### 1. **实时建议引擎**（Always-on Coaching）
- 📊 **顶部轻提示**：输入时实时给出"温度建议"（语气/禁忌/可聊锚点）
- 🎯 **三条候选卡片**：镜像/稳妥/幽默三种风格，点选即用，附"为什么这样建议"的可解释标签
- 🛡️ **安全不踩雷**：敏感拦截 + 改写兜底，避免"社死"瞬间

### 2. **AI对手实战陪练**（Simulated Social Practice）
- 🤖 **多风格AI对手**：自然/活泼/理性/温和/专业/俏皮/克制，像真人一样陪你练
- 🔄 **闭环反馈**：我说 → AI回 → 提示 → 采纳 → 效果，形成完整的"模拟实战教学"
- 📈 **关系晴雨表**：量化互动质量（0-100），实时反馈你的聊天表现

### 3. **MBTI/荣格八维个性化**（Persona-Driven Suggestions）
- 🧠 **快速测评**：12题快速测评，30秒出结果
- 🔍 **会话推断**：从聊天记录弱监督推断MBTI，无需手动测评
- 🎨 **个性化建议**：根据你的八维偏好（Ni/Ne/Si/Se/Ti/Te/Fi/Fe）调整候选措辞
  - S倾向 → 更具体的例子与步骤
  - N倾向 → 更多类比与愿景式表述
  - T倾向 → 更偏逻辑、事实的语气
  - F倾向 → 更偏共情、情感承接

### 4. **智能语境理解**（Context-Aware Intelligence）
- ❓ **问句识别**：对方提问时，强制"先回答再补一句"，避免"反问式社死"
- 🔗 **关键词锚点**：必须承接对方上一条的关键词，确保对话连贯
- 🌦️ **冷场修复**：超过阈值未互动 → 自动给"续聊锚点"与上下文接力句

### 5. **可解释性与复盘**（Explainable & Reflective）
- 📝 **一键复盘**：对话结束后给出"什么有效/什么下次可改"的简报
- 🎯 **采纳率追踪**：记录你采纳建议的频率，优化推荐策略
- 📊 **指标看板**：采纳率、被回复率、对话长度、冷场恢复率等

---

## 🛠️ 技术架构

基于 **FastAPI + ModelScope(Qwen/Qwen3-8B)** 的演示项目：
- 始终提示 + 三条候选卡片 + MBTI/荣格八维测评与会话推断

## 使用说明
- 输入时：上方"温度提示"与下方"三条候选卡片"实时更新
- 发送前会做一次"强审校"
- "MBTI/八维"按钮：可做 12 题快速测评；亦可基于会话推断
- 可勾选"应用到建议"，将八维偏好用于候选重排与措辞
		""")

if __name__ == "__main__":
	# 在本地测试：python deploy/gradio_app.py
	demo.queue().launch(server_name="0.0.0.0", server_port=int(os.getenv("PORT", "7860")))


