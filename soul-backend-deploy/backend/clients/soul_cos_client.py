"""
Soul TalkBuddy COS 客户端
用于存储用户数据、存档、进度等到腾讯云 COS
"""
from __future__ import annotations
from typing import Optional, Dict, Any, List
import json
import logging
from datetime import datetime

from qcloud_cos import CosConfig, CosS3Client

logger = logging.getLogger(__name__)

# COS 路径常量
BASE_PATH = "soul"
USERS_INDEX_KEY = f"{BASE_PATH}/users_index.json"


class SoulCOSClient:
    """Soul TalkBuddy COS 客户端"""
    
    def __init__(self, secret_id: str, secret_key: str, region: str, bucket: str):
        """
        初始化 COS 客户端
        
        Args:
            secret_id: 腾讯云 SecretId
            secret_key: 腾讯云 SecretKey
            region: 存储桶地域，如 ap-beijing
            bucket: 存储桶名称，如 soul-talkbuddy-1234567890
        """
        self.region = region
        self.bucket = bucket
        
        config = CosConfig(
            Region=region,
            SecretId=secret_id,
            SecretKey=secret_key,
            Token=None,
            Scheme='https',
            Timeout=60
        )
        self.client = CosS3Client(config)
        logger.info(f"Soul COS 客户端初始化成功: bucket={bucket}, region={region}")
    
    # ============================================
    # 基础操作
    # ============================================
    
    def _get_user_path(self, nickname: str, filename: str = "") -> str:
        """
        获取用户数据路径
        
        路径格式: soul/users/{nickname}/{filename}
        
        **Property 16: Storage Path Structure**
        """
        if filename:
            return f"{BASE_PATH}/users/{nickname}/{filename}"
        return f"{BASE_PATH}/users/{nickname}/"
    
    def put_json(self, key: str, data: Dict[str, Any]) -> bool:
        """
        上传 JSON 数据到 COS
        
        Args:
            key: 文件路径
            data: JSON 数据
            
        Returns:
            是否成功
        """
        try:
            body = json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8')
            self.client.put_object(
                Bucket=self.bucket,
                Body=body,
                Key=key,
                ContentType='application/json; charset=utf-8'
            )
            logger.debug(f"JSON 上传成功: {key}")
            return True
        except Exception as e:
            logger.error(f"JSON 上传失败: {key}, error={e}")
            raise
    
    def get_json(self, key: str) -> Optional[Dict[str, Any]]:
        """
        从 COS 获取 JSON 数据
        
        Args:
            key: 文件路径
            
        Returns:
            JSON 数据，不存在则返回 None
        """
        try:
            response = self.client.get_object(
                Bucket=self.bucket,
                Key=key
            )
            content = response['Body'].get_raw_stream().read().decode('utf-8')
            return json.loads(content)
        except Exception as e:
            error_code = getattr(e, 'get_error_code', lambda: '')()
            if error_code == 'NoSuchKey' or 'NoSuchKey' in str(e):
                logger.debug(f"文件不存在: {key}")
                return None
            logger.error(f"JSON 获取失败: {key}, error={e}")
            raise
    
    def delete_object(self, key: str) -> bool:
        """
        删除 COS 对象
        
        Args:
            key: 文件路径
            
        Returns:
            是否成功
        """
        try:
            self.client.delete_object(
                Bucket=self.bucket,
                Key=key
            )
            logger.debug(f"对象删除成功: {key}")
            return True
        except Exception as e:
            logger.error(f"对象删除失败: {key}, error={e}")
            return False
    
    def check_exists(self, key: str) -> bool:
        """
        检查对象是否存在
        
        Args:
            key: 文件路径
            
        Returns:
            是否存在
        """
        try:
            self.client.head_object(
                Bucket=self.bucket,
                Key=key
            )
            return True
        except Exception:
            return False
    
    # ============================================
    # 用户操作
    # ============================================
    
    def get_users_index(self) -> List[Dict[str, Any]]:
        """
        获取用户索引列表
        
        Returns:
            用户列表 [{"nickname": "xxx", "created_at": "xxx"}, ...]
        """
        data = self.get_json(USERS_INDEX_KEY)
        if data is None:
            return []
        return data.get("users", [])
    
    def _save_users_index(self, users: List[Dict[str, Any]]) -> bool:
        """保存用户索引"""
        return self.put_json(USERS_INDEX_KEY, {"users": users})
    
    def user_exists(self, nickname: str) -> bool:
        """
        检查用户是否存在
        
        Args:
            nickname: 用户昵称
            
        Returns:
            是否存在
        """
        users = self.get_users_index()
        return any(u.get("nickname") == nickname for u in users)
    
    def create_user(self, nickname: str) -> Dict[str, Any]:
        """
        创建新用户
        
        **Property 15: User Creation Side Effects**
        创建用户后，users_index.json 应包含该用户，
        且用户目录结构（profile.json, saves_index.json, progress.json）应存在
        
        Args:
            nickname: 用户昵称
            
        Returns:
            用户信息
        """
        now = datetime.now().isoformat()
        
        # 1. 创建用户 profile
        profile = {
            "nickname": nickname,
            "created_at": now,
            "last_login_at": now,
            "save_count": 0
        }
        profile_key = self._get_user_path(nickname, "profile.json")
        self.put_json(profile_key, profile)
        
        # 2. 创建空的存档索引
        saves_index = {"saves": []}
        saves_index_key = self._get_user_path(nickname, "saves_index.json")
        self.put_json(saves_index_key, saves_index)
        
        # 3. 创建空的进度数据
        progress = {
            "nickname": nickname,
            "total_sessions": 0,
            "total_turns": 0,
            "avg_relationship_gain": 0.0,
            "scenario_stats": [],
            "updated_at": now
        }
        progress_key = self._get_user_path(nickname, "progress.json")
        self.put_json(progress_key, progress)
        
        # 4. 更新用户索引
        users = self.get_users_index()
        users.append({
            "nickname": nickname,
            "created_at": now
        })
        self._save_users_index(users)
        
        logger.info(f"用户创建成功: {nickname}")
        return profile
    
    def get_user_profile(self, nickname: str) -> Optional[Dict[str, Any]]:
        """
        获取用户信息
        
        Args:
            nickname: 用户昵称
            
        Returns:
            用户信息，不存在则返回 None
        """
        profile_key = self._get_user_path(nickname, "profile.json")
        return self.get_json(profile_key)
    
    def update_user_login(self, nickname: str) -> Optional[Dict[str, Any]]:
        """
        更新用户登录时间
        
        Args:
            nickname: 用户昵称
            
        Returns:
            更新后的用户信息
        """
        profile = self.get_user_profile(nickname)
        if profile is None:
            return None
        
        profile["last_login_at"] = datetime.now().isoformat()
        profile_key = self._get_user_path(nickname, "profile.json")
        self.put_json(profile_key, profile)
        return profile
    
    # ============================================
    # 存档操作
    # ============================================
    
    def get_saves_index(self, nickname: str) -> List[Dict[str, Any]]:
        """
        获取用户的存档索引列表
        
        Args:
            nickname: 用户昵称
            
        Returns:
            存档摘要列表
        """
        saves_index_key = self._get_user_path(nickname, "saves_index.json")
        data = self.get_json(saves_index_key)
        if data is None:
            return []
        return data.get("saves", [])
    
    def _save_saves_index(self, nickname: str, saves: List[Dict[str, Any]]) -> bool:
        """保存存档索引"""
        saves_index_key = self._get_user_path(nickname, "saves_index.json")
        return self.put_json(saves_index_key, {"saves": saves})
    
    def get_save(self, nickname: str, save_id: str) -> Optional[Dict[str, Any]]:
        """
        获取单个存档详情
        
        Args:
            nickname: 用户昵称
            save_id: 存档 ID
            
        Returns:
            存档数据，不存在则返回 None
        """
        save_key = self._get_user_path(nickname, f"saves/{save_id}.json")
        return self.get_json(save_key)
    
    def create_save(self, nickname: str, save: Dict[str, Any]) -> Dict[str, Any]:
        """
        创建新存档
        
        Args:
            nickname: 用户昵称
            save: 存档数据
            
        Returns:
            创建的存档
        """
        save_id = save["id"]
        save_key = self._get_user_path(nickname, f"saves/{save_id}.json")
        self.put_json(save_key, save)
        
        # 更新存档索引
        saves = self.get_saves_index(nickname)
        saves.append({
            "id": save_id,
            "name": save.get("name", ""),
            "relationship_index": save.get("current_session", {}).get("relationship_index", 50),
            "session_count": len(save.get("session_history", [])) + 1,
            "total_turns": len(save.get("current_session", {}).get("conversation", [])),
            "updated_at": save.get("updated_at", datetime.now().isoformat())
        })
        self._save_saves_index(nickname, saves)
        
        # 更新用户 profile 的 save_count
        profile = self.get_user_profile(nickname)
        if profile:
            profile["save_count"] = len(saves)
            profile_key = self._get_user_path(nickname, "profile.json")
            self.put_json(profile_key, profile)
        
        logger.info(f"存档创建成功: {nickname}/{save_id}")
        return save
    
    def update_save(self, nickname: str, save: Dict[str, Any]) -> Dict[str, Any]:
        """
        更新存档
        
        Args:
            nickname: 用户昵称
            save: 存档数据
            
        Returns:
            更新后的存档
        """
        save_id = save["id"]
        save["updated_at"] = datetime.now().isoformat()
        save_key = self._get_user_path(nickname, f"saves/{save_id}.json")
        self.put_json(save_key, save)
        
        # 更新存档索引
        saves = self.get_saves_index(nickname)
        for i, s in enumerate(saves):
            if s["id"] == save_id:
                saves[i] = {
                    "id": save_id,
                    "name": save.get("name", ""),
                    "relationship_index": save.get("current_session", {}).get("relationship_index", 50),
                    "session_count": len(save.get("session_history", [])) + 1,
                    "total_turns": len(save.get("current_session", {}).get("conversation", [])),
                    "updated_at": save["updated_at"]
                }
                break
        self._save_saves_index(nickname, saves)
        
        logger.debug(f"存档更新成功: {nickname}/{save_id}")
        return save
    
    def delete_save(self, nickname: str, save_id: str) -> bool:
        """
        删除存档
        
        Args:
            nickname: 用户昵称
            save_id: 存档 ID
            
        Returns:
            是否成功
        """
        save_key = self._get_user_path(nickname, f"saves/{save_id}.json")
        result = self.delete_object(save_key)
        
        if result:
            # 更新存档索引
            saves = self.get_saves_index(nickname)
            saves = [s for s in saves if s["id"] != save_id]
            self._save_saves_index(nickname, saves)
            
            # 更新用户 profile 的 save_count
            profile = self.get_user_profile(nickname)
            if profile:
                profile["save_count"] = len(saves)
                profile_key = self._get_user_path(nickname, "profile.json")
                self.put_json(profile_key, profile)
            
            logger.info(f"存档删除成功: {nickname}/{save_id}")
        
        return result
    
    # ============================================
    # 进度操作
    # ============================================
    
    def get_progress(self, nickname: str) -> Optional[Dict[str, Any]]:
        """
        获取用户学习进度
        
        Args:
            nickname: 用户昵称
            
        Returns:
            进度数据
        """
        progress_key = self._get_user_path(nickname, "progress.json")
        return self.get_json(progress_key)
    
    def update_progress(self, nickname: str, progress: Dict[str, Any]) -> Dict[str, Any]:
        """
        更新用户学习进度
        
        Args:
            nickname: 用户昵称
            progress: 进度数据
            
        Returns:
            更新后的进度
        """
        progress["updated_at"] = datetime.now().isoformat()
        progress_key = self._get_user_path(nickname, "progress.json")
        self.put_json(progress_key, progress)
        return progress


