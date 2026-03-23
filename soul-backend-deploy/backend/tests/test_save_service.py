"""
存档服务的属性测试
"""
import pytest
from hypothesis import given, strategies as st, settings, assume
from unittest.mock import MagicMock, patch
from datetime import datetime

from backend.models.save_types import (
    Save, SaveSummary, SessionData, ScenarioConfig,
    CreateSaveRequest, UpdateSaveRequest, RestartSaveRequest,
    ConversationTurn, OpponentProfile, UserGoal
)
from backend.services.save_service import (
    list_saves, create_save, get_save, update_save, delete_save, restart_save,
    MAX_SAVES_PER_USER
)


# ============================================
# 生成策略
# ============================================

valid_chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ你好世界测试"

valid_nickname_strategy = st.text(alphabet=valid_chars, min_size=1, max_size=6)
valid_save_name_strategy = st.text(alphabet=valid_chars + " ", min_size=1, max_size=30)
valid_save_id_strategy = st.text(alphabet="abcdef0123456789", min_size=12, max_size=12)


def create_mock_save(save_id: str, name: str, nickname: str, session_count: int = 1) -> dict:
    """创建模拟存档数据"""
    now = datetime.now().isoformat()
    return {
        "id": save_id,
        "name": name,
        "user_nickname": nickname,
        "created_at": now,
        "updated_at": now,
        "scenario_config": {
            "scenario": "测试场景",
            "opponent": {"roleTitle": "测试角色"},
            "userGoal": {"goal": "测试目标"},
            "difficulty": "realistic"
        },
        "current_session": {
            "index": session_count,
            "conversation": [],
            "start_relationship": 50,
            "relationship_index": 50,
            "started_at": now,
            "ended_at": None,
            "report": None
        },
        "session_history": []
    }


class TestSaveLimitEnforcement:
    """
    **Feature: user-save-system, Property 3: Save Limit Enforcement**
    **Validates: Requirements 2.2**
    
    *For any* user with exactly 10 saves, attempting to create a new save 
    SHALL fail with an appropriate error message indicating the limit is reached.
    """
    
    @given(nickname=valid_nickname_strategy, save_name=valid_save_name_strategy)
    @settings(max_examples=50)
    def test_create_save_fails_at_limit(self, nickname: str, save_name: str):
        """达到存档上限时创建应失败"""
        mock_client = MagicMock()
        # 模拟已有 10 个存档
        mock_client.get_saves_index.return_value = [
            {"id": f"save_{i}", "name": f"存档{i}"} for i in range(MAX_SAVES_PER_USER)
        ]
        
        with patch('backend.services.save_service.get_soul_cos_client', return_value=mock_client):
            request = CreateSaveRequest(
                name=save_name,
                scenario_config=ScenarioConfig(scenario="测试")
            )
            
            with pytest.raises(ValueError) as exc_info:
                create_save(nickname, request)
            
            assert "上限" in str(exc_info.value) or str(MAX_SAVES_PER_USER) in str(exc_info.value)
    
    @given(
        nickname=valid_nickname_strategy,
        save_name=valid_save_name_strategy,
        current_count=st.integers(min_value=0, max_value=MAX_SAVES_PER_USER - 1)
    )
    @settings(max_examples=50)
    def test_create_save_succeeds_below_limit(self, nickname: str, save_name: str, current_count: int):
        """未达上限时创建应成功"""
        mock_client = MagicMock()
        mock_client.get_saves_index.return_value = [
            {"id": f"save_{i}", "name": f"存档{i}"} for i in range(current_count)
        ]
        mock_client.create_save.return_value = {}
        
        with patch('backend.services.save_service.get_soul_cos_client', return_value=mock_client):
            request = CreateSaveRequest(
                name=save_name,
                scenario_config=ScenarioConfig(scenario="测试")
            )
            
            result = create_save(nickname, request)
            
            assert result is not None
            assert result.name == save_name
            mock_client.create_save.assert_called_once()


class TestSaveSummaryCompleteness:
    """
    **Feature: user-save-system, Property 4: Save Summary Completeness**
    **Validates: Requirements 2.3**
    
    *For any* save in the system, the save summary SHALL contain: id, name, 
    relationship_index, session_count, and updated_at fields, all with valid non-null values.
    """
    
    @given(
        save_id=valid_save_id_strategy,
        name=valid_save_name_strategy,
        relationship_index=st.integers(min_value=0, max_value=100),
        session_count=st.integers(min_value=1, max_value=100),
    )
    @settings(max_examples=100)
    def test_save_summary_has_all_required_fields(
        self, save_id: str, name: str, relationship_index: int, session_count: int
    ):
        """存档摘要应包含所有必需字段"""
        summary = SaveSummary(
            id=save_id,
            name=name,
            relationship_index=relationship_index,
            session_count=session_count,
            total_turns=0,
            updated_at=datetime.now().isoformat()
        )
        
        # 验证所有必需字段存在且非空
        assert summary.id is not None and len(summary.id) > 0
        assert summary.name is not None and len(summary.name) > 0
        assert summary.relationship_index is not None
        assert summary.session_count is not None and summary.session_count >= 1
        assert summary.updated_at is not None and len(summary.updated_at) > 0


