"""
存档服务
处理存档的 CRUD 操作
"""
from __future__ import annotations
from typing import List, Optional
import uuid
from datetime import datetime

from backend.models.save_types import (
    Save, SaveSummary, SessionData, ScenarioConfig,
    CreateSaveRequest, UpdateSaveRequest, RestartSaveRequest
)
from backend.clients.soul_cos_client import get_soul_cos_client


# 每用户最大存档数
MAX_SAVES_PER_USER = 10


def list_saves(nickname: str) -> List[SaveSummary]:
    """
    获取用户的存档列表
    
    **Property 4: Save Summary Completeness**
    
    Args:
        nickname: 用户昵称
        
    Returns:
        存档摘要列表
    """
    cos_client = get_soul_cos_client()
    if cos_client is None:
        return []
    
    saves_index = cos_client.get_saves_index(nickname)
    return [SaveSummary(**s) for s in saves_index]


def get_save_count(nickname: str) -> int:
    """获取用户存档数量"""
    cos_client = get_soul_cos_client()
    if cos_client is None:
        return 0
    return len(cos_client.get_saves_index(nickname))


def create_save(nickname: str, request: CreateSaveRequest) -> Save:
    """
    创建新存档
    
    **Property 3: Save Limit Enforcement**
    
    Args:
        nickname: 用户昵称
        request: 创建请求
        
    Returns:
        创建的存档
        
    Raises:
        ValueError: 存档数量已达上限
        RuntimeError: COS 服务不可用
    """
    cos_client = get_soul_cos_client()
    if cos_client is None:
        raise RuntimeError("云存储服务不可用")
    
    # 检查存档数量限制
    current_count = len(cos_client.get_saves_index(nickname))
    if current_count >= MAX_SAVES_PER_USER:
        raise ValueError(f"存档数量已达上限（{MAX_SAVES_PER_USER}个），请删除旧存档后再创建")
    
    now = datetime.now().isoformat()
    save_id = uuid.uuid4().hex[:12]
    
    # 创建初始会话
    initial_session = SessionData(
        index=1,
        conversation=[],
        start_relationship=50,
        relationship_index=50,
        started_at=now,
        ended_at=None,
        report=None
    )
    
    save = Save(
        id=save_id,
        name=request.name,
        user_nickname=nickname,
        created_at=now,
        updated_at=now,
        scenario_config=request.scenario_config,
        current_session=initial_session,
        session_history=[]
    )
    
    cos_client.create_save(nickname, save.model_dump())
    return save


def get_save(nickname: str, save_id: str) -> Optional[Save]:
    """
    获取存档详情
    
    **Property 5: Save Load Round-Trip**
    
    Args:
        nickname: 用户昵称
        save_id: 存档 ID
        
    Returns:
        存档数据，不存在则返回 None
    """
    cos_client = get_soul_cos_client()
    if cos_client is None:
        return None
    
    save_data = cos_client.get_save(nickname, save_id)
    if save_data is None:
        return None
    
    return Save(**save_data)


def update_save(nickname: str, save_id: str, request: UpdateSaveRequest) -> Optional[Save]:
    """
    更新存档
    
    Args:
        nickname: 用户昵称
        save_id: 存档 ID
        request: 更新请求
        
    Returns:
        更新后的存档
    """
    cos_client = get_soul_cos_client()
    if cos_client is None:
        return None
    
    save = get_save(nickname, save_id)
    if save is None:
        return None
    
    # 更新对话
    if request.conversation is not None:
        save.current_session.conversation = request.conversation
    
    # 更新关系指数
    if request.relationship_index is not None:
        save.current_session.relationship_index = request.relationship_index
    
    # 更新场景配置
    if request.scenario_config is not None:
        save.scenario_config = request.scenario_config
    
    save.updated_at = datetime.now().isoformat()
    
    cos_client.update_save(nickname, save.model_dump())
    return save


def delete_save(nickname: str, save_id: str) -> bool:
    """
    删除存档
    
    **Property 8: Save Deletion**
    
    Args:
        nickname: 用户昵称
        save_id: 存档 ID
        
    Returns:
        是否成功
    """
    cos_client = get_soul_cos_client()
    if cos_client is None:
        return False
    
    return cos_client.delete_save(nickname, save_id)


def restart_save(nickname: str, save_id: str, request: RestartSaveRequest) -> Optional[Save]:
    """
    重新开始存档
    
    **Property 6: Restart with Preservation**
    **Property 7: Restart without Preservation**
    
    Args:
        nickname: 用户昵称
        save_id: 存档 ID
        request: 重新开始请求
        
    Returns:
        重新开始后的存档
    """
    cos_client = get_soul_cos_client()
    if cos_client is None:
        return None
    
    save = get_save(nickname, save_id)
    if save is None:
        return None
    
    now = datetime.now().isoformat()
    
    # 如果需要保留历史
    if request.preserve_history:
        # 结束当前会话
        save.current_session.ended_at = now
        # 归档到历史
        save.session_history.append(save.current_session)
    
    # 创建新会话
    new_session_index = save.current_session.index + 1
    save.current_session = SessionData(
        index=new_session_index,
        conversation=[],
        start_relationship=50,
        relationship_index=50,
        started_at=now,
        ended_at=None,
        report=None
    )
    
    save.updated_at = now
    
    cos_client.update_save(nickname, save.model_dump())
    return save
