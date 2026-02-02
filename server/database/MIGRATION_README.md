# 数据库迁移说明

## 排行榜参与设置功能

本次更新添加了"是否参与排行榜"功能，允许用户选择是否在排行榜中显示。

### 数据库变更

在 `users` 表中添加了新字段：
- `participate_in_leaderboard` (INTEGER, 默认值: 1)
  - 1 = 参与排行榜（默认）
  - 0 = 不参与排行榜

### 自动迁移

数据库迁移会在Docker容器启动时**自动执行**，通过 `ensureColumn` 函数完成：

```javascript
// server/database/db.js
ensureColumn(userDb, 'users', 'participate_in_leaderboard', 'participate_in_leaderboard INTEGER DEFAULT 1')
```

这个函数会：
1. 检查字段是否已存在
2. 如果不存在，自动添加该字段
3. 自动为所有现有用户设置默认值 1（参与排行榜）

### 手动迁移（可选）

如果需要手动运行迁移脚本：

```bash
cd server
node database/add_participate_in_leaderboard.js
```

迁移脚本会：
- 检查字段是否已存在
- 添加字段（如果不存在）
- 为所有现有用户设置默认值
- 提供详细的执行日志

### 向后兼容

- ✅ 现有数据库无需手动干预
- ✅ 所有现有用户默认参与排行榜
- ✅ Docker重启时自动完成迁移
- ✅ 不会影响任何现有功能

### 功能说明

1. **前端设置界面**
   - 路径：pages/profile/settings/settings.vue
   - 新增"参与排行榜"开关
   - 默认开启

2. **后端API**
   - PUT `/user/settings/leaderboard` - 更新排行榜参与设置
   - GET `/leaderboard/:type` - 自动过滤不参与用户

3. **排行榜过滤**
   - 关闭参与后，用户数据将从所有排行榜中隐藏
   - 包括周榜、月榜、总榜

### 测试验证

启动服务后验证：

```bash
# 1. 启动服务
cd server
docker compose up -d --build

# 2. 查看日志确认迁移成功
docker compose logs server

# 3. 进入数据库检查
docker compose exec server sh
sqlite3 /app/data/user.db
.schema users
# 应该能看到 participate_in_leaderboard 字段
```

### 注意事项

- 数据库字段使用 INTEGER 类型存储布尔值（1/0）
- 前端接收到的是数字类型，需要转换为布尔值
- 默认值为 1，确保现有用户体验不受影响
