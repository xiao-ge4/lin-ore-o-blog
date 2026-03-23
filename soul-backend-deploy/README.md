# Soul TalkBuddy Backend

AI社交对话教练后端服务

## 功能特性

- **用户系统**: 基于昵称的简单登录/注册
- **存档管理**: 支持多存档（最多10个），可重新开始并保留历史
- **学习报告**: AI生成对话分析报告，包含亮点和改进建议
- **进度追踪**: 统计学习进度，包括会话数、对话轮数、关系增益等
- **云存储**: 使用腾讯云COS存储用户数据

## 部署到 Render

1. 在 GitHub 创建新仓库 `soul-backend`
2. 推送此代码到仓库
3. 在 Render 创建 Web Service，连接该仓库
4. 配置环境变量：

### LLM 配置
- `MODELSCOPE_TOKEN`: 你的 ModelScope Token
- `MODEL_BASE_URL`: `https://api-inference.modelscope.cn/v1`
- `QWEN_MODEL_NAME`: `Qwen/Qwen3-8B`
- `PYTHON_VERSION`: `3.11.0`

### COS 云存储配置
- `SOUL_COS_ENABLED`: `true` 启用云存储
- `SOUL_COS_SECRET_ID`: 腾讯云 SecretId
- `SOUL_COS_SECRET_KEY`: 腾讯云 SecretKey
- `SOUL_COS_REGION`: 存储桶地域（如 `ap-beijing`）
- `SOUL_COS_BUCKET`: 存储桶名称（如 `soul-data-1234567890`）

## 本地运行

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### 本地 COS 配置

复制配置文件模板：
```bash
cp backend/config/cos_config.example.ini backend/config/cos_config.ini
```

编辑 `cos_config.ini` 填写你的腾讯云 COS 配置。

## API 文档

启动服务后访问 `http://localhost:8000/docs` 查看 Swagger API 文档。

### 主要 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/user/login` | POST | 用户登录/注册 |
| `/api/user/{nickname}/saves` | GET | 获取存档列表 |
| `/api/user/{nickname}/saves` | POST | 创建新存档 |
| `/api/user/{nickname}/saves/{id}` | PUT | 更新存档 |
| `/api/user/{nickname}/saves/{id}/restart` | POST | 重新开始 |
| `/api/user/{nickname}/saves/{id}/report` | POST | 生成报告 |
| `/api/user/{nickname}/progress` | GET | 获取学习进度 |

## 测试

```bash
cd soul-backend-deploy
python -m pytest backend/tests/ -v
```
