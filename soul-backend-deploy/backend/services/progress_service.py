"""
进度服务
计算和更新学习进度
"""
from __future__ import annotations
from typing import Optional, Dict, List
from datetime import datetime
from collections import defaultdict

from backend.models.progress_types import Progress, ScenarioStat
from backend.models.save_types import Save, SessionData
from backend.clients.soul_cos_client import get_soul_cos_client


def get_progress(nickname: str) -> Optional[Progress]:
    """
    获取用户的学习进度
    
    **Property 13: Progress Completeness**
    **Property 14: Progress Calculation Correctness**
    
    Args:
        nickname: 用户昵称
        
    Returns:
        进度数据，失败返回 None
    """
    cos_client = get_soul_cos_client()
    if cos_client is None:
        return _create_empty_progress(nickname)
    
    # 获取所有存档
    saves_index = cos_client.get_saves_index(nickname)
    if not saves_index:
        return _create_empty_progress(nickname)
    
    # 统计数据
    total_sessions = 0
    total_turns = 0
    total_saves = len(saves_index)
    relationship_gains: List[int] = []
    scenario_data: Dict[str, Dict] = defaultdict(lambda: {
        "session_count": 0,
        "total_turns": 0,
        "gains": []
    })
    
    # 遍历所有存档
    for save_info in saves_index:
        save_id = save_info.get("id")
        if not save_id:
            continue
        
        save_data = cos_client.get_save(nickname, save_id)
        if not save_data:
            continue
        
        try:
            save = Save(**save_data)
        except Exception:
            continue
        
        # 获取场景类型
        scenario_type = save.scenario_config.scenario or "未知场景"
        
        # 统计当前会话
        current = save.current_session
        if current.conversation:
            total_sessions += 1
            turn_count = len(current.conversation)
            total_turns += turn_count
            gain = current.relationship_index - current.start_relationship
            relationship_gains.append(gain)
            
            scenario_data[scenario_type]["session_count"] += 1
            scenario_data[scenario_type]["total_turns"] += turn_count
            scenario_data[scenario_type]["gains"].append(gain)
        
        # 统计历史会话
        for session in save.session_history:
            total_sessions += 1
            turn_count = len(session.conversation)
            total_turns += turn_count
            gain = session.relationship_index - session.start_relationship
            relationship_gains.append(gain)
            
            scenario_data[scenario_type]["session_count"] += 1
            scenario_data[scenario_type]["total_turns"] += turn_count
            scenario_data[scenario_type]["gains"].append(gain)
    
    # 计算平均值
    avg_gain = sum(relationship_gains) / len(relationship_gains) if relationship_gains else 0.0
    best_gain = max(relationship_gains) if relationship_gains else 0
    
    # 构建场景统计
    scenario_stats = []
    for scenario_type, data in scenario_data.items():
        gains = data["gains"]
        scenario_stats.append(ScenarioStat(
            scenario_type=scenario_type,
            session_count=data["session_count"],
            total_turns=data["total_turns"],
            avg_relationship_gain=sum(gains) / len(gains) if gains else 0.0,
            best_relationship_gain=max(gains) if gains else 0
        ))
    
    return Progress(
        nickname=nickname,
        total_sessions=total_sessions,
        total_turns=total_turns,
        total_saves=total_saves,
        avg_relationship_gain=round(avg_gain, 2),
        best_relationship_gain=best_gain,
        scenario_stats=scenario_stats,
        updated_at=datetime.now().isoformat()
    )


def _create_empty_progress(nickname: str) -> Progress:
    """创建空的进度数据"""
    return Progress(
        nickname=nickname,
        total_sessions=0,
        total_turns=0,
        total_saves=0,
        avg_relationship_gain=0.0,
        best_relationship_gain=0,
        scenario_stats=[],
        updated_at=datetime.now().isoformat()
    )


def update_progress_from_session(nickname: str, session: SessionData) -> Optional[Progress]:
    """
    从会话更新进度（可选，用于实时更新）
    
    Args:
        nickname: 用户昵称
        session: 会话数据
        
    Returns:
        更新后的进度
    """
    # 直接重新计算进度（简单实现）
    return get_progress(nickname)
