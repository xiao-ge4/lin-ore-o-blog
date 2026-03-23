#!/bin/bash
# ============================================
# 新服务器一键部署脚本（49.232.53.21）
# 部署 Soul TalkBuddy Backend (端口 8002)
# 部署 Podcast Generator Backend (端口 8001)
# 配置 Nginx 反向代理 + SSL (api.lin-ore-o.blog)
# ============================================
# 使用方法:
#   1. SSH 登录服务器: ssh ubuntu@49.232.53.21（或 root@49.232.53.21）
#   2. 下载此脚本:
#      curl -O https://raw.githubusercontent.com/xiao-ge4/lin-ore-o-blog/main/deploy/setup_new_server.sh
#   3. 执行: bash setup_new_server.sh
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
echo "[1/9] 更新系统并安装依赖..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip git nginx certbot python3-certbot-nginx
echo "✅ 系统依赖安装完成"

# ============================================
# 第二步：从 GitHub 克隆代码
# ============================================
echo ""
echo "[2/9] 从 GitHub 克隆代码..."
cd ~
if [ -d ~/lin-ore-o-blog ]; then
    echo "    代码目录已存在，拉取最新代码..."
    cd ~/lin-ore-o-blog && git pull
else
    git clone https://github.com/xiao-ge4/lin-ore-o-blog.git
fi
echo "✅ 代码克隆完成"

# ============================================
# 第三步：部署 Soul TalkBuddy Backend
# ============================================
echo ""
echo "[3/9] 部署 Soul TalkBuddy Backend..."

sudo rm -rf /opt/soul-backend
sudo cp -r ~/lin-ore-o-blog/soul-backend-deploy /opt/soul-backend
cd /opt/soul-backend

# 创建虚拟环境并安装依赖
sudo python3 -m venv venv
sudo /opt/soul-backend/venv/bin/pip install --upgrade pip
sudo /opt/soul-backend/venv/bin/pip install -r requirements.txt

echo "✅ Soul TalkBuddy 依赖安装完成"

# ============================================
# 第四步：配置 Soul TalkBuddy 密钥（需手动）
# ============================================
echo ""
echo "=========================================="
echo "  ⚠️  需要手动配置 Soul TalkBuddy 密钥"
echo "=========================================="
echo ""
echo "  请检查 /opt/soul-backend/backend/config/cos_config.ini"
echo "  确认以下配置正确："
echo "    - secret_id     = 你的腾讯云 SecretId"
echo "    - secret_key    = 你的腾讯云 SecretKey"
echo "    - model_api_token = 你的 ModelScope Token"
echo "    - bucket        = soul-1308411753"
echo "    - region        = ap-beijing"
echo ""
echo "  如需编辑: sudo nano /opt/soul-backend/backend/config/cos_config.ini"
echo ""
echo "  按 Enter 继续（如果配置已正确），或 Ctrl+C 中断去编辑..."
read -r

# 测试 Soul Backend 启动
echo "  测试 Soul Backend 启动..."
timeout 5 sudo /opt/soul-backend/venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8002 &>/dev/null &
SOUL_PID=$!
sleep 3
if kill -0 $SOUL_PID 2>/dev/null; then
    echo "✅ Soul Backend 测试启动成功"
    kill $SOUL_PID 2>/dev/null || true
    wait $SOUL_PID 2>/dev/null || true
else
    echo "⚠️  Soul Backend 启动可能有问题，继续部署（稍后检查日志排查）"
fi

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

echo "✅ Soul TalkBuddy Backend 服务配置完成"

# ============================================
# 第五步：部署 Podcast Generator Backend
# ============================================
echo ""
echo "[5/9] 部署 Podcast Generator Backend..."

sudo rm -rf /opt/podcast-backend
sudo cp -r ~/lin-ore-o-blog/podcast-backend-deploy /opt/podcast-backend
cd /opt/podcast-backend

sudo python3 -m venv venv
sudo /opt/podcast-backend/venv/bin/pip install --upgrade pip
sudo /opt/podcast-backend/venv/bin/pip install -r requirements.txt

# 安装 Playwright 浏览器（网页抓取需要）
echo "  安装 Playwright Chromium（可能需要几分钟）..."
sudo /opt/podcast-backend/venv/bin/playwright install chromium
sudo /opt/podcast-backend/venv/bin/playwright install-deps chromium

echo "✅ Podcast Generator 依赖安装完成"

# ============================================
# 第六步：配置 Podcast Generator 密钥（需手动）
# ============================================
echo ""
echo "=========================================="
echo "  ⚠️  需要手动配置 Podcast Generator 密钥"
echo "=========================================="
echo ""

