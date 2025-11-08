import os
import gradio as gr

from backend.models.types import (
	SuggestRequest, ConversationTurn, Profile, MemoryItem, PersonaWeights,
	MBTISubmitRequest, MBTIAnswer, PeerReplyRequest, OpponentProfile
)
from backend.services.suggest_service import handle_suggest
from backend.services.persona_service import compute_mbti_submit
from backend.services.peer_service import generate_peer_reply


def _conv_to_pairs(conversation):
	"""
	Convert internal {role,text} list to gradio chatbot pairs.
	"""
	pairs = []
	user_buf = None
	for t in conversation:
		if t["role"] == "user":
			user_buf = t["text"]
			pairs.append([user_buf, None])
		else:
			if not pairs:
				pairs.append([None, t["text"]])
			else:
				if pairs[-1][1] is None:
					pairs[-1][1] = t["text"]
				else:
					pairs.append([None, t["text"]])
	return pairs


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
		return gr.update(), conversation, "请输入内容后再发送~", [], 0
	conversation = list(conversation)
	conversation.append({"role": "user", "text": user_text.strip()})
	# postSend 建议（用于下一步）
	tip, cands, rel = do_suggest(conversation, "", persona_enabled, persona_funcs, "postSend")
	return _conv_to_pairs(conversation), conversation, tip, cands, rel


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
	return _conv_to_pairs(conversation), conversation, tip, cands, rel


def ui_tip(conversation, draft, persona_enabled, persona_funcs):
	tip, cands, rel = do_suggest(conversation, draft or "", persona_enabled, persona_funcs, "typing" if draft else "idle")
	return tip, cands, rel


def ui_apply_candidate(choice_text):
	return choice_text or ""


def ui_submit_mbti(vals):
	answers = [MBTIAnswer(dim=dim, value=int(v or 3), reverse=rev) for (_, dim, rev), v in zip(QUIZ_12, vals)]
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
		with gr.Column(scale=0.8):
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
		style_dd = gr.Dropdown(choices=["自然","活泼","理性","温和","专业","俏皮","克制"], value="自然", label="AI风格", scale=0.6)

	with gr.Accordion("MBTI / 八维（快速测评 12 题）", open=False):
		quiz_inputs = []
		for q, _, _ in QUIZ_12:
			quiz_inputs.append(gr.Slider(1, 5, value=3, step=1, label=q))
		mbti_btn = gr.Button("提交测评", variant="primary")
		mbti_tip = gr.Markdown("未设置")

	def _render_cands(cands):
		choices = [f"{it['text']}（{it['why'] or '—'}）" for it in cands]
		return gr.update(choices=choices, value=None)

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

if __name__ == "__main__":
	# 在本地测试：python deploy/gradio_app.py
	demo.queue().launch(server_name="0.0.0.0", server_port=int(os.getenv("PORT", "7860")))


