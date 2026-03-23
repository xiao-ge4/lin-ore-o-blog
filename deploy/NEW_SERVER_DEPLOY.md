# 新服务器部署指南（49.232.53.21）

## 📌 架构概览

```
前端 (Vercel)                          新服务器 49.232.53.21
┌─────────────────────┐               ┌──────────────────────────────┐
│ www.lin-ore-o.blog  │               │  Nginx (443/80)              │
│                     │   HTTPS       │  api.lin-ore-o.blog          │
│ /soul-talkbuddy ────┼──────────────►│  /soul/* → 127.0.0.1:8002   │
│ /podcast ───────────┼──────────────►│  /*      → 127.0.0.1:8001   │
└─────────────────────┘               │                              │
                                      │  Soul Backend    :8002       │
                                      │  Podcast Backend :8001       │
                                      └──────────────────────────────┘
```

---

## 🔧 第零步：DNS 配置

在你的域名服务商控制台，将 `api.lin-ore-o.blog` 的 A 记录指向新 IP：

| 类型 | 主机记录 | 记录值 |
|------|---------|--------|
| A    | api     | 49.232.53.21 |

⚠️ DNS 生效需要几分钟到几小时，建议先配置。

---

## 📦 第一步：上传代码到服务器

在本地电脑执行（PowerShell）：

```powershell
# 上传 Soul TalkBuddy 后端
scp -r C:\Users\Ku\Downloads\LLM\Soul-1\soul-backend-deploy ubuntu@49.232.53.21:~/soul-backend

# 上传 Podcast Generator 后端
scp -r C:\Users\Ku\Downloads\LLM\Soul-1\podcast-backend-deploy ubuntu@49.232.53.21:~/podcast-backend
```

---

## 🖥️ 第二步：SSH 登录服务器

```bash
ssh ubuntu@49.232.53.21
```

---

## 📥 第三步：安装系统依赖

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git nginx certbot python3-certbot-nginx
```

---

## 🤖 第四步：部署 Soul TalkBuddy Backend

```bash
# 移动到 /opt
sudo mv ~/soul-backend /opt/soul-backend
cd /opt/soul-backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# 测试启动（确认无报错后 Ctrl+C 停止）
/opt/soul-backend/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8002
```

### 配置文件检查

确认 `/opt/soul-backend/backend/config/cos_config.ini` 中的配置正确：
- COS SecretId/SecretKey
- ModelScope Token
- 模型名称 Qwen/Qwen3-8B

### 创建系统服务

```bash
sudo tee /etc/systemd/system/soul-backend.service > /dev/null << 'EOF'
[Unit]
Description=Soul TalkBuddy Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/soul-backend
Environment="PATH=/opt/soul-backend/venv/bin"
ExecStart=/opt/soul-backend/venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8002
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable soul-backend
sudo systemctl start soul-backend
sudo systemctl status soul-backend
```

---

## 🎙️ 第五步：部署 Podcast Generator Backend

```bash
# 移动到 /opt
sudo mv ~/podcast-backend /opt/podcast-backend
cd /opt/podcast-backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 安装 Playwright（网页抓取需要）
playwright install chromium
playwright install-deps chromium
deactivate

# 测试启动
/opt/podcast-backend/venv/bin/uvicorn api_main:app --host 0.0.0.0 --port 8001
```

### 配置文件

确认 `/opt/podcast-backend/config.ini` 中的配置正确：
- Bocha API Key
- 腾讯云 SecretId/SecretKey

### 创建系统服务

```bash
sudo tee /etc/systemd/system/kpodcast.service > /dev/null << 'EOF'
[Unit]
Description=Podcast Generator Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/podcast-backend
Environment="PATH=/opt/podcast-backend/venv/bin"
ExecStart=/opt/podcast-backend/venv/bin/uvicorn api_main:app --host 127.0.0.1 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable kpodcast
sudo systemctl start kpodcast
sudo systemctl status kpodcast
```

---

## 🌐 第六步：配置 Nginx 反向代理

```bash
sudo tee /etc/nginx/sites-available/api-backend > /dev/null << 'EOF'
server {
    listen 80;
    server_name api.lin-ore-o.blog;

    # Podcast Generator API（默认路径）
    location / {
        proxy_pass http://127.0.0.1:8001;
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
        client_max_body_size 50M;
    }

    # Soul TalkBuddy API（/soul 路径前缀）
    location /soul/ {
        rewrite ^/soul/(.*) /$1 break;
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
EOF

# 启用配置
sudo ln -sf /etc/nginx/sites-available/api-backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 第七步：配置 SSL 证书

```bash
# 确保 DNS 已生效
ping api.lin-ore-o.blog

# 获取证书（按提示操作）
sudo certbot --nginx -d api.lin-ore-o.blog

# 测试自动续期
sudo certbot renew --dry-run
```

---

## 🔥 第八步：配置防火墙

### 服务器防火墙
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 腾讯云安全组
在腾讯云控制台 → 安全组，确保开放以下端口：
- 22 (SSH)
- 80 (HTTP)
- 443 (HTTPS)

---

## ✅ 第九步：验证部署

```bash
# 检查服务状态
sudo systemctl status soul-backend
sudo systemctl status kpodcast
sudo systemctl status nginx

# 本地测试
curl http://127.0.0.1:8002/docs
curl http://127.0.0.1:8001/docs

# 外部测试（SSL 配置完成后）
curl https://api.lin-ore-o.blog/soul/docs
curl https://api.lin-ore-o.blog/docs
```

---

## 🌐 第十步：更新前端（Vercel）

在 Vercel Dashboard → 你的项目 → Settings → Environment Variables：

| Name | Value |
|------|-------|
| `VITE_SOUL_API_BASE` | `https://api.lin-ore-o.blog/soul` |
| `VITE_PODCAST_API_BASE` | `https://api.lin-ore-o.blog` |

然后重新部署：Deployments → 最新部署 → Redeploy

---

## 🔄 常用运维命令

```bash
# 查看日志
sudo journalctl -u soul-backend -f
sudo journalctl -u kpodcast -f

# 重启服务
sudo systemctl restart soul-backend
sudo systemctl restart kpodcast
sudo systemctl restart nginx

# 更新代码后重启
cd /opt/soul-backend && source venv/bin/activate && pip install -r requirements.txt && deactivate
sudo systemctl restart soul-backend

cd /opt/podcast-backend && source venv/bin/activate && pip install -r requirements.txt && deactivate
sudo systemctl restart kpodcast
```
