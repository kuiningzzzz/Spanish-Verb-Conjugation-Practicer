# 西班牙语动词变位学习软件

> 注：示例里默认后端跑在 `http://localhost:3000`。  
> 你们线上目前是 `http://192.144.253.40:3000`（仅作参考）。

---

## 如何启动

### 一、本地直接运行（不使用 Docker）

要求本地具有 **Node.js 22.10.0** 环境。出现环境问题可以参考下面“Docker Compose 运行”。

在仓库根目录执行：

```bash
npm install
cd server
cp .env.example .env
```

编辑 `server/.env` 填好配置后运行：

```bash
npm start
```

看到后端启动日志即可。

本地直接运行会在 `server/` 文件夹中产生三个 `.db` 数据库文件（或使用已有文件）：
- `vocabulary.db` - 词汇数据库
- `user_data.db` - 用户数据库
- `questions.db` - 题目数据库

---

### 二、Docker Compose 运行（推荐）

> 你说你用的是 `docker-compose`（Compose v1），下面所有命令都以 `docker-compose` 为准。  
> **超级重要：请统一从仓库根目录执行命令**，否则会触发“路径解析玄学”和各种挂载报错。

#### 0）进入仓库根目录

```bash
cd /opt/Spanish-Verb-Conjugation-Practicer
```

#### 1）准备 `.env`（用于 docker-compose 变量替换）

`docker-compose` 会自动读取 **当前目录（仓库根）** 下的 `.env` 用于 `${VAR}` 替换。

建议把后端示例环境变量复制到仓库根目录：

```bash
cp server/.env.example .env
```

然后编辑仓库根目录的 `.env`，按需填写（至少建议改 `JWT_SECRET`，以及你们用到的 `EMAIL_*`、`DEEPSEEK_*` 等）。

> ⚠️ 注意：本地直接运行用的是 `server/.env`；Docker Compose 推荐用仓库根目录 `.env`（因为 compose 读它最稳定）。

#### 2）只启动后端（容器）

```bash
docker-compose --project-directory "$(pwd)" -f server/docker-compose.yml up -d --build
```

常用命令：

```bash
# 查看日志
docker-compose --project-directory "$(pwd)" -f server/docker-compose.yml logs -f --tail=200

# 停止并删除容器（不删数据）
docker-compose --project-directory "$(pwd)" -f server/docker-compose.yml down

# 重启（推荐：以后都用这个，而不是 docker start）
docker-compose --project-directory "$(pwd)" -f server/docker-compose.yml restart

# 健康检查
curl http://localhost:3000/api/health
```

---

## Observability / 监控与日志（Prometheus + Grafana + Loki + Promtail）

本项目提供基于 Docker Compose 的可观测性栈：
- Prometheus（指标）
- Grafana（可视化）
- Loki（日志存储）
- Promtail（日志采集）

默认仅绑定到本机 `127.0.0.1`，避免直接暴露公网。

**Grafana 对外端口为宿主机 `3001`（容器内仍是 3000）**，以避免与后端 `3000` 端口冲突。

### 目录结构

```
observability/
  prometheus/prometheus.yml        # Prometheus 抓取配置
  loki/loki-config.yml             # Loki 单机存储配置
  promtail/promtail-config.yml     # Promtail 采集 Docker stdout
  grafana/provisioning/datasources # Grafana 数据源自动配置
docker-compose.observability.yml   # 监控与日志的 Compose 叠加文件（位于仓库根目录）
```

> ✅ `observability/` 必须在 **仓库根目录**。  
> ❌ 不要出现 `server/observability/`。  
> 如果你曾经遇到过 “把目录挂载到文件” 的错误，通常是误生成了 `server/observability/...`，请删除：
>
> ```bash
> sudo rm -rf server/observability
> ```

---

### 启动方式

#### 1）准备 Grafana 管理员密码（写到仓库根目录 `.env`）

Grafana 需要 `GRAFANA_ADMIN_PASSWORD`，否则会启动失败：

```bash
echo "GRAFANA_ADMIN_PASSWORD=请替换为强密码" >> .env
# 可选：覆盖默认管理员账号
echo "GRAFANA_ADMIN_USER=admin" >> .env
```

#### 2）启动后端 + 可观测性（推荐）

**从仓库根目录执行：**

```bash
docker-compose --project-directory "$(pwd)" \
  -f server/docker-compose.yml \
  -f docker-compose.observability.yml \
  up -d --build
```