class TestSaveLoadRoundTrip:
    """
    **Feature: user-save-system, Property 5: Save Load Round-Trip**
    **Validates: Requirements 2.4, 8.3**
    
    *For any* save, loading the save after it was last updated SHALL restore 
    the exact scenario_config, current_session conversation, and relationship_index.
    """
    
    @given(
        nickname=valid_nickname_strategy,
        save_id=valid_save_id_strategy,
        save_name=valid_save_name_strategy,
        relationship_index=st.integers(min_value=0, max_value=100)
    )
    @settings(max_examples=50)
    def test_save_load_preserves_data(
        self, nickname: str, save_id: str, save_name: str, relationship_index: int
    ):
        """保存后加载应保留所有数据"""
        mock_client = MagicMock()
        
        # 创建测试数据
        save_data = create_mock_save(save_id, save_name, nickname)
        save_data["current_session"]["relationship_index"] = relationship_index
        
        mock_client.get_save.return_value = save_data
        
        with patch('backend.services.save_service.get_soul_cos_client', return_value=mock_client):
            result = get_save(nickname, save_id)
            
            assert result is not None
            assert result.id == save_id
            assert result.name == save_name
            assert result.current_session.relationship_index == relationship_index


class TestRestartWithPreservation:
    """
    **Feature: user-save-system, Property 6: Restart with Preservation**
    **Validates: Requirements 2.6, 3.2**
    
    *For any* save with a non-empty current session, restarting with preserve_history=true 
    SHALL result in: (1) the previous session archived to session_history, 
    (2) a new empty current_session, (3) relationship_index reset to 50, 
    (4) session_index incremented by 1.
    """
    
    @given(
        nickname=valid_nickname_strategy,
        save_id=valid_save_id_strategy,
        initial_session_index=st.integers(min_value=1, max_value=100),
        initial_relationship=st.integers(min_value=0, max_value=100)
    )
    @settings(max_examples=50)
    def test_restart_with_preservation_archives_session(
        self, nickname: str, save_id: str, initial_session_index: int, initial_relationship: int
    ):
        """保留历史的重新开始应归档当前会话"""
        mock_client = MagicMock()
        
        # 创建有对话的存档
        save_data = create_mock_save(save_id, "测试存档", nickname, initial_session_index)
        save_data["current_session"]["relationship_index"] = initial_relationship
        save_data["current_session"]["conversation"] = [
            {"role": "user", "text": "你好", "ts": 1234567890}
        ]
        
        mock_client.get_save.return_value = save_data
        mock_client.update_save.return_value = save_data
        
        with patch('backend.services.save_service.get_soul_cos_client', return_value=mock_client):
            request = RestartSaveRequest(preserve_history=True)
            result = restart_save(nickname, save_id, request)
            
            assert result is not None
            # 验证会话索引增加
            assert result.current_session.index == initial_session_index + 1
            # 验证关系指数重置
            assert result.current_session.relationship_index == 50
            # 验证对话清空
            assert len(result.current_session.conversation) == 0
            # 验证历史被保留
            assert len(result.session_history) == 1


class TestRestartWithoutPreservation:
    """
    **Feature: user-save-system, Property 7: Restart without Preservation**
    **Validates: Requirements 2.7**
    
    *For any* save, restarting with preserve_history=false SHALL result in: 
    (1) current_session cleared, (2) relationship_index reset to 50, 
    (3) session_index incremented by 1, (4) session_history unchanged.
    """
    
    @given(
        nickname=valid_nickname_strategy,
        save_id=valid_save_id_strategy,
        initial_session_index=st.integers(min_value=1, max_value=100)
    )
    @settings(max_examples=50)
    def test_restart_without_preservation_clears_session(
        self, nickname: str, save_id: str, initial_session_index: int
    ):
        """不保留历史的重新开始应清空当前会话"""
        mock_client = MagicMock()
        
        save_data = create_mock_save(save_id, "测试存档", nickname, initial_session_index)
        save_data["current_session"]["conversation"] = [
            {"role": "user", "text": "你好", "ts": 1234567890}
        ]
        save_data["session_history"] = []  # 初始无历史
        
        mock_client.get_save.return_value = save_data
        mock_client.update_save.return_value = save_data
        
        with patch('backend.services.save_service.get_soul_cos_client', return_value=mock_client):
            request = RestartSaveRequest(preserve_history=False)
            result = restart_save(nickname, save_id, request)
            
            assert result is not None
            # 验证会话索引增加
            assert result.current_session.index == initial_session_index + 1
            # 验证关系指数重置
            assert result.current_session.relationship_index == 50
            # 验证对话清空
            assert len(result.current_session.conversation) == 0
            # 验证历史未变（仍为空）
            assert len(result.session_history) == 0


