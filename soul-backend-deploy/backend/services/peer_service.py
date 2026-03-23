from __future__ import annotations
from typing import Any, Dict, List

from backend.clients.llm_client import chat_completion, generate_conversation_summary
from backend.config.config import CONVERSATION_HISTORY_LENGTH
from backend.models.types import PeerReplyRequest, PeerReplyResponse


def generate_peer_reply(req: PeerReplyRequest) -> PeerReplyResponse:
    full_conv = [t.model_dump() for t in req.conversation]
    total_turns = len(full_conv)
    
    # 从请求/场景中提取角色信息
    role_title = ""
    traits = []
    user_goal = ""
    scn_desc = ""
    
    if req.opponent:
        role_title = (req.opponent.roleTitle or "").strip()
        traits = req.opponent.traits or []
    
    if req.scenario:
        try:
            scn = req.scenario.model_dump()
            oppo = scn.get("opponent") or {}
            ug = scn.get("userGoal") or {}
            role_title = oppo.get("roleTitle") or role_title
            traits = oppo.get("traits") or traits
            user_goal = ug.get("goal") or ""
            traits_str = "、".join([str(t) for t in traits if t]) if traits else "未设定"
            scn_desc = (
                f"场景：{scn.get('scenario') or '日常对话'}；"
                f"对方：{role_title or '对话对象'}，特征：{traits_str}；"
                f"用户目标：{user_goal or '自然交流'}"
            )
        except Exception:
            pass
    
    # 处理对话历史：超过阈值时生成摘要
    summary_section = ""
    if total_turns > CONVERSATION_HISTORY_LENGTH:
        # 需要摘要的早期对话
        early_conv = full_conv[:-CONVERSATION_HISTORY_LENGTH]
        recent_conv = full_conv[-CONVERSATION_HISTORY_LENGTH:]
        
        # 生成早期对话摘要
        summary = generate_conversation_summary(early_conv, role_title or "对方")
        summary_section = (
            f"【早期对话摘要】（共{len(early_conv)}轮）\n"
            f"{summary}\n\n"
            f"【以下是最近{CONVERSATION_HISTORY_LENGTH}轮对话】\n"
        )
        conv_list = recent_conv
    else:
        conv_list = full_conv
    
    # 格式化对话历史
    conv_formatted = []
    for turn in conv_list:
        role = turn.get('role', 'unknown')
        text = turn.get('text', '')
        if role == 'user':
            conv_formatted.append(f"我（用户）：{text}")
        elif role == 'peer':
            conv_formatted.append(f"你（{role_title or '对方'}）：{text}")
    conv_str = "\n".join(conv_formatted) if conv_formatted else "（无对话历史）"

    sys = (
        "你是一位中文虚拟聊天对象，目标是自然地与对方交流。"
        "请根据你在场景中的身份和立场，使用符合该角色的语气、称谓和行为方式。"
    )

    # 根据 traits 生成风格描述
    if traits:
        style_desc = (
            f"请参考对方形象关键词：{'、'.join([str(t) for t in traits if t])}。"
            "优先依据这些关键词调整语气、关注点与说话方式。"
        )
    else:
        style_desc = "语气自然、不做作，表达清楚即可。"
    
    role_hint = f"你的角色：{role_title}" if role_title else "你的角色：对话对象"
    
    # 获取最后一句用户说的话
    last_user_msg = ""
    if conv_list:
        for turn in reversed(conv_list):
            if turn.get('role') == 'user':
                last_user_msg = turn.get('text', '')
                break
    
    last_msg = last_user_msg if last_user_msg else "（无）"
    
    # 判断用户消息是否包含邀约/请求
    invitation_keywords = ['一起', '要不要', '有空吗', '有时间吗', '约', '去不去', '来不来', '想不想', '愿不愿', '可以吗', '行吗', '好吗']
    is_invitation = any(kw in last_user_msg for kw in invitation_keywords)
    
    if is_invitation:
        attitude_desc = "接受邀约/考虑中/婉拒"
        json_format = '[{"id":"accept","text":"...","tone":"positive"},{"id":"consider","text":"...","tone":"neutral"},{"id":"decline","text":"...","tone":"negative"}]'
        attitude_guide = (
            "态度说明：\n"
            "- positive（接受）：积极回应邀约，表示愿意参与\n"
            "- neutral（考虑）：不直接拒绝也不立即答应，表示需要考虑或询问细节\n"
            "- negative（婉拒）：礼貌地表示不方便，但保持友好\n"
        )
    else:
        attitude_desc = "热情回应/平和回应/保守回应"
        json_format = '[{"id":"warm","text":"...","tone":"positive"},{"id":"calm","text":"...","tone":"neutral"},{"id":"reserved","text":"...","tone":"negative"}]'
        attitude_guide = (
            "态度说明：\n"
            "- positive（热情）：积极热情地回应，主动延伸话题或分享更多\n"
            "- neutral（平和）：正常友好地回应，不过分热情也不冷淡\n"
            "- negative（保守）：简短回应，不主动延伸话题，但不失礼貌\n"
            "\n【重要】这不是在拒绝什么！用户没有提出邀约，所以不要生成拒绝邀约的内容。\n"
        )
    
    scenario_line = f"场景设定：{scn_desc}\n" if scn_desc else ""

    usr = (
        f"{style_desc}\n"
        f"{role_hint}\n\n"
        f"{scenario_line}"
        f"\n{summary_section}"
        "【对话历史】\n"
        f"{conv_str}\n\n"
        "【回复要求】\n"
        f"对方（用户）最后一句话是：「{last_msg}」\n"
        "你必须针对这句话给出直接、相关的回复。\n\n"
        "重要规则：\n"
        "1. 中文输出，每条不超过2句\n"
        "2. 不要重复问已经回答过的问题\n"
        "3. 回复必须与用户最后一句话直接相关，不要跳跃到其他话题\n"
        "4. 不要预判用户还没说的话（如果用户没有邀约，不要生成拒绝邀约的内容）\n"
        f"5. 理解你的身份定位：作为{role_title or '对话对象'}，应结合场景和对话历史决定合适的主动或被动程度\n"
        f"\n请以 JSON 数组返回 3 条不同态度的回复（{attitude_desc}）。\n"
        f"{attitude_guide}"
        f"格式：{json_format}\n"
        "只输出 JSON 数组，不要任何解释文字。"
    )

    try:
        raw = chat_completion(
            [{"role": "system", "content": sys}, {"role": "user", "content": usr}],
            max_tokens=300,
            temperature=0.8,
        ).strip()
    except Exception:
        raw = ""

    from backend.clients.llm_client import _safe_json_parse
    from backend.models.types import PeerReplyItem
    
    data = _safe_json_parse(raw) or []
    replies = []
    if isinstance(data, list):
        for item in data[:3]:
            if isinstance(item, dict) and item.get("text"):
                replies.append({
                    "id": item.get("id", "alt"),
                    "text": str(item.get("text")),
                    "tone": item.get("tone"),
                    "why": item.get("why")
                })
    
    if not replies:
        if raw and isinstance(raw, str):
            replies = [{"id": "default", "text": raw}]
        else:
            replies = [{"id": "default", "text": "我们可以继续聊聊刚才的话题～你怎么看？"}]
    
    return PeerReplyResponse(
        text=replies[0]["text"],
        replies=[PeerReplyItem(**r) for r in replies]
    )
