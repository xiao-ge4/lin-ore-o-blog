# Echo 共情对话教练（交个朋友｜社交智能体） Demo

基于 FastAPI + ModelScope(Qwen/Qwen3-8B) 的演示项目：始终提示 + 三条候选卡片 + MBTI/荣格八维测评与会话推断。

## 目录结构

```
backend/
  main.py
  requirements.txt
  config/
    config.py
    modelscope_token.txt   # 存放 ModelScope Token（已放置）
  clients/
    llm_client.py
  models/
    types.py
  services/
    suggest_service.py
    persona_service.py
    safety_service.py
    memory_service.py
frontend/
  index.html
  styles.css
  app.js
```

## 准备环境

1) 安装依赖
```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r backend\requirements.txt
```

2) 配置模型
- 已在 `backend/config/modelscope_token.txt` 放入 ModelScope Token
- 也可使用环境变量覆盖：
  - `MODELSCOPE_TOKEN`（优先）
  - `MODEL_BASE_URL`（默认 `https://api-inference.modelscope.cn/v1`）
  - `QWEN_MODEL_NAME`（默认 `Qwen/Qwen3-8B`）

## 启动

```bash
.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

打开浏览器访问：`http://127.0.0.1:8000/`

## 使用说明
- 输入时：上方“温度提示”与下方“三条候选卡片”实时更新
- 发送前会做一次“强审校”
- “MBTI/八维”按钮：可做 12 题快速测评；亦可基于会话推断
- 侧栏可勾选“应用到建议”，将八维偏好用于候选重排与措辞

## 注意
- 用于比赛演示：未做持久化，画像为进程内存；生产需接入数据库与鉴权
- 安全策略为简化版本（词表/正则/规则），建议结合更强模型策略


