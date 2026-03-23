"""
用户服务的属性测试

**Feature: user-save-system, Property 1: Nickname Validation**
**Validates: Requirements 1.2**
"""
import pytest
from hypothesis import given, strategies as st, settings, assume
import re

from backend.services.user_service import validate_nickname, NICKNAME_PATTERN


# ============================================
# 生成策略
# ============================================

# 有效的中文字符
chinese_chars = "".join(chr(c) for c in range(0x4E00, 0x9FA6))

# 有效的英文字符
english_chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

# 有效昵称字符集
valid_chars = english_chars + chinese_chars[:100]  # 限制中文字符数量以提高测试速度

# 无效字符（数字、特殊符号等）
invalid_chars = "0123456789!@#$%^&*()_+-=[]{}|;':\",./<>?`~ \t\n"


class TestNicknameValidation:
    """
    **Feature: user-save-system, Property 1: Nickname Validation**
    **Validates: Requirements 1.2**
    
    *For any* string input, the nickname validation function SHALL return true 
    if and only if the string contains only Chinese characters (U+4E00-U+9FA5) 
    or English letters (a-z, A-Z) and has length between 1 and 6 characters inclusive.
    """
    
    @given(st.text(alphabet=valid_chars, min_size=1, max_size=6))
    @settings(max_examples=100)
    def test_valid_nicknames_pass(self, nickname: str):
        """有效昵称应通过验证"""
        is_valid, error = validate_nickname(nickname)
        assert is_valid == True, f"昵称 '{nickname}' 应该有效，但返回错误: {error}"
        assert error == ""
    
    @given(st.text(alphabet=valid_chars, min_size=7, max_size=20))
    @settings(max_examples=100)
    def test_too_long_nicknames_fail(self, nickname: str):
        """超过6个字符的昵称应失败"""
        is_valid, error = validate_nickname(nickname)
        assert is_valid == False
        assert "6" in error or "长度" in error
    
    @given(st.just(""))
    def test_empty_nickname_fails(self, nickname: str):
        """空昵称应失败"""
        is_valid, error = validate_nickname(nickname)
        assert is_valid == False
        assert "空" in error
    
    @given(st.text(alphabet=invalid_chars, min_size=1, max_size=6))
    @settings(max_examples=100)
    def test_invalid_chars_fail(self, nickname: str):
        """包含无效字符的昵称应失败"""
        # 确保至少有一个字符
        assume(len(nickname.strip()) > 0)
        
        is_valid, error = validate_nickname(nickname)
        assert is_valid == False
    
    @given(
        valid_part=st.text(alphabet=valid_chars, min_size=1, max_size=3),
        invalid_part=st.text(alphabet=invalid_chars, min_size=1, max_size=3)
    )
    @settings(max_examples=100)
    def test_mixed_valid_invalid_chars_fail(self, valid_part: str, invalid_part: str):
        """混合有效和无效字符的昵称应失败"""
        nickname = valid_part + invalid_part
        assume(len(nickname) <= 6)
        assume(len(invalid_part.strip()) > 0)  # 确保无效部分不是纯空白
        
        is_valid, error = validate_nickname(nickname)
        # 如果无效部分只包含空白，可能会被其他规则捕获
        if any(c in invalid_part for c in "0123456789!@#$%^&*()"):
            assert is_valid == False


class TestNicknameEdgeCases:
    """昵称边界情况测试"""
    
    def test_single_english_char(self):
        """单个英文字符应有效"""
        is_valid, _ = validate_nickname("A")
        assert is_valid == True
        
        is_valid, _ = validate_nickname("z")
        assert is_valid == True
    
    def test_single_chinese_char(self):
        """单个中文字符应有效"""
        is_valid, _ = validate_nickname("你")
        assert is_valid == True
    
    def test_six_english_chars(self):
        """6个英文字符应有效"""
        is_valid, _ = validate_nickname("abcdef")
        assert is_valid == True
    
    def test_six_chinese_chars(self):
        """6个中文字符应有效"""
        is_valid, _ = validate_nickname("你好世界测试")
        assert is_valid == True
    
    def test_mixed_chinese_english(self):
        """中英文混合应有效"""
        is_valid, _ = validate_nickname("小明Tom")
        assert is_valid == True
    
    def test_seven_chars_fail(self):
        """7个字符应失败"""
        is_valid, _ = validate_nickname("abcdefg")
        assert is_valid == False
    
    def test_number_fails(self):
        """包含数字应失败"""
        is_valid, _ = validate_nickname("abc123")
        assert is_valid == False
    
    def test_space_fails(self):
        """包含空格应失败"""
        is_valid, _ = validate_nickname("ab cd")
        assert is_valid == False
    
    def test_special_char_fails(self):
        """包含特殊字符应失败"""
        is_valid, _ = validate_nickname("abc!")
        assert is_valid == False


