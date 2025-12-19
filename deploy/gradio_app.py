import os
import json
import gradio as gr

from backend.models.types import (
	SuggestRequest, ConversationTurn, Profile, MemoryItem, PersonaWeights,
	MBTISubmitRequest, MBTIAnswer, PeerReplyRequest, OpponentProfile,
	ScenarioInput, ScenarioContext, UserGoal
)
from backend.services.suggest_service import handle_suggest
from backend.services.persona_service import compute_mbti_submit
from backend.services.peer_service import generate_peer_reply
from backend.services.scenario_service import analyze_scenario

# 自定义CSS样式 - Gradio风格（浅橙色边框 + 渐变导航栏）
CUSTOM_CSS = """
/* 全局背景 */
.gradio-container {
    background: white !important;
}

/* 渐变Header */
#custom-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    padding: 24px 32px !important;
    border-radius: 0 !important;
    margin: -16px -16px 24px -16px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

#custom-header h1 {
    color: white !important;
    font-size: 28px !important;
    font-weight: 700 !important;
    margin: 0 !important;
}

#custom-header p {
    color: rgba(255, 255, 255, 0.9) !important;
    font-size: 14px !important;
    margin: 8px 0 0 0 !important;
}

/* Gradio风格的浅橙色边框 */
.gradio-textbox input,
.gradio-textbox textarea,
.gradio-dropdown select,
.gradio-slider input,
.gradio-radio label,
input[type="text"],
textarea,
select {
    border: 2px solid #FF7C00 !important;
    border-radius: 8px !important;
    transition: all 0.2s ease !important;
}

/* Focus状态 - 深橙色 */
.gradio-textbox input:focus,
.gradio-textbox textarea:focus,
.gradio-dropdown select:focus,
input[type="text"]:focus,
textarea:focus,
select:focus {
    border-color: #F56A00 !important;
    box-shadow: 0 0 0 3px rgba(255, 124, 0, 0.1) !important;
    outline: none !important;
}

/* Radio选项 */
.gradio-radio label {
    border: 2px solid #FF7C00 !important;
    padding: 12px 16px !important;
    border-radius: 8px !important;
    margin-bottom: 8px !important;
    cursor: pointer !important;
    transition: all 0.2s ease !important;
    background: white !important;
}

.gradio-radio label:hover {
    border-color: #F56A00 !important;
    background: #FFF4E6 !important;
}

.gradio-radio input:checked + label {
    border-color: #F56A00 !important;
    background: #FFE4CC !important;
    font-weight: 600 !important;
}

/* 按钮样式 */
.gradio-button {
    border-radius: 8px !important;
    font-weight: 600 !important;
    transition: all 0.2s ease !important;
}

.gradio-button.primary {
    background: linear-gradient(135deg, #FF7C00, #F56A00) !important;
    border: none !important;
    color: white !important;
}

.gradio-button.primary:hover {
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(255, 124, 0, 0.3) !important;
}

.gradio-button.secondary {
    border: 2px solid #FF7C00 !important;
    background: white !important;
    color: #FF7C00 !important;
}

.gradio-button.secondary:hover {
    background: #FFF4E6 !important;
    border-color: #F56A00 !important;
}

/* Chatbot样式 */
.message-wrap {
    border-radius: 16px !important;
}

.message.user {
    background: linear-gradient(135deg, #FF7C00, #F56A00) !important;
    color: white !important;
}

.message.bot {
    background: white !important;
    border: 2px solid #FF7C00 !important;
}

/* Slider样式 */
.gradio-slider input[type="range"]::-webkit-slider-thumb {
    background: #FF7C00 !important;
}

.gradio-slider input[type="range"]::-moz-range-thumb {
    background: #FF7C00 !important;
}

/* Accordion样式 */
.gradio-accordion {
    border: 2px solid #FF7C00 !important;
    border-radius: 8px !important;
}

/* Markdown提示框样式 */
.markdown-text {
    background: #FFF4E6 !important;
    border-left: 4px solid #FF7C00 !important;
    padding: 12px 16px !important;
    border-radius: 8px !important;
}

/* 关系晴雨表特殊样式 */
#rel-bar .gradio-slider {
    background: linear-gradient(90deg, #FF7C00, #F56A00) !important;
}

/* Traits chips 样式 */
.traits-chips-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
}

.trait-chip {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    background: #FFF4E6;
    border: 2px solid #FF7C00;
    border-radius: 16px;
    font-size: 13px;
    gap: 6px;
}

.trait-chip-remove {
    cursor: pointer;
    color: #F56A00;
    font-weight: bold;
    font-size: 16px;
    line-height: 1;
}

.trait-chip-remove:hover {
    color: #d9534f;
}

/* 回复选择卡片样式 */
.reply-selection-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.reply-selection-panel {
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.reply-selection-header h4 {
    margin: 0 0 16px 0;
    color: #333;
}

.reply-selection-cards {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.reply-card {
    border: 2px solid #FF7C00;
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    transition: all 0.2s;
}

.reply-card:hover {
    background: #FFF4E6;
    border-color: #F56A00;
}

.reply-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.reply-emoji {
    font-size: 20px;
}

.reply-label {
    font-weight: 600;
    font-size: 14px;
}

.reply-text {
    margin: 8px 0;
    color: #333;
}

.reply-why {
    font-size: 12px;
    color: #666;
    margin-top: 4px;
}

.reply-select-btn {
    margin-top: 8px;
    padding: 8px 16px;
    background: #FF7C00;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
}

.reply-select-btn:hover {
    background: #F56A00;
}
"""


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