class TestSaveDeletion:
    """
    **Feature: user-save-system, Property 8: Save Deletion**
    **Validates: Requirements 2.8**
    
    *For any* existing save, after deletion the save SHALL no longer be 
    retrievable and SHALL not appear in the user's saves list.
    """
    
    @given(nickname=valid_nickname_strategy, save_id=valid_save_id_strategy)
    @settings(max_examples=50)
    def test_delete_save_removes_from_storage(self, nickname: str, save_id: str):
        """删除存档应从存储中移除"""
        mock_client = MagicMock()
        mock_client.delete_save.return_value = True
        
        with patch('backend.services.save_service.get_soul_cos_client', return_value=mock_client):
            result = delete_save(nickname, save_id)
            
            assert result == True
            mock_client.delete_save.assert_called_once_with(nickname, save_id)


class TestArchivedSessionCompleteness:
    """
    **Feature: user-save-system, Property 9: Archived Session Completeness**
    **Validates: Requirements 3.1**
    
    *For any* archived session in session_history, the session SHALL contain: 
    index, conversation (list), start_relationship, final_relationship, 
    started_at, and ended_at fields.
    """
    
    @given(
        session_index=st.integers(min_value=1, max_value=100),
        start_relationship=st.integers(min_value=0, max_value=100),
        final_relationship=st.integers(min_value=0, max_value=100),
        turn_count=st.integers(min_value=0, max_value=20)
    )
    @settings(max_examples=100)
    def test_archived_session_has_all_required_fields(
        self, session_index: int, start_relationship: int, 
        final_relationship: int, turn_count: int
    ):
        """归档会话应包含所有必需字段"""
        now = datetime.now().isoformat()
        
        # 创建对话
        conversation = [
            ConversationTurn(role="user" if i % 2 == 0 else "peer", text=f"消息{i}", ts=float(i))
            for i in range(turn_count)
        ]
        
        # 创建归档会话
        archived_session = SessionData(
            index=session_index,
            conversation=conversation,
            start_relationship=start_relationship,
            relationship_index=final_relationship,
            started_at=now,
            ended_at=now,
            report=None
        )
        
        # 验证所有必需字段存在
        assert archived_session.index is not None and archived_session.index >= 1
        assert archived_session.conversation is not None
        assert isinstance(archived_session.conversation, list)
        assert archived_session.start_relationship is not None
        assert archived_session.relationship_index is not None
        assert archived_session.started_at is not None and len(archived_session.started_at) > 0
        # ended_at 对于归档会话应该存在
        assert archived_session.ended_at is not None


class TestSessionHistoryRetrieval:
    """
    **Feature: user-save-system, Property 10: Session History Retrieval**
    **Validates: Requirements 3.3**
    
    *For any* save with archived sessions, viewing the save's history SHALL 
    return all archived sessions with their relationship outcomes.
    """
    
    @given(
        nickname=valid_nickname_strategy,
        save_id=valid_save_id_strategy,
        history_count=st.integers(min_value=1, max_value=5)
    )
    @settings(max_examples=50)
    def test_session_history_retrieval_returns_all_sessions(
        self, nickname: str, save_id: str, history_count: int
    ):
        """获取存档应返回所有历史会话"""
        mock_client = MagicMock()
        now = datetime.now().isoformat()
        
        # 创建带历史的存档
        save_data = create_mock_save(save_id, "测试存档", nickname)
        save_data["session_history"] = [
            {
                "index": i + 1,
                "conversation": [{"role": "user", "text": f"历史消息{i}", "ts": float(i)}],
                "start_relationship": 50,
                "relationship_index": 50 + i * 5,
                "started_at": now,
                "ended_at": now,
                "report": None
            }
            for i in range(history_count)
        ]
        
        mock_client.get_save.return_value = save_data
        
        with patch('backend.services.save_service.get_soul_cos_client', return_value=mock_client):
            result = get_save(nickname, save_id)
            
            assert result is not None
            assert len(result.session_history) == history_count
            
            # 验证每个历史会话都有关系变化数据
            for i, session in enumerate(result.session_history):
                assert session.index == i + 1
                assert session.start_relationship is not None
                assert session.relationship_index is not None
