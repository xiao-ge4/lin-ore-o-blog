"""
报告服务
生成学习报告
"""
from __future__ import annotations
from typing import Optional, List
from datetime import datetime

from backend.models.save_types import (
    Report, RelationshipChange, SessionData, ConversationTurn
)
from backend.clients.llm_client import chat_completion, _safe_json_parse
from backend.services.save_service import get_save, update_save
from backend.models.save_types import UpdateSaveRequest


def generate_report(nickname: str, save_id: str) -> Optional[Report]:
    """
    为当前会话生成学习报告
    
    **Property 11: Report Completeness**
    **Property 12: Report Persistence**
    
    Args:
        nickname: 用户昵称
        save_id: 存档 ID
        
    Returns:
        生成的报告，失败返回 None
        
    Raises:
        ValueError: 对话为空
    """
    from backend.services.save_service import get_save
    from backend.clients.soul_cos_client import get_soul_cos_client
    
    save = get_save(nickname, save_id)
    if save is None:
        return None
    
    session = save.current_session
    conversation = session.conversation
    
    if not conversation:
        raise ValueError("对话为空，无法生成报告")
    
    # 使用 LLM 分析对话
    report_data = _analyze_conversation_with_llm(
        conversation=conversation,
        scenario=save.scenario_config.scenario,
        role_title=save.scenario_config.opponent.roleTitle if save.scenario_config.opponent else None
    )
    
    # 构建报告
    report = Report(
        session_index=session.index,
        relationship_change=RelationshipChange(
            start=session.start_relationship,
            end=session.relationship_index,
            delta=session.relationship_index - session.start_relationship
        ),
        total_turns=len(conversation),
        highlights=report_data.get("highlights", []),
        improvements=report_data.get("improvements", []),
        overall_comment=report_data.get("overall_comment", ""),
        generated_at=datetime.now().isoformat()
    )
    
    # 保存报告到当前会话
    save.current_session.report = report
    save.updated_at = datetime.now().isoformat()
    
    cos_client = get_soul_cos_client()
    if cos_client:
        cos_client.update_save(nickname, save.model_dump())
    
    return report


def _analyze_conversation_with_llm(
    conversation: List[ConversationTurn],
    scenario: Optional[str] = None,
    role_title: Optional[str] = None
) -> dict:
    """
    使用 LLM 分析对话内容
    
    Args:
        conversation: 对话列表
        scenario: 场景描述
        role_title: 对方角色
        
    Returns:
        分析结果字典
    """
    # 格式化对话
    conv_formatted = []
    for turn in conversation:
        role_name = "用户" if turn.role == "user" else (role_title or "对方")
        conv_formatted.append(f"{role_name}：{turn.text}")
    conv_str = "\n".join(conv_formatted)
    
    scenario_desc = f"场景：{scenario}" if scenario else ""
    role_desc = f"对方角色：{role_title}" if role_title else ""
    
    system_prompt = """你是一位专业的社交沟通分析师，擅长分析对话并给出建设性反馈。
请分析用户的对话表现，给出客观、具体、有帮助的评价。"""

    user_prompt = f"""{scenario_desc}
{role_desc}

【对话内容】
{conv_str}

请分析这段对话，以 JSON 格式返回：
{{
    "highlights": ["亮点1", "亮点2", "亮点3"],
    "improvements": ["改进建议1", "改进建议2"],
    "overall_comment": "总体评价（2-3句话）"
}}

要求：
1. highlights: 列出用户在对话中做得好的地方（2-4条）
2. improvements: 列出可以改进的地方（1-3条）
3. overall_comment: 给出鼓励性的总体评价

只输出 JSON，不要其他内容。"""

    try:
        raw = chat_completion(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=500,
            temperature=0.7
        ).strip()
        
        result = _safe_json_parse(raw)
        if result and isinstance(result, dict):
            return {
                "highlights": result.get("highlights", [])[:5],
                "improvements": result.get("improvements", [])[:3],
                "overall_comment": result.get("overall_comment", "")
            }
    except Exception:
        pass
    
    # Fallback
    return _generate_fallback_report(conversation)


def _generate_fallback_report(conversation: List[ConversationTurn]) -> dict:
    """
    生成备用报告（当 LLM 失败时）
    
    Args:
        conversation: 对话列表
        
    Returns:
        报告数据
    """
    turn_count = len(conversation)
    user_turns = [t for t in conversation if t.role == "user"]
    
    highlights = []
    improvements = []
    
    # 基于对话长度给出基本评价
    if turn_count >= 10:
        highlights.append("保持了较长的对话，展现了良好的沟通耐心")
    if turn_count >= 5:
        highlights.append("积极参与对话，有来有往")
    
    # 检查用户回复长度
    avg_len = sum(len(t.text) for t in user_turns) / len(user_turns) if user_turns else 0
    if avg_len > 20:
        highlights.append("回复内容较为详细，表达清晰")
    elif avg_len < 10:
        improvements.append("可以尝试更详细地表达自己的想法")
    
    if not highlights:
        highlights = ["完成了一次对话练习", "勇于尝试新的沟通场景"]
    
    if not improvements:
        improvements = ["继续保持，多加练习"]
    
    overall = f"本次对话共进行了{turn_count}轮交流，继续加油！"
    
    return {
        "highlights": highlights,
        "improvements": improvements,
        "overall_comment": overall
    }


def get_session_report(nickname: str, save_id: str, session_index: int) -> Optional[Report]:
    """
    获取指定会话的报告
    
    Args:
        nickname: 用户昵称
        save_id: 存档 ID
        session_index: 会话索引
        
    Returns:
        报告，不存在返回 None
    """
    save = get_save(nickname, save_id)
    if save is None:
        return None
    
    # 检查当前会话
    if save.current_session.index == session_index:
        return save.current_session.report
    
    # 检查历史会话
    for session in save.session_history:
        if session.index == session_index:
            return session.report
    
    return None