#### 3）常用管理命令（以后重启就用这些）

```bash
# 查看日志（全部）
docker-compose --project-directory "$(pwd)" \
  -f server/docker-compose.yml \
  -f docker-compose.observability.yml \
  logs -f --tail=200

# 重启（全部）
docker-compose --project-directory "$(pwd)" \
  -f server/docker-compose.yml \
  -f docker-compose.observability.yml \
  restart

# 停止并删除容器（不删数据卷）
docker-compose --project-directory "$(pwd)" \
  -f server/docker-compose.yml \
  -f docker-compose.observability.yml \
  down
```

> ✅ 强烈建议：**不要用 `docker start prometheus ...`** 来“复活”服务。  
> `docker start` 不会重新解析/校验 compose 的挂载与配置，之前踩过的“目录挂到文件”会原地复现。  
> 用 `docker-compose up/restart` 才是正道（有组织有纪律的重启！）。

---

### 组件访问与验证

- Grafana：`http://127.0.0.1:3001`  
  用户名：`${GRAFANA_ADMIN_USER:-admin}`  
  密码：`.env` 中的 `GRAFANA_ADMIN_PASSWORD`

- Prometheus：`http://127.0.0.1:9090`  
  在 **Status -> Targets** 查看 `spanish-verb-api` 目标  
  > 注意：后端若尚未暴露 `/metrics`，该目标会显示 `down`（这是正常的“没接线就没电”）。

- Loki（日志）：在 Grafana -> Explore 选择 **Loki** 数据源  
  示例查询：
  - `{service="spanish-verb-api"}`
  - `{service="spanish-verb-api", level="error"}`
  - `{event="request"} |= "POST /api"`

#### 远程服务器访问（因为端口绑定 127.0.0.1）

如果监控栈跑在远程服务器（例如 `192.144.253.40`），由于端口只监听 `127.0.0.1`，你需要 SSH 端口转发：

```bash
ssh -L 3001:127.0.0.1:3001 -L 9090:127.0.0.1:9090 -L 3100:127.0.0.1:3100 ubuntu@192.144.253.40
```

然后在你本机浏览器打开：
- Grafana：`http://127.0.0.1:3001`
- Prometheus：`http://127.0.0.1:9090`

---

### 常见问题排查

#### 1）“Are you trying to mount a directory onto a file”
典型原因：误生成了 `server/observability/...`，导致 `prometheus.yml` 变成目录。

修复：

```bash
cd /opt/Spanish-Verb-Conjugation-Practicer
sudo rm -rf server/observability
docker-compose --project-directory "$(pwd)" \
  -f server/docker-compose.yml -f docker-compose.observability.yml up -d --build
```

#### 2）容器名冲突（Conflict: container name already in use）
如果 compose 文件写死了 `container_name`，旧容器残留会导致创建失败。

快速处理（只删容器，不删数据卷）：

```bash
docker rm -f prometheus loki promtail grafana spanish-verb-api 2>/dev/null || true
```

然后重新 `up -d`。

#### 3）构建时 npm install 很久
`RUN npm install` 可能需要几分钟（下载/编译依赖）。  
可以用 `docker stats` 看 CPU/网络是否在动，动就说明它在干活，不是在摸鱼。

---

### 可选：为应用补充 metrics & JSON 日志（Node.js 示例）

#### 1）Prometheus 指标 `/metrics`（prom-client）

```js
const express = require('express');
const client = require('prom-client');
const app = express();

client.collectDefaultMetrics();

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

确保后端 `3000` 端口暴露 `/metrics`，即可被 Prometheus 抓取。

#### 2）JSON stdout 日志（pino）

```js
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

logger.info({ service: 'spanish-verb-api', event: 'start' }, 'service started');
```

Promtail 的 JSON 解析应尽量只把 `service/env/level/event` 等低基数字段设为 label，避免把用户 ID 等高基数字段设为 label（会把 Loki 标签炸成烟花）。

---

## 三、前端配置与运行

在 `utils` 目录下复制 example 文件为 `base_url.js`，地址修改为 `后端地址端口/api`，比如：

- 本地：`http://localhost:3000/api`
- 线上：`http://192.144.253.40:3000/api`

前端运行使用 uni-app 开发工具 HBuilderX 自带的运行功能即可，这里不做过多介绍。
