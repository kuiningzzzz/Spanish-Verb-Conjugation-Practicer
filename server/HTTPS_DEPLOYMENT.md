# HTTPS 部署指南

本指南说明如何启动配置了 SSL 证书的生产环境。

## 架构说明

通过 Nginx 反向代理实现 HTTPS 访问：

```
互联网（HTTPS）
    ↓
Nginx (443端口) ← SSL 终止
    ├→ /api → spanish-verb-api:3000/api (用户API)
    ├→ /admin-api → spanish-verb-api:3000/admin (管理后端API)
    └→ /admin → admin-web:80 (管理前端界面)
```

### 访问地址

- **用户 API**: `https://conjugamos.top/api`
- **管理后端 API**: `https://conjugamos.top/admin-api`
- **管理前端界面**: `https://conjugamos.top/admin`

## 部署步骤

### 1. 确认证书文件

确保以下文件已放置在 `server/certs/` 目录：

```
server/certs/
  ├── conjugamos.top.key            ← 私钥
  └── conjugamos.top_bundle.crt     ← 证书（含证书链）
```

### 2. 配置环境变量

复制并编辑 `.env` 文件：

```bash
cd server
cp .env.example .env
```

**重要配置项**：

```env
# 管理后台配置（必须使用 HTTPS 域名）
ADMIN_API_BASE_URL=https://conjugamos.top
ADMIN_WEB_ORIGIN=https://conjugamos.top

# 安全配置（生产环境必须修改）
JWT_SECRET=请修改为随机字符串
ADMIN_JWT_SECRET=请修改为另一个随机字符串

# 邮箱配置
EMAIL_HOST=smtp.qq.com
EMAIL_PORT=587
EMAIL_USER=your-email@qq.com
EMAIL_PASS=your-email-auth-code

# 初始管理员账号
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=ChangeMe123!
```

### 3. 启动服务

在 `server` 目录下执行：

```bash
# 停止旧服务（如果有）
docker compose down

# 重新构建并启动所有服务
docker compose up -d --build

# 查看日志
docker compose logs -f
```

### 4. 验证部署

#### 检查容器状态

```bash
docker compose ps
```

应该看到以下容器都在运行：
- `spanish-verb-nginx` (Nginx 反向代理)
- `spanish-verb-api` (后端 API)
- `admin-web` (管理前端)

#### 测试 HTTPS 访问

```bash
# 测试健康检查
curl https://conjugamos.top/health

# 测试 API（需要先注册用户）
curl https://conjugamos.top/api/health
```

#### 浏览器访问

- 访问 `https://conjugamos.top/admin` 应该能看到管理后台登录界面
- HTTP 请求 `http://conjugamos.top` 会自动重定向到 HTTPS

### 5. DNS 配置

确保域名已正确解析到服务器 IP：

```bash
# 检查 DNS 解析
nslookup conjugamos.top
```

## 故障排查

### 1. 证书错误

如果浏览器提示证书错误，检查：

```bash
# 进入 Nginx 容器检查证书
docker exec -it spanish-verb-nginx ls -la /etc/nginx/certs/

# 查看 Nginx 错误日志
docker compose logs nginx
```

### 2. 502 Bad Gateway

可能是后端服务未启动，检查：

```bash
# 查看所有容器状态
docker compose ps

# 查看后端日志
docker compose logs spanish-verb-api
docker compose logs admin-web
```

### 3. CORS 错误

确保 `.env` 中的 `ADMIN_API_BASE_URL` 和 `ADMIN_WEB_ORIGIN` 配置正确：

```env
ADMIN_API_BASE_URL=https://conjugamos.top
ADMIN_WEB_ORIGIN=https://conjugamos.top
```

### 4. 管理后台无法连接 API

检查浏览器控制台的网络请求，确认：
- 请求地址是 `https://conjugamos.top/admin-api/*`
- 没有混合内容警告（HTTPS 页面请求 HTTP 资源）

## 维护操作

### 更新证书

证书过期前替换证书文件：

```bash
# 1. 备份旧证书
cp server/certs/conjugamos.top_bundle.crt server/certs/conjugamos.top_bundle.crt.bak

# 2. 替换新证书
cp /path/to/new/certificate.crt server/certs/conjugamos.top_bundle.crt

# 3. 重启 Nginx
docker compose restart nginx
```

### 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 仅查看 Nginx 日志
docker compose logs -f nginx

# 仅查看 API 日志
docker compose logs -f spanish-verb-api
```

### 重启服务

```bash
# 重启所有服务
docker compose restart

# 仅重启特定服务
docker compose restart nginx
docker compose restart spanish-verb-api
```

## 安全建议

1. **定期更新证书**：SSL 证书通常有效期为 1 年，请在过期前更新
2. **定期更换密钥**：定期更换 `JWT_SECRET` 和 `ADMIN_JWT_SECRET`
3. **备份数据**：定期备份 `server/data/` 目录
4. **监控日志**：定期检查访问日志和错误日志
5. **更新依赖**：定期更新 Docker 镜像和依赖包

## 回滚到 HTTP（仅开发环境）

如需回滚到 HTTP 模式：

1. 修改 `docker-compose.yml`，移除 `nginx` 服务
2. 恢复 `spanish-verb-api` 的 `ports: - "3000:3000"`
3. 恢复 `admin-web` 的 `ports: - "3001:80"`
4. 修改 `.env` 中的 URL 为 `http://localhost:3000`
5. 重新构建：`docker compose up -d --build`
