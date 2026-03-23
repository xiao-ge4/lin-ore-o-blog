"""
存档相关的数据模型
"""
from __future__ import annotations
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# ============================================
# 场景配置模型（复用现有类型）
# ============================================

class OpponentProfile(BaseModel):
    """对方角色配置"""
    style: Optional[str] = "自然"
    persona_hint: Optional[str] = None
    roleTitle: Optional[str] = None
    traits: Optional[List[str]] = None
    domain: Optional[str] = None
    tone: Optional[str] = None


class UserGoal(BaseModel):
    """用户目标"""
    goal: Optional[str] = None
    subgoals: Optional[List[str]] = None
    successCriteria: Optional[List[str]] = None
    priority: Optional[str] = None
    reason: Optional[str] = None


class ScenarioFlow(BaseModel):
    """场景流程"""
    startingParty: Optional[Literal["user", "opponent", "either"]] = "either"
    openingHints: Optional[List[str]] = None


class ScenarioConfig(BaseModel):
    """场景配置"""
    scenario: Optional[str] = None
    opponent: Optional[OpponentProfile] = None
    userGoal: Optional[UserGoal] = None
    difficulty: str = "realistic"  # friendly, realistic, challenging
    flow: Optional[ScenarioFlow] = None
    anchors: Optional[List[str]] = None
    constraints: Optional[Dict[str, Any]] = None


# ============================================
# 对话模型
# ============================================

class ConversationTurn(BaseModel):
    """对话轮次"""
    role: Literal["user", "peer"]
    text: str
    ts: Optional[float] = None
    no_reply: Optional[bool] = None  # 对方是否未回复此消息
    no_reply_count: Optional[int] = None  # 连续未回复次数


# ============================================
# 报告模型
# ============================================

class RelationshipChange(BaseModel):
    """关系变化"""
    start: int = 50
    end: int = 50
    delta: int = 0


class Report(BaseModel):
    """学习报告"""
    session_index: int
    relationship_change: RelationshipChange
    total_turns: int
    highlights: List[str] = []
    improvements: List[str] = []
    overall_comment: str = ""
    generated_at: str


# ============================================
# 会话模型
# ============================================

class SessionData(BaseModel):
    """会话数据"""
    index: int = 1
    conversation: List[ConversationTurn] = []
    start_relationship: int = 50
    relationship_index: int = 50  # 当前关系指数
    started_at: str
    ended_at: Optional[str] = None
    report: Optional[Report] = None


# ============================================
# 存档模型
# ============================================

class Save(BaseModel):
    """完整存档"""
    id: str
    name: str
    user_nickname: str
    created_at: str
    updated_at: str
    scenario_config: ScenarioConfig
    current_session: SessionData
    session_history: List[SessionData] = []


class SaveSummary(BaseModel):
    """存档摘要（用于列表展示）"""
    id: str
    name: str
    relationship_index: int = 50
    session_count: int = 1
    total_turns: int = 0
    updated_at: str


# ============================================
# 请求/响应模型
# ============================================

class CreateSaveRequest(BaseModel):
    """创建存档请求"""
    name: str = Field(..., min_length=1, max_length=50, description="存档名称")
    scenario_config: ScenarioConfig


class UpdateSaveRequest(BaseModel):
    """更新存档请求"""
    conversation: Optional[List[ConversationTurn]] = None
    relationship_index: Optional[int] = None
    scenario_config: Optional[ScenarioConfig] = None


class RestartSaveRequest(BaseModel):
    """重新开始请求"""
    preserve_history: bool = True


class SaveListResponse(BaseModel):
    """存档列表响应"""
    saves: List[SaveSummary]
    count: int
    max_saves: int = 10


class SaveDetailResponse(BaseModel):
    """存档详情响应"""
    save: Save
