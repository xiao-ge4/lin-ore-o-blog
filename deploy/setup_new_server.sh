#!/bin/bash
# ============================================
# 新服务器一键部署脚本（49.232.53.21）
# 部署 Soul TalkBuddy Backend (端口 8002)
# 部署 Podcast Generator Backend (端口 8001)
# 配置 Nginx 反向代理 + SSL (api.lin-ore-o.blog)
# ============================================
# 使用方法:
#   1. 先通过 SCP 将 soul-backend-deploy 和 podcast-backend-deploy 上传到服务器
#   2. 将此脚本上传到服务器并执行: bash setup_new_server.sh
# ============================================

set -e

echo ""
echo "=========================================="
echo "  开始部署 Soul TalkBuddy & Podcast Generator"
echo "  服务器: 49.232.53.21"
echo "=========================================="
echo ""

# ============================================
# 第一步：系统环境准备
# ============================================
echo "[1/7] 更新系统并安装依赖..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git nginx certbot python3-certbot-nginx

# ============================================
# 第二步：部署 Soul TalkBuddy Backend
# ============================================
echo "[2/7] 部署 Soul TalkBuddy Backend..."

# 移动代码到 /opt
if [ -d ~/soul-backend ]; then
    sudo rm -rf /opt/soul-backend
    sudo mv ~/soul-backend /opt/soul-backend
fi

cd /opt/soul-backend

# 创建虚拟环境并安装依赖
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# 创建 systemd 服务
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

echo "✅ Soul TalkBuddy Backend 配置完成"

# ============================================
# 第三步：部署 Podcast Generator Backend
# ============================================
echo "[3/7] 部署 Podcast Generator Backend..."

# 移动代码到 /opt
if [ -d ~/podcast-backend ]; then
    sudo rm -rf /opt/podcast-backend
    sudo mv ~/podcast-backend /opt/podcast-backend
fi

cd /opt/podcast-backend

# 创建虚拟环境并安装依赖
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 安装 Playwright 浏览器（网页抓取需要）
playwright install chromium
playwright install-deps chromium
deactivate

# 创建 systemd 服务
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

echo "✅ Podcast Generator Backend 配置完成"

# ============================================
# 第四步：配置 Nginx 反向代理
# ============================================
echo "[4/7] 配置 Nginx 反向代理..."

# 先用 HTTP 配置（SSL 证书获取后会自动修改）
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

    # Soul TalkBuddy API（/soul 路径）
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

echo "✅ Nginx 配置完成"

# ============================================
# 第五步：配置防火墙
# ============================================
echo "[5/7] 配置防火墙..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "✅ 防火墙配置完成"

# ============================================
# 第六步：获取 SSL 证书
# ============================================
echo "[6/7] 获取 SSL 证书..."
echo "⚠️  请确保 DNS 已将 api.lin-ore-o.blog 指向 49.232.53.21"
echo "    按 Enter 继续获取证书，或 Ctrl+C 跳过..."
read -r

sudo certbot --nginx -d api.lin-ore-o.blog --non-interactive --agree-tos --email your-email@example.com || {
    echo "⚠️  SSL 证书获取失败，请手动运行: sudo certbot --nginx -d api.lin-ore-o.blog"
}

echo "✅ SSL 证书配置完成"

# ============================================
# 第七步：启动所有服务
# ============================================
echo "[7/7] 启动所有服务..."
sudo systemctl daemon-reload
sudo systemctl enable soul-backend
sudo systemctl enable kpodcast
sudo systemctl start soul-backend
sudo systemctl start kpodcast
sudo systemctl restart nginx

echo ""
echo "=========================================="
echo "  🎉 部署完成！"
echo "=========================================="
echo ""
echo "服务状态:"
echo "  Soul TalkBuddy:     sudo systemctl status soul-backend"
echo "  Podcast Generator:  sudo systemctl status kpodcast"
echo "  Nginx:              sudo systemctl status nginx"
echo ""
echo "查看日志:"
echo "  Soul TalkBuddy:     sudo journalctl -u soul-backend -f"
echo "  Podcast Generator:  sudo journalctl -u kpodcast -f"
echo ""
echo "API 地址:"
echo "  Soul TalkBuddy:     https://api.lin-ore-o.blog/soul/docs"
echo "  Podcast Generator:  https://api.lin-ore-o.blog/docs"
echo ""
echo "前端地址:"
echo "  主页:               https://www.lin-ore-o.blog/"
echo "  Soul TalkBuddy:     https://www.lin-ore-o.blog/soul-talkbuddy"
echo "  Podcast Generator:  https://www.lin-ore-o.blog/podcast"
echo ""
