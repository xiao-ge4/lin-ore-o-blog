from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
import json

from backend.config.config import create_openai_client, MODEL_NAME

# Create a single client instance
_client = create_openai_client()


def chat_completion(
	messages: List[Dict[str, str]],
	max_tokens: int = 512,
	temperature: float = 0.6,
	extra_body: Optional[Dict[str, Any]] = None,
	use_stream: bool = False,
) -> str:
	"""
	Call ModelScope OpenAI-compatible chat completion and return content text.
	- 注意：ModelScope 的 enable_thinking 仅支持 stream 模式。
	"""
	kwargs: Dict[str, Any] = dict(
		model=MODEL_NAME,
		messages=messages,
		max_tokens=max_tokens,
		temperature=temperature,
	)
	if use_stream:
		kwargs["stream"] = True
		kwargs["extra_body"] = extra_body or {"enable_thinking": True}
	else:
		kwargs["stream"] = False
		# 关键：非流式需明确关闭 thinking
		kwargs["extra_body"] = {"enable_thinking": False}
	resp = _client.chat.completions.create(**kwargs)
	content = resp.choices[0].message.content or ""
	return content


def _safe_json_parse(text: str) -> Any:
	try:
		return json.loads(text)
	except Exception:
		# Try to extract the first JSON block
		start = text.find("{")
		brack = text.find("[")
		if brack != -1 and (start == -1 or brack < start):
			start = brack
		if start != -1:
			frag = text[start:]
			# Try trimming trailing non-json
			for end in range(len(frag), max(len(frag) - 4000, 0), -1):
				try:
					return json.loads(frag[:end])
				except Exception:
					continue
		return None


def generate_candidates(
	context: Dict[str, Any],
	persona: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
	"""
	Use LLM to generate 3+ candidate replies (mirror/safe/humor),
	then caller can score and pick top-3.
	"""
	persona_hint = ""
	if persona and persona.get("enabled"):
		funcs = persona.get("functions") or {}
		persona_hint = f"\n已知用户八维偏好：{json.dumps(funcs, ensure_ascii=False)}。请尽量匹配沟通风格。"

	sys = "你是中文社交对话助理。"
	usr = (
		"请基于提供的对话上下文与画像，输出3-6条中文候选回复，槽位包含：镜像/稳妥/幽默。"
		"\n要求：每条≤2句，包含一个自然追问；避免冒犯、隐私、刻板印象。"
		"\n输出严格为JSON数组：[{\"id\":\"mirror|safe|humor|...\",\"text\":\"...\",\"why\":\"原因\",\"risk\":\"low|mid|high\"}]\n"
		f"上下文：{json.dumps(context, ensure_ascii=False)}"
		f"{persona_hint}"
	)
	raw = chat_completion(
		[{"role": "system", "content": sys}, {"role": "user", "content": usr}],
		max_tokens=512,
		temperature=0.7,
	)
	data = _safe_json_parse(raw)
	if not isinstance(data, list):
		return []
	cands = []
	for it in data:
		if not isinstance(it, dict):
			continue
		text = (it.get("text") or "").strip()
		if not text:
			continue
		cands.append({
			"id": it.get("id") or "cand",
			"text": text,
			"why": it.get("why") or "",
			"risk": it.get("risk") or "low"
		})
	return cands


def infer_mbti_from_chat(messages_for_infer: List[Dict[str, str]]) -> Dict[str, Any]:
	"""
	Use LLM to infer MBTI and Jung functions with confidence.
	"""
	sys = "你是性格与沟通风格分析助手。"
	usr = (
		"基于以下中文聊天记录，推断说话者（第一人称）的MBTI与荣格八维强度（0-100）。"
		"\n请给出证据点（抽象/具体、情感词密度、疑问/推理词、直接/委婉等），"
		"\n仅输出JSON对象：{"
		"\"mbti\":\"INTJ\","
		"\"confidence\":0.0,"
		"\"functions\":{\"Ni\":0,\"Ne\":0,\"Si\":0,\"Se\":0,\"Ti\":0,\"Te\":0,\"Fi\":0,\"Fe\":0},"
		"\"notes\":\"简要证据\"}"
		"\n聊天记录："
		f"{json.dumps(messages_for_infer, ensure_ascii=False)}"
	)
	raw = chat_completion(
		[{"role": "system", "content": sys}, {"role": "user", "content": usr}],
		max_tokens=400,
		temperature=0.2,
	)
	data = _safe_json_parse(raw) or {}
	if not isinstance(data, dict):
		data = {}
	# normalize
	funcs = data.get("functions") or {}
	for k in ["Ni","Ne","Si","Se","Ti","Te","Fi","Fe"]:
		try:
			funcs[k] = max(0, min(100, int(funcs.get(k, 0))))
		except Exception:
			funcs[k] = 0
	data["functions"] = funcs
	data["mbti"] = (data.get("mbti") or "").upper()[:4]
	try:
		data["confidence"] = float(data.get("confidence", 0.0))
	except Exception:
		data["confidence"] = 0.0
	return data


