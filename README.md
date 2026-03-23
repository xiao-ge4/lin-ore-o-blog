# Leleo 个人主页 & Soul TalkBuddy & Podcast Generator

## 目录

- [项目简介](#项目简介)
- [在线演示](#在线演示)
- [架构概览](#架构概览)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [功能特性](#功能特性)
  - [个人主页](#个人主页)
  - [Soul TalkBuddy - AI 社交对话教练](#soul-talkbuddy---ai-社交对话教练)
  - [Podcast Generator - AI 播客生成器](#podcast-generator---ai-播客生成器)
- [本地开发](#本地开发)
  - [前端](#前端开发)
  - [Soul TalkBuddy 后端](#soul-talkbuddy-后端开发)
  - [Podcast Generator 后端](#podcast-generator-后端开发)
- [部署指南](#部署指南)
  - [方案A：自有服务器部署（当前使用）](#方案a自有服务器部署当前使用)
  - [方案B：Render 免费部署（备选）](#方案brender-免费部署备选)
  - [前端部署到 Vercel](#前端部署到-vercel)
- [环境变量](#环境变量)
- [API 接口](#api-接口)
- [运维命令](#运维命令)
- [常见问题](#常见问题)

---

## 项目简介

这是 Leleo 的个人网站项目，包含三个主要模块：

1. **个人主页** - 展示个人信息、技能、项目的响应式主页
2. **Soul TalkBuddy** - AI 社交对话教练，帮助用户在安全低压环境中练习社交聊天技能
3. **Podcast Generator** - AI 播客生成器，将关键词/URL/文档/PDF 转化为播客音频

---

## 在线演示

| 页面 | 地址 |
|------|------|
| 主页 | https://www.lin-ore-o.blog/ |
| Soul TalkBuddy | https://www.lin-ore-o.blog/soul-talkbuddy |
| Podcast Generator | https://www.lin-ore-o.blog/podcast |
| Blog | https://www.lin-ore-o.blog/blog |

---

## 架构概览

```
前端 (Vercel)                          后端服务器 49.232.53.21
┌─────────────────────┐               ┌──────────────────────────────┐
│ www.lin-ore-o.blog  │               │  Nginx (443/80)              │
│                     │   HTTPS       │  api.lin-ore-o.blog          │
│ /soul-talkbuddy ────┼──────────────►│  /soul/* → 127.0.0.1:8002   │
│ /podcast ───────────┼──────────────►│  /*      → 127.0.0.1:8001   │
│ /blog               │               │                              │
│ /                   │               │  Soul Backend    :8002       │
└─────────────────────┘               │  Podcast Backend :8001       │
                                      └──────────────────────────────┘
                                                    │
                                      ┌─────────────┴─────────────┐
                                      │    腾讯云 COS 对象存储      │
                                      │    (用户数据 / 音频文件)    │
                                      └───────────────────────────┘
```

- **前端**：Vercel 托管，自动 HTTPS、CDN 加速
- **后端**：腾讯云自有服务器，Nginx 反向代理 + Let's Encrypt SSL
- **数据存储**：腾讯云 COS 对象存储

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | Vue 3 + Vuetify |
| 构建工具 | Vite |
| 前端部署 | Vercel |
| 后端框架 | FastAPI (Python) |
| LLM | ModelScope Qwen/Qwen3-8B |
| TTS | 腾讯混元 TTS |
| 网页抓取 | Playwright |
| 对象存储 | 腾讯云 COS |
| 反向代理 | Nginx + Let's Encrypt SSL |
| 进程管理 | Systemd |

---

## 目录结构

```
Soul-1/
├── src/                          # 前端源码（Vue 3 组件）
│   ├── components/
│   │   ├── SoulTalkBuddy.vue     # Soul TalkBuddy 前端组件
│   │   ├── PodcastGenerator.vue  # Podcast Generator 前端组件
│   │   └── ...
│   ├── router.js                 # 路由配置
│   └── main.js
├── public/                       # 前端静态资源
├── test-lele-net-main/           # 前端开发目录（完整 Vue 项目）
├── soul-backend-deploy/          # Soul TalkBuddy 后端（部署用）
│   ├── backend/
│   │   ├── main.py               # FastAPI 入口
│   │   ├── config/               # 配置文件（COS、模型）
│   │   ├── clients/              # LLM 客户端
│   │   ├── models/               # 数据模型
│   │   └── services/             # 业务逻辑
│   └── requirements.txt
├── podcast-backend-deploy/       # Podcast Generator 后端（部署用）
│   ├── api_main.py               # FastAPI 入口
│   ├── config.example.ini        # 配置模板
│   ├── scripts/                  # 部署脚本
│   └── requirements.txt
├── deploy/                       # 部署工具
│   ├── NEW_SERVER_DEPLOY.md      # 新服务器部署详细指南
│   └── setup_new_server.sh       # 一键部署脚本
├── .env                          # 环境变量
├── vercel.json                   # Vercel 配置
├── package.json                  # 前端依赖
└── README.md                     # 本文件
```

---

## 功能特性

### 个人主页

- **响应式设计**：适配桌面、平板和手机
- **个人信息展示**：头像、个性标签、简介、技能
- **项目展示**：项目描述、技术栈和链接
- **主题配置**：背景壁纸、音乐播放配置
- **在线配置**：支持 Vercel 环境变量在线自定义

### Soul TalkBuddy - AI 社交对话教练

- **实时建议引擎**：输入时即时给出语气/禁忌/承接关键词建议，三条候选卡片（不同风格与风险提示）
- **AI 对手实战**：多风格 AI 对手 + 难度模式（友善/真实/挑战/自定义），关系晴雨表量化互动质量
- **场景与开场**：场景模板 + 智能分析/应用，开场指引与示例措辞
- **MBTI 个性化**：12 题快速测评 / 基于会话推断，八维偏好用于候选重排与措辞
- **用户系统**：登录/注册、存档管理（创建/加载/删除）、学习报告生成、进度追踪
- **数据持久化**：腾讯云 COS 存储用户数据，支持跨设备访问

### Podcast Generator - AI 播客生成器

- **多种输入模式**：关键词搜索、URL 抓取、文档输入、PDF 上传
- **AI 内容生成**：腾讯混元大模型生成播客对话脚本
- **语音合成**：腾讯混元 TTS 多角色语音合成
- **音频处理**：自动混音、添加背景音乐
- **导出功能**：音频文件 + PPT/PDF 幻灯片导出

---

## 本地开发

### 前端开发

```bash
# 安装依赖
npm install

# 创建 .env 文件
# VITE_SOUL_API_BASE=http://localhost:8002
# VITE_PODCAST_API_BASE=http://localhost:8001

# 启动开发服务器
npm run dev
# 访问 http://localhost:5173/
```

### Soul TalkBuddy 后端开发

```bash
cd soul-backend-deploy

# 创建虚拟环境
python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate

pip install -r requirements.txt

# 配置 backend/config/cos_config.ini（参考 cos_config.example.ini）
# 需要：ModelScope Token、腾讯云 COS 密钥

# 启动
uvicorn backend.main:app --host 127.0.0.1 --port 8002 --reload
# API 文档：http://127.0.0.1:8002/docs
```

**环境变量/配置文件**：
- `MODELSCOPE_TOKEN` - ModelScope API Token
- `MODEL_BASE_URL` - 默认 `https://api-inference.modelscope.cn/v1`
- `QWEN_MODEL_NAME` - 默认 `Qwen/Qwen3-8B`
- `SOUL_COS_SECRET_ID` / `SOUL_COS_SECRET_KEY` - 腾讯云 COS 密钥
- `SOUL_COS_REGION` / `SOUL_COS_BUCKET` - COS 存储桶配置

### Podcast Generator 后端开发

```bash
cd podcast-backend-deploy

python -m venv venv
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate

pip install -r requirements.txt
playwright install chromium

# 配置 config.ini（参考 config.example.ini）
# 需要：Bocha API Key、腾讯云密钥

# 启动
uvicorn api_main:app --host 127.0.0.1 --port 8001 --reload
# API 文档：http://127.0.0.1:8001/docs
```

**配置文件 `config.ini`**：
- `[bocha]` - 博查搜索 API 密钥
- `[tencent]` - 腾讯云 SecretId/SecretKey（用于 TTS 和混元大模型）
- `[hunyuan_api]` - 混元大模型参数
- `[search]` / `[web_extract]` - 搜索和网页提取配置

---

## 部署指南

### 方案A：自有服务器部署（当前使用）

> 详细步骤见 `deploy/NEW_SERVER_DEPLOY.md`

**概要**：

1. **DNS 配置**：将 `api.lin-ore-o.blog` A 记录指向 `49.232.53.21`
2. **上传代码**：
   ```powershell
   scp -r soul-backend-deploy ubuntu@49.232.53.21:~/soul-backend
   scp -r podcast-backend-deploy ubuntu@49.232.53.21:~/podcast-backend
   ```
3. **SSH 到服务器**：`ssh ubuntu@49.232.53.21`
4. **安装依赖**：Python 3.10+、Nginx、Certbot
5. **部署两个后端**：各自创建 venv、安装依赖、配置 Systemd 服务
6. **配置 Nginx**：统一反向代理（`/soul/*` → 8002，`/*` → 8001）
7. **获取 SSL 证书**：`sudo certbot --nginx -d api.lin-ore-o.blog`
8. **一键脚本**：也可使用 `deploy/setup_new_server.sh`

**优势**：无冷启动、完全可控、可扩展

### 方案B：Render 免费部署（备选）

1. 将 `soul-backend-deploy` 和 `podcast-backend-deploy` 分别推到 GitHub
2. 在 Render 创建两个 Web Service
3. Soul TalkBuddy 启动命令：`uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. Podcast Generator 启动命令：`uvicorn api_main:app --host 0.0.0.0 --port $PORT`
5. 配置环境变量（ModelScope Token、COS 密钥等）

**注意**：Render 免费版有冷启动（15分钟无请求后休眠，唤醒需 5-10 秒）

### 前端部署到 Vercel

1. 推送代码到 GitHub（仓库：`xiao-ge4/lin-ore-o-blog`）
2. Vercel 自动检测并部署
3. 在 Vercel Dashboard → Settings → Environment Variables 添加：

| Name | Value |
|------|-------|
| `VITE_SOUL_API_BASE` | `https://api.lin-ore-o.blog/soul` |
| `VITE_PODCAST_API_BASE` | `https://api.lin-ore-o.blog` |

4. 重新部署：Deployments → Redeploy

---

## 环境变量

### 前端 `.env`

```bash
# Soul TalkBuddy 后端 API 地址
VITE_SOUL_API_BASE=https://api.lin-ore-o.blog/soul

# Podcast Generator 后端 API 地址
VITE_PODCAST_API_BASE=https://api.lin-ore-o.blog
```

### Soul TalkBuddy 后端

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MODELSCOPE_TOKEN` | ModelScope API Token | - |
| `MODEL_BASE_URL` | 模型 API 地址 | `https://api-inference.modelscope.cn/v1` |
| `QWEN_MODEL_NAME` | 模型名称 | `Qwen/Qwen3-8B` |
| `SOUL_COS_ENABLED` | 启用 COS 存储 | `true` |
| `SOUL_COS_SECRET_ID` | 腾讯云 SecretId | - |
| `SOUL_COS_SECRET_KEY` | 腾讯云 SecretKey | - |
| `SOUL_COS_REGION` | COS 地域 | `ap-beijing` |
| `SOUL_COS_BUCKET` | COS 存储桶 | - |

### Podcast Generator 后端

| 变量 | 说明 |
|------|------|
| `BOCHA_API_KEY` | 博查搜索 API 密钥 |
| `TENCENT_SECRET_ID` | 腾讯云 SecretId |
| `TENCENT_SECRET_KEY` | 腾讯云 SecretKey |

---

## API 接口

### Soul TalkBuddy（端口 8002）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/suggest` | 获取对话建议 |
| POST | `/api/peer/reply` | AI 对手回复 |
| POST | `/api/mbti/submit` | 提交 MBTI 测评 |
| POST | `/api/mbti/infer-from-chat` | 从对话推断 MBTI |
| GET | `/api/persona` | 获取画像信息 |
| POST | `/api/persona/apply` | 应用画像 |
| POST | `/api/scenario/analyze` | 场景分析 |
| POST | `/api/users/login` | 用户登录 |
| POST | `/api/users/register` | 用户注册 |
| GET | `/api/saves/list` | 存档列表 |
| POST | `/api/saves/create` | 创建存档 |
| GET | `/api/saves/{id}` | 获取存档 |
| PUT | `/api/saves/{id}` | 更新存档 |
| DELETE | `/api/saves/{id}` | 删除存档 |
| POST | `/api/report/generate` | 生成学习报告 |
| GET | `/api/progress` | 获取进度 |

### Podcast Generator（端口 8001）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/generate` | 生成播客 |
| GET | `/api/status/{task_id}` | 查询生成状态 |
| GET | `/docs` | API 文档 |

---

## 运维命令

```bash
# SSH 登录
ssh ubuntu@49.232.53.21

# 查看服务状态
sudo systemctl status soul-backend
sudo systemctl status kpodcast
sudo systemctl status nginx

# 查看日志
sudo journalctl -u soul-backend -f
sudo journalctl -u kpodcast -f

# 重启服务
sudo systemctl restart soul-backend
sudo systemctl restart kpodcast
sudo systemctl restart nginx

# 更新后端代码
cd /opt/soul-backend && source venv/bin/activate && pip install -r requirements.txt && deactivate
sudo systemctl restart soul-backend

cd /opt/podcast-backend && source venv/bin/activate && pip install -r requirements.txt && deactivate
sudo systemctl restart kpodcast

# SSL 证书续期
sudo certbot renew --dry-run
```

---

## 常见问题

### CORS 错误
后端已启用 `CORS("*")`。生产环境建议改为 `allow_origins=["https://www.lin-ore-o.blog"]`。

### 混合内容警告（HTTPS 前端调用 HTTP 后端）
前端是 HTTPS，后端必须也用 HTTPS。已通过 Nginx + Let's Encrypt SSL 解决。

### 后端 502 Bad Gateway
```bash
sudo systemctl status soul-backend   # 检查服务是否运行
sudo journalctl -u soul-backend -f   # 查看错误日志
```

### COS 存储连接失败
1. 检查 SecretId/SecretKey 是否正确
2. 检查 Bucket 名称和 Region 是否匹配
3. 检查服务器网络是否能访问腾讯云 API

### LLM API 调用失败
1. 检查 ModelScope Token 是否有效
2. 检查 `MODEL_BASE_URL` 配置
3. 测试：`curl -H "Authorization: Bearer YOUR_TOKEN" https://api-inference.modelscope.cn/v1/models`

### Render 冷启动（备选方案时）
- 免费版 15 分钟无请求后休眠，首次请求需 5-10 秒
- 解决：使用 cron-job.org 每 10 分钟 ping 一次
- 或升级 Render Starter Plan ($7/月)

---

## 安全建议

1. **限制 CORS**：`allow_origins=["https://www.lin-ore-o.blog"]`
2. **API 限流**：使用 `slowapi` 限制请求频率
3. **密钥管理**：使用环境变量而非硬编码
4. **防火墙**：仅开放 22/80/443 端口
5. **SSL**：保持 Let's Encrypt 证书自动续期

---

## 许可

MIT License
