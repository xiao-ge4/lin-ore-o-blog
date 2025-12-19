# Soul TalkBuddy 自有服务器部署指南

本文档说明如何将 Soul TalkBuddy 后端部署到自己的服务器，前端继续使用 Vercel。

---

## 📌 你的配置信息

| 项目 | 值 |
|------|-----|
| 前端域名 | `https://www.lin-ore-o.blog` |
| 后端服务器 IP | `82.157.17.187` |
| 后端端口 | `8002` |
| 后端 API 地址 | `http://82.157.17.187:8002` |
| SSH 用户名 | `ubuntu` |

---

## 📋 前提条件

1. ✅ 一台云服务器（阿里云/腾讯云/华为云等）
2. ✅ 服务器已安装 Python 3.10+
3. ✅ 域名（可选，但推荐）
4. ✅ SSL 证书（如果使用域名，推荐使用 Let's Encrypt 免费证书）
5. ✅ ModelScope API Token
6. ✅ 腾讯云 COS 配置（用于用户数据存储）

---

## 🖥️ 第一部分：后端部署到自有服务器

### **1.1 服务器环境准备**

```bash
# 登录服务器
ssh ubuntu@82.157.17.187

# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Python 3.10+
sudo apt install python3.10 python3.10-venv python3-pip -y

# 安装 Git
sudo apt install git -y

# 安装 Nginx（用于反向代理，可选）
sudo apt install nginx -y
```

### **1.2 上传后端代码**

**方式A：通过 Git 克隆（推荐）**
```bash
# 在服务器上
cd /opt
sudo git clone https://github.com/YOUR_USERNAME/soul-backend.git
cd soul-backend
```

**方式B：通过 SCP 上传**
```bash
# 在本地电脑上
scp -r soul-backend-deploy ubuntu@82.157.17.187:~/soul-backend

# 然后在服务器上移动到 /opt
sudo mv ~/soul-backend /opt/soul-backend
```

### **1.3 创建虚拟环境并安装依赖**

```bash
cd /opt/soul-backend

# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### **1.4 配置环境变量**

**方式A：使用配置文件（推荐）**

编辑 `backend/config/cos_config.ini`：
```ini
[cos]
enabled = true
secret_id = 你的腾讯云SecretId
secret_key = 你的腾讯云SecretKey
region = ap-beijing
bucket = your-bucket-name

[app]
conversation_history_length = 40
model_name = Qwen/Qwen3-8B
model_base_url = https://api-inference.modelscope.cn/v1
model_api_token = 你的ModelScope Token
```

**方式B：使用环境变量**

创建 `/opt/soul-backend/.env` 文件：
```bash
MODELSCOPE_TOKEN=你的ModelScope Token
MODEL_BASE_URL=https://api-inference.modelscope.cn/v1
QWEN_MODEL_NAME=Qwen/Qwen3-8B

SOUL_COS_ENABLED=true
SOUL_COS_SECRET_ID=你的腾讯云SecretId
SOUL_COS_SECRET_KEY=你的腾讯云SecretKey
SOUL_COS_REGION=ap-beijing
SOUL_COS_BUCKET=your-bucket-name
```

### **1.5 测试后端是否能启动**

```bash
cd /opt/soul-backend
source venv/bin/activate

# 测试启动（使用 8002 端口，避免与其他项目冲突）
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8002

# 如果看到以下输出，说明启动成功：
# INFO:     Uvicorn running on http://0.0.0.0:8002
# ✅ Soul COS 客户端初始化成功
```

按 `Ctrl+C` 停止测试。

### **1.6 配置 Systemd 服务（后台运行）**

创建服务文件：
```bash
sudo nano /etc/systemd/system/soul-backend.service
```

写入以下内容：
```ini
[Unit]
Description=Soul TalkBuddy Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/soul-backend
Environment="PATH=/opt/soul-backend/venv/bin"
ExecStart=/opt/soul-backend/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8002
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
# 重新加载 systemd
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start soul-backend

# 设置开机自启
sudo systemctl enable soul-backend

# 查看状态
sudo systemctl status soul-backend