# 全局客户端实例（延迟初始化）
_soul_cos_client: Optional[SoulCOSClient] = None


def init_soul_cos_client() -> Optional[SoulCOSClient]:
    """
    初始化全局 Soul COS 客户端
    
    Returns:
        COS 客户端实例，配置无效则返回 None
    """
    global _soul_cos_client
    
    from backend.config.cos_config import get_cos_config
    
    config = get_cos_config()
    
    if not config.is_valid():
        missing = config.get_missing_fields()
        if missing:
            logger.warning(f"Soul COS 配置不完整，缺少字段: {missing}")
        else:
            logger.info("Soul COS 未启用")
        return None
    
    try:
        _soul_cos_client = SoulCOSClient(
            secret_id=config.secret_id,
            secret_key=config.secret_key,
            region=config.region,
            bucket=config.bucket
        )
        logger.info(f"Soul COS 客户端初始化成功: bucket={config.bucket}")
        return _soul_cos_client
    except Exception as e:
        logger.error(f"Soul COS 客户端初始化失败: {e}")
        return None


def get_soul_cos_client() -> Optional[SoulCOSClient]:
    """获取全局 Soul COS 客户端实例"""
    global _soul_cos_client
    if _soul_cos_client is None:
        init_soul_cos_client()
    return _soul_cos_client