# 场景模板（与Vue版本一致）
SCENARIO_TEMPLATES = {
	"自定义": "",
	"🎓 社团招新": "社团招新现场，初次认识一位学弟，希望自然破冰并建立融洽。",
	"💼 技术面试": "技术面试环节，自我介绍后与面试官交流，希望展现契合度并获取正向反馈。",
	"👔 职场沟通": "向同事请教项目细节，希望高效获取关键信息并建立合作。",
	"💝 约会聊天": "第一次约会的开场聊天，希望自然轻松并推进下一次邀约。",
	"🎉 同学聚会": "多年未见的同学聚会，期望重建联系并延伸到会后互动。"
}

# 模板到详细设置的映射
TEMPLATE_DETAILS = {
	"🎓 社团招新": {
		"scenario": "社团招新现场，初次认识一位学弟，希望自然破冰并建立融洽。",
		"opponentRoleTitle": "学弟",
		"opponentTraits": ["自然随和", "表达简洁", "对新鲜事好奇"],
		"userGoal": "建立融洽"
	},
	"💼 技术面试": {
		"scenario": "技术面试环节，自我介绍后与面试官交流，希望展现契合度并获取正向反馈。",
		"opponentRoleTitle": "面试官",
		"opponentTraits": ["专业理性", "关注事实与例证", "简洁直给"],
		"userGoal": "展现契合度"
	},
	"👔 职场沟通": {
		"scenario": "向同事请教项目细节，希望高效获取关键信息并建立合作。",
		"opponentRoleTitle": "同事",
		"opponentTraits": ["注重效率", "信息导向", "理性直接"],
		"userGoal": "获取关键信息"
	},
	"💝 约会聊天": {
		"scenario": "第一次约会的开场聊天，希望自然轻松并推进下一次邀约。",
		"opponentRoleTitle": "新认识的朋友",
		"opponentTraits": ["温和体贴", "幽默轻松", "慢热"],
		"userGoal": "推进邀约"
	},
	"🎉 同学聚会": {
		"scenario": "多年未见的同学聚会，期望重建联系并延伸到会后互动。",
		"opponentRoleTitle": "同学",
		"opponentTraits": ["自然亲切", "怀旧倾向", "愿意分享近况"],
		"userGoal": "重建联系"
	}
}


def _render_cands(cands):
	"""将候选列表转换为 Gradio Radio 可用的格式"""
	choices = [f"{it['text']}（{it['why'] or '—'}）" for it in cands]
	return gr.update(choices=choices, value=None)


def _render_traits_html(traits_list):
	"""渲染traits chips的HTML"""
	if not traits_list:
		return ""
	chips_html = '<div class="traits-chips-container">'
	for trait in traits_list:
		chips_html += f'<span class="trait-chip">{trait}<span class="trait-chip-remove" onclick="removeTrait(this)">×</span></span>'
	chips_html += '</div>'
	return chips_html


def do_suggest(conversation, draft, persona_enabled, persona_funcs, entry_type, scenario_context=None):
	"""生成建议，支持传入场景上下文"""
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
		scenario=scenario_context  # 传递场景数据
	)
	resp = handle_suggest(req)
	tip = resp.tip.text
	cands = [{"id": c.id, "text": c.text, "why": c.why, "risk": c.risk, "score": c.score} for c in resp.candidates]
	return tip, cands, resp.relationship.index


def ui_send(user_text, conversation, persona_enabled, persona_funcs, scenario_context, ai_opponent_enabled, opponent_difficulty):
	"""发送消息 - 完全按照Vue版本逻辑"""
	if not user_text.strip():
		return gr.update(), conversation, "请输入内容后再发送~", gr.update(choices=[], value=None), 50, gr.update(visible=False)
	conversation = list(conversation)
	conversation.append({"role": "user", "text": user_text.strip()})
	# postSend 建议（用于下一步）
	tip, cands, rel = do_suggest(conversation, "", persona_enabled, persona_funcs, "postSend", scenario_context)
	
	# 更新开场指引（发送后隐藏）- 按照Vue版本的updateOpeningGuidance逻辑
	return _conv_to_messages(conversation), conversation, tip, _render_cands(cands), rel, gr.update(visible=False)


