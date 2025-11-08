from __future__ import annotations
from typing import Any, Dict, List

from backend.clients.llm_client import chat_completion
from backend.models.types import PeerReplyRequest, PeerReplyResponse


def generate_peer_reply(req: PeerReplyRequest) -> PeerReplyResponse:
	conv = [t.model_dump() for t in req.conversation][-12:]
	style = (req.opponent.style if req.opponent and req.opponent.style else "自然").strip()
	hint = (req.opponent.persona_hint if req.opponent and req.opponent.persona_hint else "").strip()

	sys = "你是一位中文虚拟聊天对象，目标是自然地与对方交流。"
	style_map = {
		"自然": "语气自然、不做作，表达清楚即可。",
		"活泼": "语气轻快，偶尔用表情或拟声，加强互动感，但不过度。",
		"理性": "语气沉稳偏理性，简洁、有逻辑，适度反问推进话题。",
		"温和": "语气温柔与支持，给对方积极反馈与简短共情。",
		"专业": "语气专业、信息密度较高，但不说教，注意浅显表达。",
		"俏皮": "语气俏皮幽默，避免讽刺与刻板印象，轻松而不失礼貌。",
		"克制": "语气简洁克制，不热情但不冷漠，回应在点上。",
	}
	style_desc = style_map.get(style, style_map["自然"])
	persona_hint = f"对手设定：{hint}。" if hint else ""
	usr = (
		f"请扮演与我聊天的对象，风格：{style}（{style_desc}）。{persona_hint}\n"
		"基于以下对话上下文，生成你的下一条回复：\n"
		"要求：\n"
		"- 中文输出；不超过2句；可以提出一个自然的追问；\n"
		"- 不要编造隐私与过度承诺；避免敏感与不当内容；\n"
		"- 保持连贯，参考上文的主题与语气；\n"
		f"{conv}"
	)
	try:
		text = chat_completion(
			[{"role": "system", "content": sys}, {"role": "user", "content": usr}],
			max_tokens=120,
			temperature=0.8,
		).strip()
		if not text:
			raise ValueError("empty")
	except Exception:
		text = "我们可以继续聊聊刚才的话题～你怎么看？"
	return PeerReplyResponse(text=text)


