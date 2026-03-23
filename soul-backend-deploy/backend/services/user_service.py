"""
用户服务
处理用户认证、注册和管理
"""
from __future__ import annotations
from typing import Tuple, Optional
import re
from datetime import datetime

from backend.models.user_types import UserProfile, LoginResponse
from backend.clients.soul_cos_client import get_soul_cos_client


# 昵称验证正则：1-6个中英文字符
NICKNAME_PATTERN = re.compile(r'^[a-zA-Z\u4e00-\u9fa5]{1,6}$')


def validate_nickname(nickname: str) -> Tuple[bool, str]:
    """
    验证昵称是否有效
    
    规则：
    - 长度：1-6 个字符
    - 字符：仅允许中文（U+4E00-U+9FA5）和英文字母（a-z, A-Z）
    
    **Property 1: Nickname Validation**
    
    Args:
        nickname: 待验证的昵称
        
    Returns:
        (是否有效, 错误信息或空字符串)
    """
    if not nickname:
        return False, "昵称不能为空"
    
    if len(nickname) > 6:
        return False, "昵称长度不能超过6个字符"
    
    if not NICKNAME_PATTERN.match(nickname):
        return False, "昵称只能包含中文或英文字母"
    
    return True, ""


def login_or_register(nickname: str) -> LoginResponse:
    """
    登录或注册用户
    
    **Property 2: Login/Register Behavior**
    - 如果昵称存在，返回 status="login"
    - 如果昵称不存在，创建新用户，返回 status="register"
    
    Args:
        nickname: 用户昵称
        
    Returns:
        LoginResponse
        
    Raises:
        ValueError: 昵称验证失败
        RuntimeError: COS 服务不可用
    """
    # 1. 验证昵称
    is_valid, error_msg = validate_nickname(nickname)
    if not is_valid:
        raise ValueError(error_msg)
    
    # 2. 获取 COS 客户端
    cos_client = get_soul_cos_client()
    if cos_client is None:
        raise RuntimeError("云存储服务不可用，请稍后再试")
    
    # 3. 检查用户是否存在
    if cos_client.user_exists(nickname):
        # 用户存在，更新登录时间
        profile_data = cos_client.update_user_login(nickname)
        profile = UserProfile(**profile_data) if profile_data else None
        return LoginResponse(
            status="login",
            nickname=nickname,
            message=f"欢迎回来，{nickname}！",
            profile=profile
        )
    else:
        # 用户不存在，创建新用户
        profile_data = cos_client.create_user(nickname)
        profile = UserProfile(**profile_data)
        return LoginResponse(
            status="register",
            nickname=nickname,
            message=f"注册成功，欢迎 {nickname}！",
            profile=profile
        )


def get_user_info(nickname: str) -> Optional[UserProfile]:
    """
    获取用户信息
    
    Args:
        nickname: 用户昵称
        
    Returns:
        用户信息，不存在则返回 None
    """
    cos_client = get_soul_cos_client()
    if cos_client is None:
        return None
    
    profile_data = cos_client.get_user_profile(nickname)
    if profile_data is None:
        return None
    
    return UserProfile(**profile_data)


def user_exists(nickname: str) -> bool:
    """
    检查用户是否存在
    
    Args:
        nickname: 用户昵称
        
    Returns:
        是否存在
    """
    cos_client = get_soul_cos_client()
    if cos_client is None:
        return False
    
    return cos_client.user_exists(nickname)
