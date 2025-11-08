from __future__ import annotations
from typing import Any, Dict, List, Optional
from statistics import mean

from backend.clients.llm_client import generate_candidates
from backend.models.types import (
	SuggestRequest, SuggestResponse, Tip, Candidate, Relationship, Safety
)
from backend.services.safety_service import safety_check_text, redact_if_needed

_POS_WORDS = {"喜欢", "开心", "有趣", "好玩", "期待", "不错", "赞", "哈哈", "开心"}
_NEG_WORDS = {"无聊", "烦", "不想", "不愿", "生气", "晚回", "算了", "唉"}


def _affect_score(text: str) -> float:
	score = 0
	for w in _POS_WORDS:
		if w in text:
			score += 1
	for w in _NEG_WORDS:
		if w in text:
			score -= 1
	return max(-3, min(3, score)) / 3.0


def _analyze_conversation(conv: List[Dict[str, Any]]) -> Dict[str, Any]:
	peer_texts = [t["text"] for t in conv if t.get("role") == "peer" and t.get("text")]
	aff = mean([_affect_score(t) for t in peer_texts[-5:]]) if peer_texts else 0.0
	relationship_index = int(round(50 + aff * 30))
	relationship_index = max(0, min(100, relationship_index))
	return {
		"affect": aff,
		"relationship_index": relationship_index,
		"trend": "up" if aff > 0.15 else ("down" if aff < -0.15 else "flat"),
	}


def _build_tip(analysis: Dict[str, Any], entry_type: str, draft: str) -> Tip:
	aff = analysis["affect"]
	if entry_type in ("preSend", "typing") and draft:
		if aff < -0.2:
			return Tip(text="建议降低强度，先共情再提问", tone="alert", risk="mid")
		if len(draft) < 8:
			return Tip(text="建议更具体些，给出一个小细节", tone="gentle", risk="low")
		return Tip(text="保持自然语气，附带一个轻问题", tone="gentle", risk="very_low")
	if entry_type in ("idle",):
		return Tip(text="尝试承接TA的兴趣点，给一个续聊锚点", tone="neutral", risk="low")
	return Tip(text="继续保持节奏～", tone="gentle", risk="very_low")


def _score_candidate(text: str, why: str, risk: str, analysis: Dict[str, Any]) -> float:
	base = 0.5
	if "？" in text or "?" in text:
		base += 0.1  # 促进互动
	if len(text) <= 40:
		base += 0.05  # 简洁
	if risk == "low":
		base += 0.08
	if analysis["affect"] < -0.2 and "幽默" in why:
		base -= 0.05  # 负面时降低幽默权重
	return max(0.0, min(1.0, base))


def _fallback_from_context(conv: List[Dict[str, Any]], draft: str) -> List[Dict[str, str]]:
	"""当模型超时/限流时的本地候选兜底（面向“你将要发送”的下一条）。"""
	last_peer = ""
	last_user = ""
	last_role = None
	for t in reversed(conv):
		if t.get("role") in ("user", "peer"):
			last_role = t["role"]
			break
	if last_role == "peer":
		for t in reversed(conv):
			if t.get("role") == "peer" and t.get("text"):
				last_peer = t["text"]
				break
	else:
		for t in reversed(conv):
			if t.get("role") == "user" and t.get("text"):
				last_user = t["text"]
				break

	# 若草稿已存在：做“增强与收束”
	if draft:
		return [
			{"id":"mirror","text":f"{draft} 想听听你的看法～","why":"承接草稿并抛球","risk":"low"},
			{"id":"safe","text":"我先说到这里，你这边怎么看？","why":"稳妥推进","risk":"low"},
			{"id":"humor","text":"这段我就不剧透啦，交给你来补完？😄","why":"轻松化","risk":"mid"},
		]

	# 最近一条为对方消息：承接对方
	if last_role == "peer":
		return [
			{"id":"mirror","text":f"关于“{last_peer[:18]}”，你更在意哪一部分？","why":"承接其话题","risk":"low"},
			{"id":"safe","text":"如果方便的话，能说说具体是怎么想的吗？","why":"稳妥追问","risk":"low"},
			{"id":"humor","text":"不如来个快问快答，我先抛一个：你会选A还是B？","why":"轻松推进","risk":"mid"},
		]

	# 最近一条为我方消息：做“自我补充 + 抛回对方”
	if last_role == "user":
		return [
			{"id":"mirror","text":"主要是我这次在某一科状态更好～你最近有什么小高光？","why":"自述+抛回","risk":"low"},
			{"id":"safe","text":"我的部分先到这儿，你这边最近有什么想分享的吗？","why":"稳妥转问","risk":"low"},
			{"id":"humor","text":"给自己发一张小小“表扬券”，也想听听你的故事～","why":"轻松转场","risk":"mid"},
		]

	# 默认开场
	return [
		{"id":"mirror","text":"周末一般怎么放松？我最近迷上了散步。","why":"开启轻话题","risk":"low"},
		{"id":"safe","text":"不急，我们可以从兴趣开始聊起～","why":"稳妥开场","risk":"low"},
		{"id":"humor","text":"发你一张“聊天启动券”，换你一个小分享？","why":"幽默破冰","risk":"mid"},
	]


def handle_suggest(req: SuggestRequest) -> SuggestResponse:
	# 1) 分析上下文
	conv = [t.model_dump() for t in req.conversation]
	analysis = _analyze_conversation(conv)

	# 2) 轻提示
	tip = _build_tip(analysis, req.entryType, req.draft or "")

	# 3) 调用LLM生成候选
	context = {
		"conversation": conv[-12:],
		"draft": req.draft or "",
		"userProfile": (req.userProfile or {}).model_dump() if req.userProfile else {},
		"peerProfile": (req.peerProfile or {}).model_dump() if req.peerProfile else {},
	}
	persona = None
	if req.personaWeights:
		persona = {"enabled": req.personaWeights.enabled, "functions": req.personaWeights.model_dump()}
	# 移除 enabled 重复字段
	if persona and "enabled" in persona["functions"]:
		persona["functions"].pop("enabled", None)

	try:
		raw_cands = generate_candidates(context, persona=persona)
	except Exception:
		raw_cands = _fallback_from_context(conv[-12:], req.draft or "")

	# 4) 安全审校、打分
	final_cands: List[Candidate] = []
	for it in raw_cands:
		safe = safety_check_text(it["text"])
		if safe["blocked"]:
			continue
		risk_val = str(it.get("risk", "low"))
		if risk_val not in ("low","mid","high"):
			risk_val = "low"
		score = _score_candidate(it["text"], it.get("why", ""), risk_val, analysis)
		final_cands.append(Candidate(
			id=it.get("id", "cand"),
			text=redact_if_needed(it["text"]),
			why=it.get("why", ""),
			risk=risk_val,
			score=score
		))

	# 最多取3条
	final_cands = sorted(final_cands, key=lambda x: x.score, reverse=True)[:3] or [
		Candidate(id="safe", text="不急～可以聊聊你最近在忙什么？", why="稳妥推进", risk="very_low", score=0.7)
	]

	rel = Relationship(index=analysis["relationship_index"], trend=analysis["trend"])
	safety = Safety(blocked=False, notes=[])
	return SuggestResponse(tip=tip, candidates=final_cands, relationship=rel, safety=safety)


