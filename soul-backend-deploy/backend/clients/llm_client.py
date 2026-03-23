from __future__ import annotations
from typing import Any, Dict, List, Optional
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
    """
    kwargs = dict(
        model=MODEL_NAME,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    if use_stream:
        kwargs["stream"] = True
        kwargs["extra_body"] = {"incremental_output": True, "enable_thinking": True}
    else:
        # 非流式必须明确关闭 thinking
        kwargs["extra_body"] = {"enable_thinking": False}
    resp = _client.chat.completions.create(**kwargs)
    content = resp.choices[0].message.content or ""
    return content


def _safe_json_parse(text: str) -> Any:
    """Try to parse JSON from text, handling markdown code blocks."""
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        # Try to find JSON array or object in text
        start = text.find("[")
        brack = text.find("{")
        if brack != -1 and (start == -1 or brack < start):
            start = brack
        if start != -1:
            frag = text[start:]
            for end in range(len(frag), 0, -1):
                try:
                    return json.loads(frag[:end])
                except Exception:
                    continue
        return None


def safe_json_parse(text: str) -> Any:
    return _safe_json_parse(text)


def generate_conversation_summary(
    conversation: List[Dict[str, Any]],
    role_title: str = "对方"
) -> str:
    """
    生成对话历史的摘要。
    当对话轮数超过阈值时，对早期对话进行总结。
    """
    if not conversation:
        return ""
    
    # 格式化对话
    lines = []
    for turn in conversation:
        role = turn.get("role", "unknown")
        text = turn.get("text", "")
        if role == "user":
            lines.append(f"用户：{text}")
        elif role == "peer":
            lines.append(f"{role_title}：{text}")
    conv_str = "\n".join(lines)
    
    sys_prompt = "你是一个对话摘要助手，负责总结对话的关键信息。"
    
    usr_prompt = (
        f"请对以下对话进行简洁摘要，提取关键信息：\n\n"
        f"【对话内容】\n{conv_str}\n\n"
        f"【摘要要求】\n"
        f"1. 用2-4句话概括对话的主要内容和进展\n"
        f"2. 提取双方讨论的关键话题\n"
        f"3. 记录任何重要的约定、承诺或情感变化\n"
        f"4. 直接输出摘要文本，不要加标题或格式\n"
    )
    
    try:
        summary = chat_completion(
            [{"role": "system", "content": sys_prompt}, {"role": "user", "content": usr_prompt}],
            max_tokens=200,
            temperature=0.3,
        ).strip()
        return summary
    except Exception:
        # 降级：简单截取
        return f"（早期对话共{len(conversation)}轮，涉及双方交流）"


def generate_candidates(
    context: Dict[str, Any],
    persona: Optional[Dict[str, Any]] = None,
    reply_mode: str = "probe",
) -> List[Dict[str, Any]]:
    """
    为用户生成候选消息建议。
    
    【核心逻辑】
    - 如果用户有草稿（draft）：这是用户想要发送的内容，帮助改进表达
    - 如果用户没有草稿：建议用户接下来可以说什么
    
    【重要】草稿是用户自己想说的话，不是对方说的！
    """
    # 提取关键信息
    draft = context.get("draft") or ""
    conversation = context.get("conversation") or []
    conversation_summary = context.get("conversation_summary") or ""
    total_turns = context.get("total_turns") or len(conversation)
    anchor = context.get("anchor") or {}
    last_role = anchor.get("last_role")
    last_text = anchor.get("last_text") or ""
    scenario = context.get("scenario") or {}
    
    # 对方未回复状态
    no_reply = context.get("no_reply", False)
    no_reply_count = context.get("no_reply_count", 0)

    # 场景信息
    oppo = scenario.get("opponent") or {}
    ug = scenario.get("userGoal") or {}
    role_title = oppo.get("roleTitle") or "对方"
    user_goal = ug.get("goal") or "自然交流"
    traits = oppo.get("traits") or []
    traits_str = "、".join(traits) if traits else "未知"
    scenario_desc = scenario.get("scenario") or ""
    
    # 人格偏好提示
    persona_hint = ""
    if persona and persona.get("enabled"):
        funcs = {k: v for k, v in persona.items() if k != "enabled"}
        if funcs:
            persona_hint = f"\n【用户人格偏好】{funcs}"

    # 系统提示
    sys_prompt = (
        "你是一位中文沟通教练助手。\n"
        "【核心任务】帮助用户组织和改进他们想说的话。\n"
        "【重要原则】\n"
        "- 用户的草稿是用户自己想发送的内容，不是对方说的\n"
        "- why字段必须描述用户的沟通策略，而不是'回应对方'\n"
        "- 分析用户草稿的意图：自我介绍、表达感受、提问、分享等\n"
    )

    # 构建对话历史展示
    summary_section = ""
    if conversation_summary and total_turns > len(conversation):
        summary_section = (
            f"【早期对话摘要】（共{total_turns - len(conversation)}轮）\n"
            f"{conversation_summary}\n\n"
        )
    
    conv_display = ""
    if conversation:
        # 展示全部传入的对话历史（已经在 suggest_service 中截取过了）
        lines = []
        for turn in conversation:
            role_label = "用户" if turn.get("role") == "user" else role_title
            lines.append(f"{role_label}：{turn.get('text', '')}")
            # 如果是用户消息且对方未回复，添加标记
            if turn.get("role") == "user" and turn.get("no_reply"):
                count = turn.get("no_reply_count", 1)
                if count > 1:
                    lines.append(f"（{role_title}连续第{count}次未回复）")
                else:
                    lines.append(f"（{role_title}未回复）")
        conv_display = "\n".join(lines)

    # 构建对话历史部分
    history_section = ""
    if summary_section:
        history_section = f"{summary_section}【最近对话】\n{conv_display or '（无）'}"
    else:
        history_section = conv_display or "（对话刚开始）"
    
    # 对方未回复的特殊提示
    no_reply_hint = ""
    if no_reply:
        if no_reply_count >= 3:
            no_reply_hint = (
                f"\n\n【重要情况】{role_title}已连续{no_reply_count}次未回复用户消息。"
                f"建议：可能需要给对方一些空间，或换个话题/方式重新开启对话。"
            )
        elif no_reply_count == 2:
            no_reply_hint = (
                f"\n\n【注意】{role_title}连续2次未回复。"
                f"建议：可以尝试换个轻松的话题，或给对方一些时间。"
            )
        else:
            no_reply_hint = (
                f"\n\n【提示】{role_title}暂时没有回复用户的消息。"
                f"建议：可以等待一下，或发送一条轻松的消息试探。"
            )

    # 根据是否有草稿，构建不同的提示
    if draft:
        # ===== 有草稿：帮助用户改进表达 =====
        usr = (
            f"【任务】用户正在输入一条消息，请帮助改进表达。\n\n"
            f"【用户草稿】「{draft}」\n\n"
            f"【重要理解】\n"
            f"- 这是用户自己想要发送的消息，不是对方说的\n"
            f"- 分析用户草稿的意图（如：自我介绍、表达感受、提问、分享经历等）\n"
            f"- 生成的候选应该是用户草稿的改进版本\n\n"
            f"【场景】{scenario_desc or '日常对话'}\n"
            f"【对方】{role_title}（特征：{traits_str}）\n"
            f"【用户目标】{user_goal}\n\n"
            f"【对话历史】\n{history_section}\n\n"
            f"【输出要求】生成3条候选，帮助用户更好地表达：\n"
            f"1. 稳妥版：保持原意，措辞更得体\n"
            f"2. 亲和版：更温暖、拉近距离\n"
            f"3. 进取版：更主动、推进对话\n\n"
            f"【why字段说明】描述用户采用这种表达的沟通策略，例如：\n"
            f"- 草稿是「有点紧张」→ why写「坦诚表达感受，展现真实一面」\n"
            f"- 草稿是「你好」→ why写「礼貌开场，建立初步联系」\n"
            f"- 草稿是「周末有空吗」→ why写「主动发起邀约，推进关系」\n"
            f"【禁止】why不能写成'回应对方'、'镜像回应'等，因为这是用户主动发送的\n\n"
            f"输出JSON：[{{\"id\":\"safe\",\"text\":\"...\",\"why\":\"...\",\"risk\":\"low\"}},...]"
            f"{persona_hint}"
        )
    else:
        # ===== 无草稿：建议用户接下来可以说什么 =====
        context_hint = ""
        if no_reply:
            # 对方未回复的特殊情况
            if no_reply_count >= 3:
                context_hint = f"{role_title}已连续{no_reply_count}次未回复，需要调整策略。"
            elif no_reply_count == 2:
                context_hint = f"{role_title}连续2次未回复，建议换个方式。"
            else:
                context_hint = f"{role_title}暂时没有回复，可以等待或轻松试探。"
        elif not conversation:
            context_hint = "对话刚开始，建议如何开场。"
        elif last_role == "peer" and last_text:
            context_hint = f"对方刚说：「{last_text[:50]}」，建议如何回应。"
            if reply_mode == "answer":
                context_hint += "（对方在提问，建议先回答）"
        else:
            context_hint = "用户刚发送了消息，建议如何继续对话。"
        
        usr = (
            f"【任务】建议用户接下来可以说什么。\n\n"
            f"【当前情况】{context_hint}\n"
            f"【场景】{scenario_desc or '日常对话'}\n"
            f"【对方】{role_title}（特征：{traits_str}）\n"
            f"【用户目标】{user_goal}\n\n"
            f"【对话历史】\n{history_section}{no_reply_hint}\n\n"
            f"【输出要求】生成3条候选：\n"
            f"1. 稳妥型：安全、得体的表达\n"
            f"2. 亲和型：温暖、拉近距离的表达\n"
            f"3. 进取型：主动推进对话或关系\n\n"
            f"【why字段说明】描述用户采用这种表达的沟通策略\n\n"
            f"输出JSON：[{{\"id\":\"safe\",\"text\":\"...\",\"why\":\"...\",\"risk\":\"low\"}},...]"
            f"{persona_hint}"
        )

    raw = chat_completion(
        [{"role": "system", "content": sys_prompt}, {"role": "user", "content": usr}],
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
        text = it.get("text") or ""
        if not text:
            continue
        cands.append({
            "id": it.get("id") or "cand",
            "text": text,
            "why": it.get("why") or "",
            "risk": it.get("risk") or "low",
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
    for k in ["Ni", "Ne", "Si", "Se", "Ti", "Te", "Fi", "Fe"]:
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


def analyze_scenario_llm(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Use LLM to analyze scenario and generate structured context.
    """
    mode = (payload.get("mode") or "full").lower()
    sys = "你是沟通教练助手，负责将自然语言的场景与意图结构化为可执行的沟通设定。"
    if mode == "goal_only":
        schema = "{\"userGoal\":{\"goal\":\"\",\"reason\":\"\"}}"
        guide = (
            "仅根据给定的'场景描述'与'对方形象关键词'推断并精炼一个适合当前轮次的沟通目标，"
            "用简洁中文表达；必要时给出形成该目标的'reason'（一句话）。"
        )
    else:
        schema = (
            "{\"scenario\":\"...\","
            "\"opponent\":{\"roleTitle\":\"\",\"tone\":\"\",\"traits\":[],\"domain\":\"\"},"
            "\"userGoal\":{\"goal\":\"\",\"reason\":\"\",\"subgoals\":[],\"successCriteria\":[]},"
            "\"flow\":{\"startingParty\":\"user|opponent|either\",\"openingHints\":[]},"
            "\"anchors\":[],\"constraints\":{\"taboo\":[],\"lengthHint\":\"\",\"askRatio\":\"\"}}"
        )
        guide = (
            "请从'场景描述/模板'中抽象出简洁的对方形象关键词（3-6条短语，避免单字或空泛词），"
            "补全对方称谓/语气与可选领域；根据'对方形象+场景'产出'我的目标'，并给出简短reason。"
            "同时判断该场景通常由谁先开场：user(我方主动)/opponent(对方先说，如面试官、客服)/either(均可)，"
            "并在flow.openingHints中给出1-2条开场建议（若startingParty=opponent则给对方开场示例，否则给我方）。"
        )
    usr = (
        "严格按以下JSON Schema输出，不要添加解释：" + schema + "\n"
        + guide + "\n输入：" + json.dumps(payload, ensure_ascii=False)
    )
    raw = chat_completion([
        {"role": "system", "content": sys},
        {"role": "user", "content": usr},
    ], max_tokens=600, temperature=0.3)
    data = _safe_json_parse(raw) or {}
    if not isinstance(data, dict):
        data = {}
    return data
