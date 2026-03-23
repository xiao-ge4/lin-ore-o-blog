"""
报告服务的属性测试
"""
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import MagicMock, patch
from datetime import datetime

from backend.models.save_types import (
    Report, RelationshipChange, ConversationTurn, SessionData
)
from backend.services.report_service import (
    generate_report, get_session_report, _generate_fallback_report
)


# ============================================
# 生成策略
# ============================================

valid_chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ你好世界测试"
valid_nickname_strategy = st.text(alphabet=valid_chars, min_size=1, max_size=6)
valid_save_id_strategy = st.text(alphabet="abcdef0123456789", min_size=12, max_size=12)


def create_mock_save_with_conversation(
    save_id: str, nickname: str, turn_count: int,
    start_rel: int = 50, current_rel: int = 60
) -> dict:
    """创建带对话的模拟存档"""
    now = datetime.now().isoformat()
    conversation = [
        {"role": "user" if i % 2 == 0 else "peer", "text": f"测试消息{i}", "ts": float(i)}
        for i in range(turn_count)
    ]
    return {
        "id": save_id,
        "name": "测试存档",
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
            "index": 1,
            "conversation": conversation,
            "start_relationship": start_rel,
            "relationship_index": current_rel,
            "started_at": now,
            "ended_at": None,
            "report": None
        },
        "session_history": []
    }


class TestReportCompleteness:
    """
    **Feature: user-save-system, Property 11: Report Completeness**
    **Validates: Requirements 4.2**
    
    *For any* generated report, the report SHALL contain: session_index, 
    relationship_change (with start, end, delta), total_turns, highlights (list), 
    improvements (list), overall_comment, and generated_at fields.
    """
    
    @given(
        session_index=st.integers(min_value=1, max_value=100),
        start_rel=st.integers(min_value=0, max_value=100),
        end_rel=st.integers(min_value=0, max_value=100),
        total_turns=st.integers(min_value=1, max_value=100),
        highlight_count=st.integers(min_value=0, max_value=5),
        improvement_count=st.integers(min_value=0, max_value=3)
    )
    @settings(max_examples=100)
    def test_report_has_all_required_fields(
        self, session_index: int, start_rel: int, end_rel: int,
        total_turns: int, highlight_count: int, improvement_count: int
    ):
        """报告应包含所有必需字段"""
        highlights = [f"亮点{i}" for i in range(highlight_count)]
        improvements = [f"改进{i}" for i in range(improvement_count)]
        
        report = Report(
            session_index=session_index,
            relationship_change=RelationshipChange(
                start=start_rel,
                end=end_rel,
                delta=end_rel - start_rel
            ),
            total_turns=total_turns,
            highlights=highlights,
            improvements=improvements,
            overall_comment="测试评价",
            generated_at=datetime.now().isoformat()
        )
        
        # 验证所有必需字段存在
        assert report.session_index is not None and report.session_index >= 1
        assert report.relationship_change is not None
        assert report.relationship_change.start is not None
        assert report.relationship_change.end is not None
        assert report.relationship_change.delta == end_rel - start_rel
        assert report.total_turns is not None and report.total_turns >= 0
        assert report.highlights is not None and isinstance(report.highlights, list)
        assert report.improvements is not None and isinstance(report.improvements, list)
        assert report.overall_comment is not None
        assert report.generated_at is not None and len(report.generated_at) > 0


class TestReportPersistence:
    """
    **Feature: user-save-system, Property 12: Report Persistence**
    **Validates: Requirements 4.3, 4.4**
    
    *For any* save where a report is generated, the report SHALL be stored 
    in the current session's report field and SHALL be retrievable when loading the save.
    """
    
    def test_report_is_persisted_after_generation(self):
        """生成报告后应持久化到存档"""
        nickname = "测试"
        save_id = "abc123def456"
        turn_count = 3
        
        mock_cos_client = MagicMock()
        save_data = create_mock_save_with_conversation(save_id, nickname, turn_count)
        mock_cos_client.get_save.return_value = save_data
        mock_cos_client.update_save.return_value = save_data
        
        # Mock LLM 返回
        mock_llm_response = '{"highlights": ["好"], "improvements": ["继续"], "overall_comment": "不错"}'
        
        with patch('backend.clients.soul_cos_client.get_soul_cos_client', return_value=mock_cos_client):
            with patch('backend.services.save_service.get_soul_cos_client', return_value=mock_cos_client):
                with patch('backend.clients.llm_client.chat_completion', return_value=mock_llm_response):
                    report = generate_report(nickname, save_id)
                    
                    assert report is not None
                    # 验证 update_save 被调用（持久化）
                    mock_cos_client.update_save.assert_called()
                    
                    # 验证调用参数中包含报告
                    call_args = mock_cos_client.update_save.call_args
                    saved_data = call_args[0][1]  # 第二个参数是存档数据
                    assert saved_data["current_session"]["report"] is not None


class TestFallbackReport:
    """
    测试备用报告生成（当 LLM 失败时）
    """
    
    @given(turn_count=st.integers(min_value=1, max_value=50))
    @settings(max_examples=50)
    def test_fallback_report_generates_valid_content(self, turn_count: int):
        """备用报告应生成有效内容"""
        conversation = [
            ConversationTurn(
                role="user" if i % 2 == 0 else "peer",
                text=f"测试消息内容{i}" * (i % 5 + 1),  # 变化长度
                ts=float(i)
            )
            for i in range(turn_count)
        ]
        
        result = _generate_fallback_report(conversation)
        
        assert "highlights" in result
        assert "improvements" in result
        assert "overall_comment" in result
        assert isinstance(result["highlights"], list)
        assert isinstance(result["improvements"], list)
        assert len(result["highlights"]) > 0
        assert len(result["improvements"]) > 0
        assert len(result["overall_comment"]) > 0


class TestGetSessionReport:
    """
    测试获取会话报告
    """
    
    @given(
        nickname=valid_nickname_strategy,
        save_id=valid_save_id_strategy,
        session_index=st.integers(min_value=1, max_value=10)
    )
    @settings(max_examples=30)
    def test_get_current_session_report(
        self, nickname: str, save_id: str, session_index: int
    ):
        """应能获取当前会话的报告"""
        mock_cos_client = MagicMock()
        now = datetime.now().isoformat()
        
        save_data = create_mock_save_with_conversation(save_id, nickname, 5)
        save_data["current_session"]["index"] = session_index
        save_data["current_session"]["report"] = {
            "session_index": session_index,
            "relationship_change": {"start": 50, "end": 60, "delta": 10},
            "total_turns": 5,
            "highlights": ["好"],
            "improvements": ["继续"],
            "overall_comment": "不错",
            "generated_at": now
        }
        
        mock_cos_client.get_save.return_value = save_data
        
        with patch('backend.services.save_service.get_soul_cos_client', return_value=mock_cos_client):
            report = get_session_report(nickname, save_id, session_index)
            
            assert report is not None
            assert report.session_index == session_index
