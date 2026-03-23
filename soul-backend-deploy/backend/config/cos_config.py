"""
腾讯云 COS 配置模块
支持从环境变量读取（优先）或从配置文件读取
"""
from __future__ import annotations
import os
import configparser
from typing import Optional, Dict, Any
from pathlib import Path

# 配置文件路径
CONFIG_FILE_PATH = Path(__file__).parent / "cos_config.ini"

# 环境变量名称
ENV_PREFIX = "SOUL_COS_"
ENV_ENABLED = f"{ENV_PREFIX}ENABLED"
ENV_SECRET_ID = f"{ENV_PREFIX}SECRET_ID"
ENV_SECRET_KEY = f"{ENV_PREFIX}SECRET_KEY"
ENV_REGION = f"{ENV_PREFIX}REGION"
ENV_BUCKET = f"{ENV_PREFIX}BUCKET"


class COSConfig:
    """COS 配置类"""
    
    def __init__(
        self,
        enabled: bool = False,
        secret_id: str = "",
        secret_key: str = "",
        region: str = "",
        bucket: str = ""
    ):
        self.enabled = enabled
        self.secret_id = secret_id
        self.secret_key = secret_key
        self.region = region
        self.bucket = bucket
    
    def is_valid(self) -> bool:
        """检查配置是否完整有效"""
        if not self.enabled:
            return False
        return all([
            self.secret_id,
            self.secret_key,
            self.region,
            self.bucket
        ])
    
    def get_missing_fields(self) -> list[str]:
        """获取缺失的必填字段"""
        missing = []
        if not self.secret_id:
            missing.append("secret_id")
        if not self.secret_key:
            missing.append("secret_key")
        if not self.region:
            missing.append("region")
        if not self.bucket:
            missing.append("bucket")
        return missing
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（隐藏敏感信息）"""
        return {
            "enabled": self.enabled,
            "secret_id": self.secret_id[:8] + "***" if self.secret_id else "",
            "region": self.region,
            "bucket": self.bucket,
            "is_valid": self.is_valid()
        }


def _parse_bool(value: str) -> bool:
    """解析布尔值字符串"""
    return value.lower() in ("true", "1", "yes", "on")


def _load_from_env() -> Dict[str, Any]:
    """从环境变量加载配置"""
    config = {}
    
    enabled_str = os.environ.get(ENV_ENABLED, "")
    if enabled_str:
        config["enabled"] = _parse_bool(enabled_str)
    
    secret_id = os.environ.get(ENV_SECRET_ID, "")
    if secret_id:
        config["secret_id"] = secret_id
    
    secret_key = os.environ.get(ENV_SECRET_KEY, "")
    if secret_key:
        config["secret_key"] = secret_key
    
    region = os.environ.get(ENV_REGION, "")
    if region:
        config["region"] = region
    
    bucket = os.environ.get(ENV_BUCKET, "")
    if bucket:
        config["bucket"] = bucket
    
    return config


def _load_from_file(file_path: Path) -> Dict[str, Any]:
    """从配置文件加载配置"""
    config = {}
    
    if not file_path.exists():
        return config
    
    try:
        parser = configparser.ConfigParser()
        parser.read(file_path, encoding="utf-8")
        
        if "cos" in parser:
            cos_section = parser["cos"]
            
            if "enabled" in cos_section:
                config["enabled"] = _parse_bool(cos_section["enabled"])
            
            if "secret_id" in cos_section:
                config["secret_id"] = cos_section["secret_id"]
            
            if "secret_key" in cos_section:
                config["secret_key"] = cos_section["secret_key"]
            
            if "region" in cos_section:
                config["region"] = cos_section["region"]
            
            if "bucket" in cos_section:
                config["bucket"] = cos_section["bucket"]
    
    except Exception as e:
        print(f"⚠️ 读取 COS 配置文件失败: {e}")
    
    return config


def load_cos_config(config_file: Optional[Path] = None) -> COSConfig:
    """
    加载 COS 配置
    
    优先级：环境变量 > 配置文件
    
    Args:
        config_file: 可选的配置文件路径，默认使用 cos_config.ini
    
    Returns:
        COSConfig 实例
    """
    file_path = config_file or CONFIG_FILE_PATH
    
    # 先从文件加载（作为基础）
    file_config = _load_from_file(file_path)
    
    # 再从环境变量加载（覆盖文件配置）
    env_config = _load_from_env()
    
    # 合并配置，环境变量优先
    merged = {**file_config, **env_config}
    
    return COSConfig(
        enabled=merged.get("enabled", False),
        secret_id=merged.get("secret_id", ""),
        secret_key=merged.get("secret_key", ""),
        region=merged.get("region", ""),
        bucket=merged.get("bucket", "")
    )


# 全局配置实例（延迟初始化）
_cos_config: Optional[COSConfig] = None


def get_cos_config() -> COSConfig:
    """获取全局 COS 配置实例"""
    global _cos_config
    if _cos_config is None:
        _cos_config = load_cos_config()
    return _cos_config


def reload_cos_config() -> COSConfig:
    """重新加载 COS 配置"""
    global _cos_config
    _cos_config = load_cos_config()
    return _cos_config