def ui_peer_reply(conversation, persona_enabled, persona_funcs, scenario_context, ai_opponent_enabled, opponent_difficulty):
	"""AI对手回复 - 完全按照Vue版本逻辑：只传opponent: {persona_hint: ""}，不传style，完全依赖scenario"""
	conversation = list(conversation)
	
	if not ai_opponent_enabled:
		# 简单模拟回复
		samples = [
			'哈哈这事儿挺有意思的，你怎么看？',
			'周末还没安排呢，可能去走走～',
			'我最近有点忙，回得慢一点别介意哈',
		]
		reply_text = samples[(len(conversation) % len(samples))]
		conversation.append({"role": "peer", "text": reply_text})
		tip, cands, rel = do_suggest(conversation, "", persona_enabled, persona_funcs, "peerMsg", scenario_context)
		return _conv_to_messages(conversation), conversation, tip, _render_cands(cands), rel, gr.update(visible=False)
	
	# AI对手回复 - 完全按照Vue版本：只传persona_hint，不传style，完全依赖scenario
	req = PeerReplyRequest(
		conversation=[ConversationTurn(**t) for t in conversation],
		opponent=OpponentProfile(persona_hint=""),  # 不传style，完全依赖scenario
		personaWeights=PersonaWeights(**{**persona_funcs, "enabled": True}) if (persona_enabled and persona_funcs) else None,
		scenario=scenario_context
	)
	reply_resp = generate_peer_reply(req)
	
	# 根据难度模式选择回复
	replies = [{"id": r.id, "text": r.text, "tone": r.tone, "why": getattr(r, 'why', '')} for r in (reply_resp.replies or [])]
	
	if not replies:
		replies = [{"id": "default", "text": reply_resp.text, "tone": "neutral", "why": ""}]
	
	selected_reply = None
	ATTITUDE_MAP = {
		'positive': {'emoji': '😊', 'label': '积极', 'color': '#4CAF50'},
		'neutral': {'emoji': '😐', 'label': '中立', 'color': '#FF9800'},
		'negative': {'emoji': '😅', 'label': '委婉拒绝', 'color': '#9E9E9E'}
	}
	
	if opponent_difficulty == "custom":
		# custom模式：不自动添加回复，等待用户选择
		# 将回复选项格式化为Radio可用的格式
		replies_choices = []
		for r in replies:
			attitude = ATTITUDE_MAP.get(r.get('tone', 'neutral'), ATTITUDE_MAP['neutral'])
			choice_text = f"{attitude['emoji']} {r['text']} ({attitude['label']})"
			replies_choices.append(choice_text)
		# 返回未修改的对话，显示选择界面
		return _conv_to_messages(conversation), conversation, "请从下方选择对方的回复", gr.update(choices=[], value=None), 50, replies, gr.update(choices=replies_choices, value=None, visible=True)
	else:
		# 其他模式：自动选择
		selected_reply = _select_reply_by_difficulty(replies, opponent_difficulty)
		conversation.append({"role": "peer", "text": selected_reply["text"]})
		tip, cands, rel = do_suggest(conversation, "", persona_enabled, persona_funcs, "peerMsg", scenario_context)
		return _conv_to_messages(conversation), conversation, tip, _render_cands(cands), rel, None, gr.update(visible=False)


def _select_reply_by_difficulty(replies, difficulty):
	"""根据难度模式选择回复"""
	if not replies or len(replies) == 0:
		return {"id": "default", "text": "我们可以继续聊聊刚才的话题～", "tone": "neutral"}
	if len(replies) == 1:
		return replies[0]
	
	import random
	if difficulty == "friendly":
		# 总是选择积极的
		positive = [r for r in replies if r.get("tone") == "positive"]
		return positive[0] if positive else replies[0]
	elif difficulty == "realistic":
		# 随机选择
		return random.choice(replies)
	elif difficulty == "challenging":
		# 倾向中立/拒绝（70%概率）
		if random.random() < 0.7:
			negatives = [r for r in replies if r.get("tone") in ["neutral", "negative"]]
			if negatives:
				return random.choice(negatives)
		return random.choice(replies)
	else:
		return replies[0]


def _render_reply_selection_html(replies):
	"""渲染回复选择卡片的HTML"""
	ATTITUDE_MAP = {
		'positive': {'emoji': '😊', 'label': '积极', 'color': '#4CAF50'},
		'neutral': {'emoji': '😐', 'label': '中立', 'color': '#FF9800'},
		'negative': {'emoji': '😅', 'label': '委婉拒绝', 'color': '#9E9E9E'}
	}
	
	html = '<div class="reply-selection-panel"><div class="reply-selection-header"><h4>对方可能这样回复，请选择：</h4></div><div class="reply-selection-cards">'
	for reply in replies:
		attitude = ATTITUDE_MAP.get(reply.get("tone", "neutral"), ATTITUDE_MAP['neutral'])
		html += f'''
		<div class="reply-card" onclick="selectReply('{reply["text"].replace("'", "\\'")}')">
			<div class="reply-card-header">
				<span class="reply-emoji">{attitude['emoji']}</span>
				<span class="reply-label" style="color: {attitude['color']}">{attitude['label']}</span>
			</div>
			<div class="reply-text">{reply["text"]}</div>
			{('<div class="reply-why">💭 ' + reply.get("why", "") + '</div>') if reply.get("why") else ''}
		</div>
		'''
	html += '</div></div>'
	return html