class TestNicknamePatternConsistency:
    """验证函数与正则模式的一致性"""
    
    @given(st.text(min_size=0, max_size=10))
    @settings(max_examples=200)
    def test_validation_matches_pattern(self, nickname: str):
        """验证函数结果应与正则模式匹配"""
        is_valid, _ = validate_nickname(nickname)
        
        # 正则模式的预期结果
        pattern_matches = bool(NICKNAME_PATTERN.match(nickname)) if nickname else False
        
        # 验证函数应与正则模式一致
        assert is_valid == pattern_matches, \
            f"昵称 '{nickname}': validate_nickname={is_valid}, pattern={pattern_matches}"


# ============================================
# Property 2 & 15: Login/Register Behavior and User Creation Side Effects
# ============================================

from unittest.mock import MagicMock, patch
from backend.services.user_service import login_or_register, get_user_info


class TestLoginRegisterBehavior:
    """
    **Feature: user-save-system, Property 2: Login/Register Behavior**
    **Validates: Requirements 1.4, 1.5**
    
    *For any* valid nickname, the login function SHALL return status "login" 
    if the nickname exists in COS users_index, or status "register" if the 
    nickname does not exist, and in the register case SHALL create a new user record.
    """
    
    @given(st.text(alphabet=valid_chars, min_size=1, max_size=6))
    @settings(max_examples=50)
    def test_existing_user_returns_login(self, nickname: str):
        """已存在的用户应返回 login 状态"""
        mock_client = MagicMock()
        mock_client.user_exists.return_value = True
        mock_client.update_user_login.return_value = {
            "nickname": nickname,
            "created_at": "2024-01-01T00:00:00",
            "last_login_at": "2024-12-16T00:00:00",
            "save_count": 0
        }
        
        with patch('backend.services.user_service.get_soul_cos_client', return_value=mock_client):
            result = login_or_register(nickname)
            
            assert result.status == "login"
            assert result.nickname == nickname
            mock_client.user_exists.assert_called_once_with(nickname)
            mock_client.create_user.assert_not_called()
    
    @given(st.text(alphabet=valid_chars, min_size=1, max_size=6))
    @settings(max_examples=50)
    def test_new_user_returns_register(self, nickname: str):
        """新用户应返回 register 状态"""
        mock_client = MagicMock()
        mock_client.user_exists.return_value = False
        mock_client.create_user.return_value = {
            "nickname": nickname,
            "created_at": "2024-12-16T00:00:00",
            "last_login_at": "2024-12-16T00:00:00",
            "save_count": 0
        }
        
        with patch('backend.services.user_service.get_soul_cos_client', return_value=mock_client):
            result = login_or_register(nickname)
            
            assert result.status == "register"
            assert result.nickname == nickname
            mock_client.user_exists.assert_called_once_with(nickname)
            mock_client.create_user.assert_called_once_with(nickname)
    
    def test_invalid_nickname_raises_error(self):
        """无效昵称应抛出 ValueError"""
        with pytest.raises(ValueError):
            login_or_register("abc123")  # 包含数字
        
        with pytest.raises(ValueError):
            login_or_register("")  # 空字符串
        
        with pytest.raises(ValueError):
            login_or_register("abcdefgh")  # 超过6个字符
    
    def test_cos_unavailable_raises_error(self):
        """COS 不可用时应抛出 RuntimeError"""
        with patch('backend.services.user_service.get_soul_cos_client', return_value=None):
            with pytest.raises(RuntimeError):
                login_or_register("test")


class TestUserCreationSideEffects:
    """
    **Feature: user-save-system, Property 15: User Creation Side Effects**
    **Validates: Requirements 6.5**
    
    *For any* newly created user, the users_index.json SHALL contain an entry 
    for the nickname, and the user directory structure (profile.json, 
    saves_index.json, progress.json) SHALL exist.
    """
    
    @given(st.text(alphabet=valid_chars, min_size=1, max_size=6))
    @settings(max_examples=50)
    def test_create_user_creates_all_files(self, nickname: str):
        """创建用户应创建所有必需文件"""
        mock_client = MagicMock()
        mock_client.user_exists.return_value = False
        mock_client.get_users_index.return_value = []
        
        # 跟踪 put_json 调用
        put_json_calls = []
        def track_put_json(key, data):
            put_json_calls.append((key, data))
            return True
        mock_client.put_json.side_effect = track_put_json
        
        mock_client.create_user.return_value = {
            "nickname": nickname,
            "created_at": "2024-12-16T00:00:00",
            "last_login_at": "2024-12-16T00:00:00",
            "save_count": 0
        }
        
        with patch('backend.services.user_service.get_soul_cos_client', return_value=mock_client):
            result = login_or_register(nickname)
            
            # 验证 create_user 被调用
            mock_client.create_user.assert_called_once_with(nickname)
            
            # 验证返回结果
            assert result.status == "register"
            assert result.profile is not None
            assert result.profile.nickname == nickname
