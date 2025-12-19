# Soul TalkBuddy｜灵感搭子 💬✨

**和会“回”的AI一起练聊天，边聊边更会聊** 😎👉🗣️

一个面向Z世代的社交对话练习场，通过AI对手实战 + 实时建议，帮你把社交焦虑变成可练的肌肉记忆。

---

## 🎯 项目定位

**功能**：AI对话练习场 + 实时建议引擎 + MBTI个性化定制

**目标用户**：
- 🎓 高校学生（本科/硕士/博士）：想提升社交表达、减少“社死”瞬间
- 💼 初入职场新人：需要快速适应职场沟通、建立人脉
- 🌍 社交焦虑人群：希望在一个安全、无压力的环境中练习聊天技巧
- 🎮 年轻玩家：喜欢AI互动、想探索“人机共创”的社交新玩法

**核心价值**：把“不会聊天”变成“可以练习的技能”，让每一次对话都成为成长的机会。

---

## ✨ 创新点

### 1. **实时建议引擎**（Always-on Coaching）
- 📊 **顶部轻提示**：输入时实时给出“温度建议”（语气/禁忌/可聊锚点）
- 🎯 **三条候选卡片**：镜像/稳妥/幽默三种风格，点选即用，附“为什么这样建议”的可解释标签
- 🛡️ **安全不踩雷**：敏感拦截 + 改写兜底，避免“社死”瞬间

### 2. **AI对手实战陪练**（Simulated Social Practice）
- 🤖 **多风格AI对手**：自然/活泼/理性/温和/专业/俏皮/克制，像真人一样陪你练
- 🔄 **闭环反馈**：我说 → AI回 → 提示 → 采纳 → 效果，形成完整的“模拟实战教学”
- 📈 **关系晴雨表**：量化互动质量（0-100），实时反馈你的聊天表现

### 3. **MBTI/荣格八维个性化**（Persona-Driven Suggestions）
- 🧠 **快速测评**：12题快速测评，30秒出结果
- 🔍 **会话推断**：从聊天记录弱监督推断MBTI，无需手动测评
- 🎨 **个性化建议**：根据你的八维偏好（Ni/Ne/Si/Se/Ti/Te/Fi/Fe）调整候选措辞
  - S倾向 → 更具体的例子与步骤
  - N倾向 → 更多类比与愿景式表述
  - T倾向 → 更偏逻辑、事实的语气
  - F倾向 → 更偏共情、情感承接

### 4. **智能语境理解**（Context-Aware Intelligence）
- ❓ **问句识别**：对方提问时，强制“先回答再补一句”，避免“反问式社死”
- 🔗 **关键词锚点**：必须承接对方上一条的关键词，确保对话连贯
- 🌦️ **冷场修复**：超过阈值未互动 → 自动给“续聊锚点”与上下文接力句

### 5. **可解释性与复盘**（Explainable & Reflective）
- 📝 **一键复盘**：对话结束后给出“什么有效/什么下次可改”的简报
- 🎯 **采纳率追踪**：记录你采纳建议的频率，优化推荐策略
- 📊 **指标看板**：采纳率、被回复率、对话长度、冷场恢复率等

---

## 🛠️ 技术架构

基于 **FastAPI + ModelScope(Qwen/Qwen3-8B)** 的演示项目：
- 始终提示 + 三条候选卡片 + MBTI/荣格八维测评与会话推断

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

<!-- python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 -->

打开浏览器访问：`http://127.0.0.1:8000/`

## 使用说明
- 输入时：上方“温度提示”与下方“三条候选卡片”实时更新
- 发送前会做一次“强审校”
- “MBTI/八维”按钮：可做 12 题快速测评；亦可基于会话推断
- 侧栏可勾选“应用到建议”，将八维偏好用于候选重排与措辞

## 注意
- 用于比赛演示：未做持久化，画像为进程内存；生产需接入数据库与鉴权
- 安全策略为简化版本（词表/正则/规则），建议结合更强模型策略


