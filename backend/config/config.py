from pathlib import Path
from typing import Optional
import os
from openai import OpenAI

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
TOKEN_FILE = BASE_DIR / "config" / "modelscope_token.txt"

# Model & endpoint configuration
MODEL_NAME = os.getenv("QWEN_MODEL_NAME", "Qwen/Qwen3-8B")
BASE_URL = os.getenv("MODEL_BASE_URL", "https://api-inference.modelscope.cn/v1")


def read_modelscope_token() -> str:
	"""
	Read ModelScope token from env or token file.
	"""
	token = os.getenv("MODELSCOPE_TOKEN")
	if token:
		return token.strip()
	if not TOKEN_FILE.exists():
		raise RuntimeError(f"ModelScope Token 文件不存在: {TOKEN_FILE}")
	return TOKEN_FILE.read_text(encoding="utf-8").strip()


def create_openai_client() -> OpenAI:
	"""
	Create OpenAI-compatible client for ModelScope/Qwen.
	"""
	return OpenAI(
		base_url=BASE_URL,
		api_key=read_modelscope_token(),
	)