def ui_tip(conversation, draft, persona_enabled, persona_funcs, scenario_context):
	"""获取提示"""
	tip, cands, rel = do_suggest(conversation, draft or "", persona_enabled, persona_funcs, "typing" if draft else "idle", scenario_context)
	return tip, _render_cands(cands), rel


def ui_apply_candidate(choice_text):
	"""采纳候选到输入框"""
	return choice_text or ""


def ui_submit_mbti(*vals):
	"""提交MBTI测评"""
	answers = [MBTIAnswer(dim=dim, value=int((v or 3)), reverse=rev) for (_, dim, rev), v in zip(QUIZ_12, vals)]
	resp = compute_mbti_submit(MBTISubmitRequest(answers=answers, mode="quick"))
	persona_funcs = resp.functions
	msg = f"MBTI: {resp.mbti}  可信度: {resp.confidence}\n应用到建议：已开启"
	return True, persona_funcs, msg


def ui_select_scenario_template(template_name, lock_role, lock_traits, lock_goal):
	"""选择场景模板时自动填充"""
	if template_name == "自定义" or not template_name:
		return "", "", "", ""
	
	details = TEMPLATE_DETAILS.get(template_name, {})
	scenario_text = details.get("scenario", "")
	opponent_role = details.get("opponentRoleTitle", "") if not lock_role else ""
	opponent_traits = details.get("opponentTraits", []) if not lock_traits else []
	user_goal = details.get("userGoal", "") if not lock_goal else ""
	
	traits_html = _render_traits_html(opponent_traits)
	
	return scenario_text, opponent_role, traits_html, user_goal, opponent_traits


def ui_analyze_scenario(scenario_text, opponent_role, opponent_traits_list, user_goal, lock_role, lock_traits, lock_goal, auto_analyze):
	"""分析场景"""
	if not scenario_text.strip():
		return "⚠️ 请先输入场景描述", scenario_text, opponent_role, "", user_goal, None
	
	try:
		req = ScenarioInput(
			templateId="custom",
			scenarioText=scenario_text,
			opponentHint=opponent_role or "",
			opponentTraits=opponent_traits_list or [],
			userGoalHint=user_goal or "",
			mode="full"
		)
		resp = analyze_scenario(req)
		
		# 合并到草稿（尊重锁定）
		new_scenario = resp.scenario or scenario_text
		new_opponent_role = ""
		new_opponent_traits = []
		new_user_goal = ""
		
		if resp.opponent:
			if not lock_role and resp.opponent.roleTitle:
				new_opponent_role = resp.opponent.roleTitle
			else:
				new_opponent_role = opponent_role
			
			if not lock_traits and resp.opponent.traits:
				new_opponent_traits = resp.opponent.traits
			else:
				new_opponent_traits = opponent_traits_list or []
		else:
			new_opponent_role = opponent_role
			new_opponent_traits = opponent_traits_list or []
		
		if resp.userGoal and resp.userGoal.goal:
			if not lock_goal:
				new_user_goal = resp.userGoal.goal
			else:
				new_user_goal = user_goal
		else:
			new_user_goal = user_goal
		
		# 提取约束和锚点
		tips = ""
		if resp.constraints and isinstance(resp.constraints, dict):
			avoid_list = resp.constraints.get('avoid', []) if isinstance(resp.constraints.get('avoid'), list) else []
			if avoid_list:
				tips += f"🚫 注意避免：{', '.join(avoid_list)}\n"
		if resp.anchors:
			tips += f"💡 可聊话题：{', '.join(resp.anchors)}"
		
		success_msg = f"✅ 场景分析完成！\n\n{tips}\n\n⚠️ 请点击'保留并应用'按钮来启用场景设置。"
		
		traits_html = _render_traits_html(new_opponent_traits)
		
		return success_msg, new_scenario, new_opponent_role, traits_html, new_user_goal, resp, new_opponent_traits
	except Exception as e:
		return f"❌ 分析失败：{str(e)}", scenario_text, opponent_role, _render_traits_html(opponent_traits_list or []), user_goal, None, opponent_traits_list or []


