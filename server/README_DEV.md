# 开发环境使用指南

## 本地开发的两种方式

### 方式一：直接运行（推荐用于前端开发）

**后端 API**：
```bash
# 在 server 目录
npm install
node index.js
# 后端运行在 http://localhost:3000
```

**管理前端**：
```bash
# 在 admin-web 目录
npm install
npm run serve
# 前端运行在 http://localhost:8080
# 会自动代理 /admin 请求到 localhost:3000
```

这种方式的优势：
- ✅ 热重载，修改代码立即生效
- ✅ 可以使用 IDE 调试
- ✅ 无需 Docker 重新构建

### 方式二：使用 Docker 开发配置

使用开发配置启动 Docker 服务：

```bash
cd server
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

**访问地址**：
- 后端 API: `http://localhost:3000`
- 管理前端: `http://localhost:3001`
- Nginx 代理: `http://localhost:8080` (用于测试生产环境路由)

**停止服务**：
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

## 生产环境部署

生产环境使用标准配置：

```bash
cd server
docker compose up -d --build
```

**访问地址**：
- `https://conjugamos.top/api` - 用户 API
- `https://conjugamos.top/admin-api` - 管理后端 API
- `https://conjugamos.top/admin/` - 管理前端界面

## 配置说明

### 开发环境 (docker-compose.dev.yml)
- 暴露 3000 端口（后端 API）
- 暴露 3001 端口（管理前端）
- API Base URL 使用 `http://localhost:3000`
- 不使用 HTTPS

### 生产环境 (docker-compose.yml)
- 只暴露 80/443 端口（Nginx）
- API Base URL 使用 `https://conjugamos.top`
- 通过 Nginx 反向代理统一访问
- 启用 HTTPS 和安全头

## 常见问题

### Q: 本地调试时访问 localhost 跳转到域名？
A: 使用开发配置启动，或直接运行 `npm run serve`，不要访问 `localhost/admin`。

### Q: 修改代码后需要重新构建 Docker 吗？
A: 
- **方式一（npm run serve）**：不需要，自动热重载
- **方式二（Docker 开发）**：需要重新构建: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`

### Q: 如何切换回生产配置？
A: 
```bash
# 停止开发容器
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# 启动生产容器
docker compose up -d
```