# 查看日志
sudo journalctl -u soul-backend -f
```

### **1.7 配置 Nginx 反向代理（可选）**

如果你想通过域名访问后端 API，可以配置 Nginx。

创建 Nginx 配置：
```bash
sudo nano /etc/nginx/sites-available/soul-backend
```

**使用子域名 api.lin-ore-o.blog：**
```nginx
server {
    listen 80;
    server_name api.lin-ore-o.blog;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.lin-ore-o.blog;

    ssl_certificate /etc/letsencrypt/live/api.lin-ore-o.blog/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.lin-ore-o.blog/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

启用配置：
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/soul-backend /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### **1.8 配置防火墙**

```bash
# 开放 8002 端口（直接 IP 访问）
sudo ufw allow 8002

# 如果使用 Nginx，还需要开放 80/443
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 22  # SSH
sudo ufw enable
```

**重要**：还需要在腾讯云控制台的**防火墙/安全组**中开放 8002 端口！

### **1.9 获取 SSL 证书（可选）**

如果你想用 `https://api.lin-ore-o.blog` 访问后端：

1. 先在域名 DNS 中添加 A 记录：`api.lin-ore-o.blog` → `82.157.17.187`

2. 获取证书：
```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取证书
sudo certbot --nginx -d api.lin-ore-o.blog

# 自动续期测试
sudo certbot renew --dry-run
```

### **1.10 测试后端**

访问以下地址测试：
- 直接 IP：`http://82.157.17.187:8002/docs`
- 如果配置了域名：`https://api.lin-ore-o.blog/docs`

你应该能看到 FastAPI 的 Swagger 文档页面。

---

## 🌐 第二部分：更新前端配置

### **2.1 修改前端环境变量**

编辑 `test-lele-net-main/.env`：
```bash
# Soul TalkBuddy 后端 API 地址（通过 Nginx 反向代理）
VITE_SOUL_API_BASE=https://api.lin-ore-o.blog/soul

# Podcast Generator 后端 API 地址（通过 Nginx 反向代理）
VITE_PODCAST_API_BASE=https://api.lin-ore-o.blog

# 本地开发时使用 localhost
# VITE_SOUL_API_BASE=http://localhost:8000
# VITE_PODCAST_API_BASE=http://localhost:8001
```

### **2.2 更新 app.js 中的 API 地址**

检查 `test-lele-net-main/public/soul-assets/app.js` 开头：
```javascript
// API Base URL configuration
const API_BASE = window.SOUL_API_BASE || 'http://localhost:8000';
```

这个会自动从环境变量读取，不需要修改。

### **2.3 提交并部署到 Vercel**

```bash
cd test-lele-net-main
git add .
git commit -m "Update API base URL to self-hosted server"
git push
```

### **2.4 在 Vercel 中更新环境变量**

1. 登录 Vercel Dashboard
2. 进入你的项目 → Settings → Environment Variables
3. 更新或添加：
   | Name | Value |
   |------|-------|
   | `VITE_SOUL_API_BASE` | `https://api.lin-ore-o.blog/soul` |
   | `VITE_PODCAST_API_BASE` | `https://api.lin-ore-o.blog` |

4. 点击 Save
5. 重新部署：Deployments → 最新部署 → Redeploy

---

## ✅ 部署检查清单

### 后端检查
- [x] 服务器能 SSH 登录
- [x] Python 3.10+ 已安装
- [x] 后端代码已上传
- [x] 虚拟环境已创建，依赖已安装
- [x] 配置文件已正确设置（cos_config.ini）
- [x] Systemd 服务已启动并设为开机自启
- [x] 腾讯云防火墙已开放 8002 端口
- [x] `http://82.157.17.187:8002/docs` 可访问

### 前端检查
- [ ] `.env` 文件已更新为 `http://82.157.17.187:8002`
- [ ] Vercel 环境变量已更新
- [ ] 前端已重新部署
- [ ] 前端能正常调用后端 API

### 功能测试
- [ ] 用户登录/注册
- [ ] 创建存档
- [ ] AI 对话功能
- [ ] 存档保存/加载
- [ ] 学习报告生成

---

## 🔧 常见问题

### **问题1：CORS 错误**

编辑 `backend/main.py`，确保 CORS 配置正确：
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 或指定 ["https://www.lin-ore-o.blog"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### **问题2：502 Bad Gateway**

检查后端服务是否运行：
```bash
sudo systemctl status soul-backend
sudo journalctl -u soul-backend -f
```

### **问题3：混合内容警告（HTTPS 前端调用 HTTP 后端）**

由于前端是 `https://www.lin-ore-o.blog`，后端是 `http://82.157.17.187:8002`，浏览器可能会阻止请求。

解决方案：
1. 给后端配置 SSL 证书（推荐）
2. 或者在浏览器中允许混合内容（不推荐）

### **问题4：COS 存储连接失败**

1. 检查 SecretId/SecretKey 是否正确
2. 检查 Bucket 名称和 Region 是否匹配
3. 检查服务器是否能访问腾讯云 API

---

## 🔄 后续更新流程

### 更新后端代码

```bash
# 登录服务器
ssh ubuntu@82.157.17.187

# 进入项目目录
cd /opt/soul-backend

# 拉取最新代码（如果用 Git）
git pull

# 或者重新上传文件

# 激活虚拟环境
source venv/bin/activate

# 如果有新依赖，安装
pip install -r requirements.txt

# 重启服务
sudo systemctl restart soul-backend
```

### 更新前端代码

```bash
# 本地修改后
cd test-lele-net-main
git add .
git commit -m "Your update message"
git push
# Vercel 会自动重新部署
```

---

## 🎉 完成！

部署完成后，你的架构是：
- **前端**：`https://www.lin-ore-o.blog`（Vercel，自动 HTTPS、CDN 加速）
- **后端**：`http://82.157.17.187:8002`（自有服务器，无冷启动）
- **数据存储**：腾讯云 COS

这种架构的优势：
1. 后端无冷启动延迟
2. 完全控制服务器配置
3. 可以根据需要扩展资源
4. 数据安全可控
