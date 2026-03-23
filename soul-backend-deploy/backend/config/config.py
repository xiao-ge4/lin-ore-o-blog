from pathlib import Path
from typing import Optional
import os
import configparser
from openai import OpenAI

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
TOKEN_FILE = BASE_DIR / "config" / "modelscope_token.txt"
CONFIG_FILE = BASE_DIR / "config" / "cos_config.ini"

# 从配置文件加载 [app] 节
_app_config = {}
if CONFIG_FILE.exists():
    try:
        _parser = configparser.ConfigParser()
        _parser.read(CONFIG_FILE, encoding="utf-8")
        if "app" in _parser:
            _app_config = dict(_parser["app"])
    except Exception as e:
        print(f"⚠️ 读取配置文件 [app] 节失败: {e}")


def _get_config(env_name: str, config_key: str, default: str) -> str:
    """
    获取配置值，优先级：环境变量 > 配置文件 > 默认值
    """
    # 1. 环境变量优先
    env_val = os.getenv(env_name)
    if env_val:
        return env_val
    # 2. 配置文件
    if config_key in _app_config:
        return _app_config[config_key]
    # 3. 默认值
    return default


# Model & endpoint configuration
MODEL_NAME = _get_config("QWEN_MODEL_NAME", "model_name", "Qwen/Qwen3-8B")
BASE_URL = _get_config("MODEL_BASE_URL", "model_base_url", "https://api-inference.modelscope.cn/v1")

# Conversation history length (number of turns to keep in context)
CONVERSATION_HISTORY_LENGTH = int(_get_config("CONVERSATION_HISTORY_LENGTH", "conversation_history_length", "40"))

# Common env var names used by不同平台（取其一即可）
_TOKEN_ENV_CANDIDATES = [
    "MODELSCOPE_TOKEN",
    "MODELSCOPE_API_TOKEN",
    "MODELSCOPE_API_KEY",
    "MSPACE_TOKEN",
    "MSPACE_API_TOKEN",
    "MSPACE_API_KEY",
    "OPENAI_API_KEY",  # 兼容部分统一Key名
]


def read_modelscope_token() -> str:
    """
    Read ModelScope token.
    优先级：环境变量 > 配置文件 cos_config.ini > modelscope_token.txt
    """
    # 1. 环境变量优先
    for name in _TOKEN_ENV_CANDIDATES:
        val = os.getenv(name)
        if val:
            return val.strip()
    # 2. 配置文件 cos_config.ini [app] model_api_token
    token_from_ini = _app_config.get("model_api_token", "").strip()
    if token_from_ini:
        return token_from_ini
    # 3. 独立 token 文件
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text(encoding="utf-8").strip()
    candidates = ", ".join(_TOKEN_ENV_CANDIDATES)
    raise RuntimeError(
        f"未检测到模型 Token。请在环境变量中设置其一：[{candidates}]，"
        f"或在 cos_config.ini [app] 节设置 model_api_token，"
        f"或在 {TOKEN_FILE} 写入 Token。"
    )


def create_openai_client() -> OpenAI:
    """
    Create OpenAI-compatible client for ModelScope/Qwen.
    """
    return OpenAI(
        base_url=BASE_URL,
        api_key=read_modelscope_token(),
    )
