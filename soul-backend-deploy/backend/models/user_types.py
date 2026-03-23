"""
用户相关的数据模型
"""
from __future__ import annotations
from typing import Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime


class UserIndexItem(BaseModel):
    """用户索引项"""
    nickname: str
    created_at: str


class UserProfile(BaseModel):
    """用户信息"""
    nickname: str
    created_at: str
    last_login_at: str
    save_count: int = 0


class LoginRequest(BaseModel):
    """登录请求"""
    nickname: str = Field(
        ...,
        min_length=1,
        max_length=6,
        description="用户昵称，1-6个字符，仅支持中英文"
    )


class LoginResponse(BaseModel):
    """登录响应"""
    status: Literal["login", "register"]
    nickname: str
    message: str
    profile: Optional[UserProfile] = None


class UserInfoResponse(BaseModel):
    """用户信息响应"""
    nickname: str
    created_at: str
    last_login_at: str
    save_count: int
