"""
学习进度相关的数据模型
"""
from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel


class ScenarioStat(BaseModel):
    """场景统计"""
    scenario_type: str
    session_count: int = 0
    total_turns: int = 0
    avg_relationship_gain: float = 0.0
    best_relationship_gain: int = 0


class Progress(BaseModel):
    """学习进度"""
    nickname: str
    total_sessions: int = 0
    total_turns: int = 0
    total_saves: int = 0
    avg_relationship_gain: float = 0.0
    best_relationship_gain: int = 0
    scenario_stats: List[ScenarioStat] = []
    updated_at: str


class ProgressResponse(BaseModel):
    """进度响应"""
    progress: Progress
