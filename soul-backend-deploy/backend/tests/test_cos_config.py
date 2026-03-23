"""
COS 配置模块的属性测试

**Feature: user-save-system, Property 17: Configuration Validation**
**Validates: Requirements 7.3**
"""
import os
import pytest
from hypothesis import given, strategies as st, settings
from pathlib import Path
from tempfile import NamedTemporaryFile

from backend.config.cos_config import (
    COSConfig,
    load_cos_config,
    _parse_bool,
    _load_from_env,
    ENV_ENABLED,
    ENV_SECRET_ID,
    ENV_SECRET_KEY,
    ENV_REGION,
    ENV_BUCKET
)


# ============================================
# Property Tests
# ============================================

class TestConfigurationValidation:
    """
    **Feature: user-save-system, Property 17: Configuration Validation**
    **Validates: Requirements 7.3**
    
    *For any* loaded COS configuration, the system SHALL only enable COS features 
    if all required fields (secret_id, secret_key, region, bucket) are present and non-empty.
    """
    
    @given(
        secret_id=st.text(min_size=0, max_size=50),
        secret_key=st.text(min_size=0, max_size=50),
        region=st.text(min_size=0, max_size=20),
        bucket=st.text(min_size=0, max_size=50)
    )
    @settings(max_examples=100)
    def test_config_is_valid_only_when_all_fields_present(
        self, secret_id: str, secret_key: str, region: str, bucket: str
    ):
        """配置仅在所有必填字段都存在且非空时才有效"""
        config = COSConfig(
            enabled=True,
            secret_id=secret_id.strip(),
            secret_key=secret_key.strip(),
            region=region.strip(),
            bucket=bucket.strip()
        )
        
        all_fields_present = all([
            secret_id.strip(),
            secret_key.strip(),
            region.strip(),
            bucket.strip()
        ])
        
        assert config.is_valid() == all_fields_present
    
    @given(
        enabled=st.booleans(),
        secret_id=st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=('L', 'N'))),
        secret_key=st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=('L', 'N'))),
        region=st.text(min_size=1, max_size=20, alphabet=st.characters(whitelist_categories=('L', 'N', 'Pd'))),
        bucket=st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=('L', 'N', 'Pd')))
    )
    @settings(max_examples=100)
    def test_config_disabled_is_never_valid(
        self, enabled: bool, secret_id: str, secret_key: str, region: str, bucket: str
    ):
        """当 enabled=False 时，配置永远无效"""
        config = COSConfig(
            enabled=False,
            secret_id=secret_id,
            secret_key=secret_key,
            region=region,
            bucket=bucket
        )
        
        assert config.is_valid() == False
    
    @given(
        secret_id=st.text(min_size=0, max_size=50),
        secret_key=st.text(min_size=0, max_size=50),
        region=st.text(min_size=0, max_size=20),
        bucket=st.text(min_size=0, max_size=50)
    )
    @settings(max_examples=100)
    def test_missing_fields_correctly_identified(
        self, secret_id: str, secret_key: str, region: str, bucket: str
    ):
        """缺失字段能被正确识别"""
        config = COSConfig(
            enabled=True,
            secret_id=secret_id.strip(),
            secret_key=secret_key.strip(),
            region=region.strip(),
            bucket=bucket.strip()
        )
        
        missing = config.get_missing_fields()
        
        # 验证缺失字段列表的正确性
        if not secret_id.strip():
            assert "secret_id" in missing
        else:
            assert "secret_id" not in missing
        
        if not secret_key.strip():
            assert "secret_key" in missing
        else:
            assert "secret_key" not in missing
        
        if not region.strip():
            assert "region" in missing
        else:
            assert "region" not in missing
        
        if not bucket.strip():
            assert "bucket" in missing
        else:
            assert "bucket" not in missing


class TestBoolParsing:
    """布尔值解析测试"""
    
    @given(st.sampled_from(["true", "True", "TRUE", "1", "yes", "Yes", "YES", "on", "On", "ON"]))
    def test_truthy_values(self, value: str):
        """真值字符串应解析为 True"""
        assert _parse_bool(value) == True
    
    @given(st.sampled_from(["false", "False", "FALSE", "0", "no", "No", "NO", "off", "Off", "OFF", "", "random"]))
    def test_falsy_values(self, value: str):
        """假值字符串应解析为 False"""
        assert _parse_bool(value) == False


class TestEnvironmentVariablePriority:
    """环境变量优先级测试"""
    
    def test_env_vars_override_file_config(self, monkeypatch, tmp_path):
        """环境变量应覆盖文件配置"""
        # 创建临时配置文件
        config_file = tmp_path / "cos_config.ini"
        config_file.write_text("""
[cos]
enabled = true
secret_id = file_secret_id
secret_key = file_secret_key
region = ap-guangzhou
bucket = file-bucket
""")
        
        # 设置环境变量
        monkeypatch.setenv(ENV_SECRET_ID, "env_secret_id")
        monkeypatch.setenv(ENV_REGION, "ap-beijing")
        
        # 加载配置
        config = load_cos_config(config_file)
        
        # 环境变量应覆盖文件配置
        assert config.secret_id == "env_secret_id"
        assert config.region == "ap-beijing"
        # 文件配置应保留（未被环境变量覆盖的字段）
        assert config.secret_key == "file_secret_key"
        assert config.bucket == "file-bucket"
    
    def test_file_config_used_when_no_env_vars(self, tmp_path, monkeypatch):
        """无环境变量时应使用文件配置"""
        # 清除可能存在的环境变量
        for env_var in [ENV_ENABLED, ENV_SECRET_ID, ENV_SECRET_KEY, ENV_REGION, ENV_BUCKET]:
            monkeypatch.delenv(env_var, raising=False)
        
        # 创建临时配置文件
        config_file = tmp_path / "cos_config.ini"
        config_file.write_text("""
[cos]
enabled = true
secret_id = file_only_id
secret_key = file_only_key
region = ap-shanghai
bucket = file-only-bucket
""")
        
        config = load_cos_config(config_file)
        
        assert config.enabled == True
        assert config.secret_id == "file_only_id"
        assert config.secret_key == "file_only_key"
        assert config.region == "ap-shanghai"
        assert config.bucket == "file-only-bucket"


class TestConfigToDict:
    """配置转字典测试"""
    
    def test_sensitive_info_hidden(self):
        """敏感信息应被隐藏"""
        config = COSConfig(
            enabled=True,
            secret_id="AKID1234567890abcdef",
            secret_key="supersecretkey123",
            region="ap-beijing",
            bucket="my-bucket"
        )
        
        result = config.to_dict()
        
        # secret_id 应被部分隐藏
        assert "***" in result["secret_id"]
        assert result["secret_id"].startswith("AKID1234")
        # secret_key 不应出现在字典中
        assert "secret_key" not in result
        # 其他字段正常显示
        assert result["region"] == "ap-beijing"
        assert result["bucket"] == "my-bucket"
