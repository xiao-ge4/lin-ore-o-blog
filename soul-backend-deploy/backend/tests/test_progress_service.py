"""
进度服务的属性测试
"""
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import MagicMock, patch
from datetime import datetime

from backend.models.progress_types import Progress, ScenarioStat
from backend.services.progress_service import get_progress, _create_empty_progress


# ============================================
# 生成策略
# ============================================

valid_chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ你好世界测试"
valid_nickname_strategy = st.text(alphabet=valid_chars, min_size=1, max_size=6)


def create_mock_save_data(
    save_id: str, nickname: str, scenario: str,
    current_turns: int, current_gain: int,
    history_sessions: list
) -> dict:
    """创建模拟存档数据"""
    now = datetime.now().isoformat()
    return {
        "id": save_id,
        "name": f"存档{save_id}",
        "user_nickname": nickname,
        "created_at": now,
        "updated_at": now,
        "scenario_config": {
            "scenario": scenario,
            "opponent": {"roleTitle": "测试角色"},
            "userGoal": {"goal": "测试目标"},
            "difficulty": "realistic"
        },
        "current_session": {
            "index": len(history_sessions) + 1,
            "conversation": [
                {"role": "user" if i % 2 == 0 else "peer", "text": f"消息{i}", "ts": float(i)}
                for i in range(current_turns)
            ],
            "start_relationship": 50,
            "relationship_index": 50 + current_gain,
            "started_at": now,
            "ended_at": None,
            "report": None
        },
        "session_history": history_sessions
    }


class TestProgressCompleteness:
    """
    **Feature: user-save-system, Property 13: Progress Completeness**
    **Validates: Requirements 5.1**
    
    *For any* user's progress data, the progress SHALL contain: total_sessions, 
    total_turns, avg_relationship_gain, and scenario_stats fields.
    """
    
    @given(
        nickname=valid_nickname_strategy,
        total_sessions=st.integers(min_value=0, max_value=100),
        total_turns=st.integers(min_value=0, max_value=1000),
        avg_gain=st.floats(min_value=-50, max_value=50, allow_nan=False)
    )
    @settings(max_examples=100)
    def test_progress_has_all_required_fields(
        self, nickname: str, total_sessions: int, total_turns: int, avg_gain: float
    ):
        """进度应包含所有必需字段"""
        progress = Progress(
            nickname=nickname,
            total_sessions=total_sessions,
            total_turns=total_turns,
            total_saves=1,
            avg_relationship_gain=round(avg_gain, 2),
            best_relationship_gain=10,
            scenario_stats=[],
            updated_at=datetime.now().isoformat()
        )
        
        # 验证所有必需字段存在
        assert progress.nickname is not None
        assert progress.total_sessions is not None and progress.total_sessions >= 0
        assert progress.total_turns is not None and progress.total_turns >= 0
        assert progress.avg_relationship_gain is not None
        assert progress.scenario_stats is not None and isinstance(progress.scenario_stats, list)
        assert progress.updated_at is not None


class TestProgressCalculationCorrectness:
    """
    **Feature: user-save-system, Property 14: Progress Calculation Correctness**
    **Validates: Requirements 5.2**
    
    *For any* user, the progress total_sessions SHALL equal the sum of all 
    session counts across all saves, and total_turns SHALL equal the sum 
    of all conversation turn counts.
    """
    
    @given(
        nickname=valid_nickname_strategy,
        save_count=st.integers(min_value=1, max_value=5),
        turns_per_session=st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=50)
    def test_progress_calculation_sums_correctly(
        self, nickname: str, save_count: int, turns_per_session: int
    ):
        """进度计算应正确求和"""
        mock_client = MagicMock()
        now = datetime.now().isoformat()
        
        # 创建模拟存档索引
        saves_index = [{"id": f"save_{i}", "name": f"存档{i}"} for i in range(save_count)]
        mock_client.get_saves_index.return_value = saves_index
        
        # 每个存档有一个当前会话
        expected_sessions = save_count
        expected_turns = save_count * turns_per_session
        
        def mock_get_save(nick, save_id):
            return create_mock_save_data(
                save_id=save_id,
                nickname=nick,
                scenario="测试场景",
                current_turns=turns_per_session,
                current_gain=5,
                history_sessions=[]
            )
        
        mock_client.get_save.side_effect = mock_get_save
        
        with patch('backend.services.progress_service.get_soul_cos_client', return_value=mock_client):
            progress = get_progress(nickname)
            
            assert progress is not None
            assert progress.total_sessions == expected_sessions
            assert progress.total_turns == expected_turns
    
    @given(
        nickname=valid_nickname_strategy,
        history_count=st.integers(min_value=1, max_value=3),
        turns_per_session=st.integers(min_value=1, max_value=5)
    )
    @settings(max_examples=30)
    def test_progress_includes_history_sessions(
        self, nickname: str, history_count: int, turns_per_session: int
    ):
        """进度应包含历史会话"""
        mock_client = MagicMock()
        now = datetime.now().isoformat()
        
        saves_index = [{"id": "save_1", "name": "存档1"}]
        mock_client.get_saves_index.return_value = saves_index
        
        # 创建历史会话
        history_sessions = [
            {
                "index": i + 1,
                "conversation": [
                    {"role": "user", "text": f"历史消息{i}", "ts": float(i)}
                    for _ in range(turns_per_session)
                ],
                "start_relationship": 50,
                "relationship_index": 55,
                "started_at": now,
                "ended_at": now,
                "report": None
            }
            for i in range(history_count)
        ]
        
        save_data = create_mock_save_data(
            save_id="save_1",
            nickname=nickname,
            scenario="测试场景",
            current_turns=turns_per_session,
            current_gain=5,
            history_sessions=history_sessions
        )
        mock_client.get_save.return_value = save_data
        
        with patch('backend.services.progress_service.get_soul_cos_client', return_value=mock_client):
            progress = get_progress(nickname)
            
            assert progress is not None
            # 当前会话 + 历史会话
            expected_sessions = 1 + history_count
            assert progress.total_sessions == expected_sessions


class TestEmptyProgress:
    """测试空进度"""
    
    @given(nickname=valid_nickname_strategy)
    @settings(max_examples=50)
    def test_empty_progress_has_valid_structure(self, nickname: str):
        """空进度应有有效结构"""
        progress = _create_empty_progress(nickname)
        
        assert progress.nickname == nickname
        assert progress.total_sessions == 0
        assert progress.total_turns == 0
        assert progress.total_saves == 0
        assert progress.avg_relationship_gain == 0.0
        assert progress.scenario_stats == []
        assert progress.updated_at is not None


class TestScenarioStats:
    """测试场景统计"""
    
    @given(
        scenario_type=st.text(min_size=1, max_size=20),
        session_count=st.integers(min_value=1, max_value=50),
        total_turns=st.integers(min_value=1, max_value=500),
        avg_gain=st.floats(min_value=-50, max_value=50, allow_nan=False)
    )
    @settings(max_examples=50)
    def test_scenario_stat_has_all_fields(
        self, scenario_type: str, session_count: int, total_turns: int, avg_gain: float
    ):
        """场景统计应包含所有字段"""
        stat = ScenarioStat(
            scenario_type=scenario_type,
            session_count=session_count,
            total_turns=total_turns,
            avg_relationship_gain=round(avg_gain, 2),
            best_relationship_gain=10
        )
        
        assert stat.scenario_type is not None
        assert stat.session_count >= 0
        assert stat.total_turns >= 0
        assert stat.avg_relationship_gain is not None