def ui_apply_scenario(analyzed_scenario, scenario_enabled, conversation, persona_enabled, persona_funcs, scenario_text, opponent_role, opponent_traits_state, user_goal):
	"""应用场景设置 - 完全按照Vue版本的applyScenario逻辑：应用后立即触发callSuggest('typing')"""
	if not analyzed_scenario:
		return "⚠️ 请先点击'分析场景'", analyzed_scenario, "💡 场景未设置", True, "", gr.update(choices=[], value=None), 50
	
	# 构建状态文本（完全按照Vue版本的updateScenarioChip逻辑）
	role_title = (analyzed_scenario.opponent and analyzed_scenario.opponent.roleTitle) or ""
	traits = (analyzed_scenario.opponent and analyzed_scenario.opponent.traits) or []
	goal = (analyzed_scenario.userGoal and analyzed_scenario.userGoal.goal) or ""
	traits_preview = "、".join(traits[:2]) if traits else "形象未设"
	
	# 检查是否有未应用的更改（dirty状态）- 完全按照Vue版本的markScenarioDirty逻辑
	draft = {
		"scenario": scenario_text or "",
		"opponent": {"roleTitle": opponent_role or "", "traits": opponent_traits_state or []},
		"userGoal": {"goal": user_goal or ""}
	}
	applied = {
		"scenario": analyzed_scenario.scenario or "",
		"opponent": {"roleTitle": role_title, "traits": traits},
		"userGoal": {"goal": goal}
	}
	dirty = (
		(draft.get("scenario") or "") != (applied.get("scenario") or "") or
		((draft.get("opponent") or {}).get("roleTitle") or "") != ((applied.get("opponent") or {}).get("roleTitle") or "") or
		(",".join((draft.get("opponent") or {}).get("traits") or [])) != (",".join((applied.get("opponent") or {}).get("traits") or [])) or
		((draft.get("userGoal") or {}).get("goal") or "") != ((applied.get("userGoal") or {}).get("goal") or "")
	)
	
	status_text = f"已生效：{role_title or '未设'} | 形象：{traits_preview} | 目标：{goal or '-'}"
	if dirty:
		status_text += "（有未应用更改）"
	applied_info = f"🎬 {status_text}"
	
	# 应用后立即触发提示（callSuggest typing）- 完全按照Vue版本
	tip, cands, rel = do_suggest(conversation, "", persona_enabled, persona_funcs, "typing", analyzed_scenario)
	
	return "✅ 场景已应用！所有建议将根据此场景生成。", analyzed_scenario, applied_info, True, tip, _render_cands(cands), rel


def ui_add_trait(trait_input, current_traits):
	"""添加trait"""
	if not trait_input or not trait_input.strip():
		return current_traits, "", _render_traits_html(current_traits)
	
	traits = list(current_traits) if current_traits else []
	new_trait = trait_input.strip()
	if new_trait and new_trait not in traits:
		traits.append(new_trait)
		traits = traits[:8]  # 最多8个
	
	return traits, "", _render_traits_html(traits)


def ui_remove_trait(trait_to_remove, current_traits):
	"""移除trait"""
	if not current_traits:
		return current_traits, _render_traits_html([])
	traits = [t for t in current_traits if t != trait_to_remove]
	return traits, _render_traits_html(traits)


def ui_update_opening_guidance(scenario_context, conversation, user_start_override=False):
	"""更新开场指引 - 完全按照Vue版本的updateOpeningGuidance逻辑"""
	if not scenario_context or not scenario_context.flow:
		return gr.update(visible=False), gr.update(visible=False)
	
	starting_party = scenario_context.flow.startingParty or "either"
	is_empty = len(conversation) == 0
	
	# 完全按照Vue版本：shouldShow = state.scenario.enabled && isEmpty && state.opening.startingParty === 'opponent' && !state.opening.userStartOverride
	should_show = starting_party == "opponent" and is_empty and not user_start_override
	
	if should_show:
		hints = scenario_context.flow.openingHints or []
		hints_text = "；".join(hints) if hints else "对方先开场"
		guidance_text = f"**开场指引**\n\n当前场景通常由对方先开场。开场建议：{hints_text}"
		return gr.update(value=guidance_text, visible=True), gr.update(visible=True)
	
	return gr.update(visible=False), gr.update(visible=False)