# 如果 config.ini 不存在，从模板复制
if [ ! -f /opt/podcast-backend/config.ini ]; then
    sudo cp /opt/podcast-backend/config.example.ini /opt/podcast-backend/config.ini
    echo "  已从模板创建 config.ini"
fi

echo "  请检查 /opt/podcast-backend/config.ini"
echo "  确认以下配置正确："
echo "    - [bocha] api_key    = 你的博查搜索 API Key"
echo "    - [tencent] secret_id  = 你的腾讯云 SecretId"
echo "    - [tencent] secret_key = 你的腾讯云 SecretKey"
echo ""
echo "  如需编辑: sudo nano /opt/podcast-backend/config.ini"
echo ""
echo "  按 Enter 继续（如果配置已正确），或 Ctrl+C 中断去编辑..."
read -r

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

echo "✅ Podcast Generator Backend 服务配置完成"

# ============================================
# 第七步：配置 Nginx 反向代理
# ============================================
echo ""
echo "[7/9] 配置 Nginx 反向代理..."

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

sudo ln -sf /etc/nginx/sites-available/api-backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "✅ Nginx 配置完成"

# ============================================
# 第八步：启动所有服务 + 防火墙
# ============================================
echo ""
echo "[8/9] 启动所有服务并配置防火墙..."

sudo systemctl daemon-reload
sudo systemctl enable soul-backend
sudo systemctl enable kpodcast
sudo systemctl start soul-backend
sudo systemctl start kpodcast
sudo systemctl restart nginx

# 配置防火墙
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable

echo "✅ 服务已启动，防火墙已配置"
echo ""
echo "⚠️  提醒：还需在腾讯云控制台的安全组中开放 80 和 443 端口！"
echo ""

# ============================================
# 第九步：获取 SSL 证书
# ============================================
echo "[9/9] 获取 SSL 证书..."
echo ""
echo "  即将为 api.lin-ore-o.blog 获取 Let's Encrypt SSL 证书"
echo "  需要输入你的邮箱地址并同意条款"
echo ""
echo "  按 Enter 继续，或 Ctrl+C 跳过（可稍后手动运行: sudo certbot --nginx -d api.lin-ore-o.blog）..."
read -r

sudo certbot --nginx -d api.lin-ore-o.blog || {
    echo ""
    echo "⚠️  SSL 证书获取失败！可能原因："
    echo "    1. DNS 未生效（api.lin-ore-o.blog 需解析到 49.232.53.21）"
    echo "    2. 腾讯云安全组未开放 80/443 端口"
    echo "    请解决后手动运行: sudo certbot --nginx -d api.lin-ore-o.blog"
}

# 自动续期测试
sudo certbot renew --dry-run 2>/dev/null && echo "✅ SSL 自动续期测试通过" || true

# ============================================
# 完成！
# ============================================
echo ""
echo "=========================================="
echo "  🎉 部署完成！"
echo "=========================================="
echo ""
echo "━━━━━ 服务状态 ━━━━━"
sudo systemctl status soul-backend --no-pager -l 2>/dev/null | head -5
echo ""
sudo systemctl status kpodcast --no-pager -l 2>/dev/null | head -5
echo ""
sudo systemctl status nginx --no-pager -l 2>/dev/null | head -5
echo ""
echo "━━━━━ 常用命令 ━━━━━"
echo "查看日志:"
echo "  sudo journalctl -u soul-backend -f"
echo "  sudo journalctl -u kpodcast -f"
echo ""
echo "重启服务:"
echo "  sudo systemctl restart soul-backend"
echo "  sudo systemctl restart kpodcast"
echo "  sudo systemctl restart nginx"
echo ""
echo "━━━━━ 验证地址 ━━━━━"
echo "  Soul TalkBuddy API:     https://api.lin-ore-o.blog/soul/docs"
echo "  Podcast Generator API:  https://api.lin-ore-o.blog/docs"
echo ""
echo "━━━━━ 前端地址 ━━━━━"
echo "  主页:               https://www.lin-ore-o.blog/"
echo "  Soul TalkBuddy:     https://www.lin-ore-o.blog/soul-talkbuddy"
echo "  Podcast Generator:  https://www.lin-ore-o.blog/podcast"
echo ""
echo "━━━━━ 下一步 ━━━━━"
echo "  1. 在腾讯云控制台安全组开放 80/443 端口（如果还没做）"
echo "  2. 在 Vercel Dashboard 更新环境变量:"
echo "     VITE_SOUL_API_BASE = https://api.lin-ore-o.blog/soul"
echo "     VITE_PODCAST_API_BASE = https://api.lin-ore-o.blog"
echo "  3. 在 Vercel 触发重新部署"
echo ""