with gr.Blocks(
	title="Echo 共情对话教练 - Demo（ModelScope版）",
	css=CUSTOM_CSS,
	theme=gr.themes.Soft(
		primary_hue="orange",
		secondary_hue="blue",
		neutral_hue="gray",
	)
) as demo:
	# 自定义渐变Header
	gr.HTML("""
		<div id="custom-header">
			<h1>🗣️ Echo 共情对话教练</h1>
			<p>和会"回"的AI一起练聊天，边聊边更会聊 | ModelScope Gradio Demo</p>
		</div>
	""")
	
	# 状态管理
	conversation = gr.State([])  # list of {role,text}
	persona_enabled = gr.State(False)
	persona_funcs = gr.State(None)
	analyzed_scenario_data = gr.State(None)  # 分析后的场景数据（未应用）
	scenario_context = gr.State(None)  # 已应用的场景数据
	scenario_enabled = gr.State(False)  # 场景是否启用
	opponent_traits_state = gr.State([])  # 对手traits列表
	ai_opponent_enabled = gr.State(False)  # AI对手是否启用
	opponent_difficulty_state = gr.State("realistic")  # 对手难度模式
	user_start_override = gr.State(False)  # 用户选择我先开场
	
	# 开场指引
	opening_guidance = gr.Markdown("", visible=False, elem_classes="markdown-text")
	with gr.Row(visible=False) as opening_buttons_row:
		btn_let_opponent_start = gr.Button("让对方先开场", variant="secondary", scale=1)
		btn_user_start_override = gr.Button("我先开场", variant="secondary", scale=1)
	
	# 显示已生效的场景信息（会实时更新dirty状态）
	scenario_status = gr.Markdown("💡 场景未设置", elem_classes="markdown-text")
	
	def _update_scenario_status(scn_ctx, scn_text, opp_role, opp_traits, usr_goal):
		"""更新场景状态显示 - 完全按照Vue版本的updateScenarioChip逻辑，包括dirty检查"""
		if not scn_ctx:
			return "💡 场景未设置"
		
		role_title = (scn_ctx.opponent and scn_ctx.opponent.roleTitle) or ""
		traits = (scn_ctx.opponent and scn_ctx.opponent.traits) or []
		goal = (scn_ctx.userGoal and scn_ctx.userGoal.goal) or ""
		traits_preview = "、".join(traits[:2]) if traits else "形象未设"
		
		# 检查dirty状态 - 完全按照Vue版本的markScenarioDirty逻辑
		draft = {
			"scenario": scn_text or "",
			"opponent": {"roleTitle": opp_role or "", "traits": opp_traits or []},
			"userGoal": {"goal": usr_goal or ""}
		}
		applied = {
			"scenario": scn_ctx.scenario or "",
			"opponent": {"roleTitle": role_title, "traits": traits},
			"userGoal": {"goal": goal}
		}
		dirty = (
			(draft.get("scenario") or "") != (applied.get("scenario") or "") or
			((draft.get("opponent") or {}).get("roleTitle") or "") != ((applied.get("opponent") or {}).get("roleTitle") or "") or
			(",".join((draft.get("opponent") or {}).get("traits") or [])) != (",".join((applied.get("opponent") or {}).get("traits") or [])) or
			((draft.get("userGoal") or {}).get("goal") or "") != ((applied.get("userGoal") or {}).get("goal") or "")
		)
		
		status_text = f"已生效：{role_title or '未设'} | 形象：{traits_preview} | 目标：{goal or '-'}"
		if dirty:
			status_text += "（有未应用更改）"
		return f"🎬 {status_text}"
	
	with gr.Row():
		chat = gr.Chatbot(height=420, type="messages")
		with gr.Column(scale=1):
			tip_md = gr.Markdown(value='💡 点击"提示"获取建议', elem_classes="markdown-text")
			cands_radio = gr.Radio(choices=[], label="📝 候选回复（点选后可采纳到输入框）", interactive=True)
			rel_bar = gr.Slider(label="🌈 关系晴雨表", minimum=0, maximum=100, value=50, interactive=False, elem_id="rel-bar")
	
	with gr.Row():
		user_in = gr.Textbox(label="输入消息", placeholder="输入内容...")
	with gr.Row():
		send_btn = gr.Button("发送", variant="primary")
		peer_btn = gr.Button("AI回复")
		tip_btn = gr.Button("提示")
		apply_btn = gr.Button("采纳候选到输入框")
	
	with gr.Row():
		ai_opponent_checkbox = gr.Checkbox(label="🤖 AI对手", value=False)
		opponent_difficulty = gr.Dropdown(
			choices=["friendly", "realistic", "challenging", "custom"],
			value="realistic",
			label="难度模式",
			info="friendly=友好, realistic=真实, challenging=挑战, custom=手动选择"
		)
	
	with gr.Accordion("🎬 场景设置（设定对话背景和目标）", open=False):
		with gr.Row():
			scenario_template = gr.Radio(
				choices=list(SCENARIO_TEMPLATES.keys()),
				value="自定义",
				label="快速选择场景模板",
				interactive=True
			)
		with gr.Row():
			scenario_text = gr.Textbox(
				label="📝 场景描述",
				placeholder="例如：社团招新现场，初次认识一位学弟...",
				lines=3
			)
		with gr.Row():
			opponent_role = gr.Textbox(
				label="👤 对方称谓",
				placeholder="例如：学弟、面试官、同事...",
				lines=1
			)
			user_goal = gr.Textbox(
				label="🎯 我的目标",
				placeholder="例如：自然破冰并建立融洽关系...",
				lines=1
			)
		with gr.Row():
			opponent_traits_input = gr.Textbox(
				label="🏷️ 对方形象特征（输入后按Enter添加）",
				placeholder="例如：自然随和、表达简洁...",
				lines=1
			)
			opponent_traits_html = gr.HTML(value="", label="已添加的特征")
		with gr.Row():
			lock_role = gr.Checkbox(label="🔒 锁定称谓", value=False)
			lock_traits = gr.Checkbox(label="🔒 锁定形象", value=False)
			lock_goal = gr.Checkbox(label="🔒 锁定目标", value=False)
		with gr.Row():
			auto_analyze_checkbox = gr.Checkbox(label="🔄 自动分析（输入时自动触发）", value=False)
		with gr.Row():
			analyze_btn = gr.Button("🔍 分析场景", variant="primary")
			apply_btn_scenario = gr.Button("✅ 保留并应用", variant="secondary")
		scenario_result = gr.Markdown("💡 设置场景后，AI会根据场景给出更精准的建议")
	
	with gr.Accordion("MBTI / 八维（快速测评 12 题）", open=False):
		quiz_inputs = []
		for q, _, _ in QUIZ_12:
			quiz_inputs.append(gr.Slider(1, 5, value=3, step=1, label=q))
		mbti_btn = gr.Button("提交测评", variant="primary")
		mbti_tip = gr.Markdown("未设置")
	
	# 回复选择面板（custom模式用）
	with gr.Row(visible=False) as reply_selection_row:
		reply_selection_radio = gr.Radio(choices=[], label="选择对方回复", interactive=True)
		reply_selection_confirm_btn = gr.Button("确认选择", variant="primary")
	reply_selection_data = gr.State(None)  # 存储回复选项数据
	
	# 事件绑定
	def _conditional_peer_reply(conv, persona_en, persona_f, scn_ctx, ai_enabled, diff):
		"""条件触发AI回复 - 完全按照Vue版本逻辑"""
		if ai_enabled:
			return ui_peer_reply(conv, persona_en, persona_f, scn_ctx, ai_enabled, diff)
		else:
			return gr.update(), conv, "", gr.update(choices=[], value=None), 50, None, gr.update(visible=False)
	
	send_btn.click(
		ui_send,
		inputs=[user_in, conversation, persona_enabled, persona_funcs, scenario_context, ai_opponent_enabled, opponent_difficulty_state],
		outputs=[chat, conversation, tip_md, cands_radio, rel_bar, opening_guidance]
	).then(
		lambda: gr.update(value=""), None, [user_in]
	).then(
		# 如果开启了AI对手，自动触发回复 - 完全按照Vue版本的onSend逻辑
		_conditional_peer_reply,
		inputs=[conversation, persona_enabled, persona_funcs, scenario_context, ai_opponent_enabled, opponent_difficulty_state],
		outputs=[chat, conversation, tip_md, cands_radio, rel_bar, reply_selection_data, reply_selection_row]
	)
	
	peer_btn.click(
		ui_peer_reply,
		inputs=[conversation, persona_enabled, persona_funcs, scenario_context, ai_opponent_enabled, opponent_difficulty_state],
		outputs=[chat, conversation, tip_md, cands_radio, rel_bar, reply_selection_data, reply_selection_row]
	)
	
	# 确认选择回复（custom模式）
	def _confirm_reply_selection(selected_choice, replies_data, conv, persona_en, persona_f, scn_ctx):
		"""确认选择回复 - 完全按照Vue版本的逻辑"""
		if not selected_choice or not replies_data:
			return gr.update(), conv, "", gr.update(choices=[], value=None), 50, gr.update(visible=False)
		
		# 从选择的文本中提取回复内容
		# selected_choice格式: "😊 回复内容 (积极)"
		# 找到最后一个" ("的位置，提取前面的内容（去掉emoji）
		if " (" in selected_choice:
			choice_without_label = selected_choice.split(" (")[0]
			# 去掉开头的emoji和空格
			selected_text = choice_without_label.split(" ", 1)[1] if " " in choice_without_label else choice_without_label
		else:
			selected_text = selected_choice.split(" ", 1)[1] if " " in selected_choice else selected_choice
		
		# 在replies_data中找到匹配的回复
		selected_reply = None
		for r in replies_data:
			if r.get("text") == selected_text:
				selected_reply = r
				break
		
		if not selected_reply:
			# 如果找不到，使用第一条
			selected_reply = replies_data[0] if replies_data else {"text": "我们可以继续聊聊刚才的话题～", "tone": "neutral"}
		
		# 添加到对话
		conv = list(conv)
		conv.append({"role": "peer", "text": selected_reply["text"]})
		
		# 触发建议
		tip, cands, rel = do_suggest(conv, "", persona_en, persona_f, "peerMsg", scn_ctx)
		
		return _conv_to_messages(conv), conv, tip, _render_cands(cands), rel, gr.update(visible=False)
	
	reply_selection_confirm_btn.click(
		_confirm_reply_selection,
		inputs=[reply_selection_radio, reply_selection_data, conversation, persona_enabled, persona_funcs, scenario_context],
		outputs=[chat, conversation, tip_md, cands_radio, rel_bar, reply_selection_row]
	)
	
	tip_btn.click(
		ui_tip,
		inputs=[conversation, user_in, persona_enabled, persona_funcs, scenario_context],
		outputs=[tip_md, cands_radio, rel_bar]
	)
	
	apply_btn.click(ui_apply_candidate, inputs=[cands_radio], outputs=[user_in])
	
	mbti_btn.click(
		ui_submit_mbti,
		inputs=quiz_inputs,
		outputs=[persona_enabled, persona_funcs, mbti_tip]
	)
	
	# AI对手开关
	ai_opponent_checkbox.change(
		lambda x: (x, "AI回复" if x else "对方回复"),
		inputs=[ai_opponent_checkbox],
		outputs=[ai_opponent_enabled, peer_btn]
	)
	
	# 难度模式
	opponent_difficulty.change(
		lambda x: x,
		inputs=[opponent_difficulty],
		outputs=[opponent_difficulty_state]
	)
	
	# 场景设置事件绑定
	scenario_template.change(
		ui_select_scenario_template,
		inputs=[scenario_template, lock_role, lock_traits, lock_goal],
		outputs=[scenario_text, opponent_role, opponent_traits_html, user_goal, opponent_traits_state]
	)
	
	# 添加trait
	opponent_traits_input.submit(
		ui_add_trait,
		inputs=[opponent_traits_input, opponent_traits_state],
		outputs=[opponent_traits_state, opponent_traits_input, opponent_traits_html]
	).then(
		_update_scenario_status,
		inputs=[scenario_context, scenario_text, opponent_role, opponent_traits_state, user_goal],
		outputs=[scenario_status]
	)
	
	# 场景相关输入变化时更新状态显示（完全按照Vue版本的markScenarioDirty逻辑）
	scenario_text.change(
		_update_scenario_status,
		inputs=[scenario_context, scenario_text, opponent_role, opponent_traits_state, user_goal],
		outputs=[scenario_status]
	)
	opponent_role.change(
		_update_scenario_status,
		inputs=[scenario_context, scenario_text, opponent_role, opponent_traits_state, user_goal],
		outputs=[scenario_status]
	)
	user_goal.change(
		_update_scenario_status,
		inputs=[scenario_context, scenario_text, opponent_role, opponent_traits_state, user_goal],
		outputs=[scenario_status]
	)
	
	analyze_btn.click(
		ui_analyze_scenario,
		inputs=[scenario_text, opponent_role, opponent_traits_state, user_goal, lock_role, lock_traits, lock_goal, auto_analyze_checkbox],
		outputs=[scenario_result, scenario_text, opponent_role, opponent_traits_html, user_goal, analyzed_scenario_data, opponent_traits_state]
	)
	
	apply_btn_scenario.click(
		ui_apply_scenario,
		inputs=[analyzed_scenario_data, scenario_enabled, conversation, persona_enabled, persona_funcs, scenario_text, opponent_role, opponent_traits_state, user_goal],
		outputs=[scenario_result, scenario_context, scenario_status, scenario_enabled, tip_md, cands_radio, rel_bar]
	).then(
		ui_update_opening_guidance,
		inputs=[scenario_context, conversation, user_start_override],
		outputs=[opening_guidance, opening_buttons_row]
	)
	
	# 开场指引按钮事件 - 完全按照Vue版本逻辑
	def _on_let_opponent_start(conv, persona_en, persona_f, scn_ctx, ai_enabled, diff):
		"""让对方先开场 - 如果开启了AI对手，自动触发一次对方回复"""
		# 隐藏指引
		guidance_update, buttons_update = ui_update_opening_guidance(scn_ctx, conv, user_start_override=False)
		# 如果开启了AI对手，触发回复
		if ai_enabled:
			chat_upd, conv_upd, tip, cands, rel, reply_data, reply_row = ui_peer_reply(conv, persona_en, persona_f, scn_ctx, ai_enabled, diff)
			return chat_upd, conv_upd, tip, cands, rel, reply_row, guidance_update, buttons_update
		else:
			return gr.update(), conv, "", gr.update(choices=[], value=None), 50, gr.update(visible=False), guidance_update, buttons_update
	
	def _on_user_start_override(conv, persona_en, persona_f, scn_ctx):
		"""用户选择我先开场 - 设置override并隐藏指引，触发候选生成"""
		# 隐藏指引
		guidance_update, buttons_update = ui_update_opening_guidance(scn_ctx, conv, user_start_override=True)
		# 触发提示生成
		tip, cands, rel = do_suggest(conv, "", persona_en, persona_f, "typing", scn_ctx)
		return tip, _render_cands(cands), rel, guidance_update, buttons_update
	
	btn_let_opponent_start.click(
		_on_let_opponent_start,
		inputs=[conversation, persona_enabled, persona_funcs, scenario_context, ai_opponent_enabled, opponent_difficulty_state],
		outputs=[chat, conversation, tip_md, cands_radio, rel_bar, reply_selection_row, opening_guidance, opening_buttons_row]
	)
	
	btn_user_start_override.click(
		_on_user_start_override,
		inputs=[conversation, persona_enabled, persona_funcs, scenario_context],
		outputs=[tip_md, cands_radio, rel_bar, opening_guidance, opening_buttons_row]
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
	
	# 添加JavaScript用于traits chips交互
	demo.load(
		None,
		None,
		None,
		js="""
		function removeTrait(el) {
			const chip = el.parentElement;
			const traitText = chip.textContent.replace('×', '').trim();
			// 触发Python函数移除trait
			// 这里需要与Gradio的Python函数配合
		}
		function selectReply(text) {
			// 选择回复后更新对话
			// 需要与Gradio的Python函数配合
		}
		"""
	)

if __name__ == "__main__":
	# 在本地测试：python deploy/gradio_app.py
	demo.queue().launch(server_name="0.0.0.0", server_port=int(os.getenv("PORT", "7860")))
