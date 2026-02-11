# 数据库迁移说明

## 自动迁移系统

本项目使用**自动迁移系统**，在每次服务器启动时自动检查并执行必要的数据库迁移。

### 工作原理

1. **服务器启动时自动执行**
   - 在 `server/index.js` 中，`initDatabase()` 之后会自动调用 `runMigrations()`
   - 迁移管理器会按顺序检查所有注册的迁移脚本

2. **智能检查**
   - 每个迁移脚本会自动检查是否已经执行过
   - 如果数据库已包含相应的字段/表，则跳过该迁移
   - 避免重复迁移和数据冲突

3. **双重保障**
   - `ensureColumn` 函数（db.js）：在数据库初始化时确保列存在
   - 迁移脚本（migrations.js）：提供更灵活的迁移逻辑和详细日志

### 添加新迁移

1. **创建迁移脚本**
   在 `server/database/` 目录下创建新的迁移脚本，例如 `add_new_feature.js`

2. **编写迁移逻辑**
   ```javascript
   const Database = require('better-sqlite3')
   const path = require('path')

   function migrate() {
     console.log('   • 检查迁移: 新功能描述...')
     
     const dbPath = path.join(__dirname, '../data/user_data.db')
     const db = new Database(dbPath)
     
     // 检查是否需要迁移
     const tableInfo = db.prepare("PRAGMA table_info(table_name)").all()
     const fieldExists = tableInfo.some(col => col.name === 'new_field')
     
     if (fieldExists) {
       console.log('     ℹ️  已存在，跳过')
       db.close()
       return
     }
     
     // 执行迁移
     db.exec(`ALTER TABLE table_name ADD COLUMN new_field TEXT`)
     console.log('     ✓ 迁移完成')
     db.close()
   }

   module.exports = migrate
   ```

3. **注册迁移**
   在 `server/database/migrations.js` 中添加：
   ```javascript
   const migrations = [
     { name: '添加排行榜参与设置', script: './add_participate_in_leaderboard.js' },
     { name: '新功能描述', script: './add_new_feature.js' }  // 新增这行
   ]
   ```

## 排行榜参与设置功能

本次更新添加了"是否参与排行榜"功能，允许用户选择是否在排行榜中显示。

### 数据库变更

在 `users` 表中添加了新字段：
- `participate_in_leaderboard` (INTEGER, 默认值: 1)
  - 1 = 参与排行榜（默认）
  - 0 = 不参与排行榜

### 自动迁移

数据库迁移会在服务器启动时**自动执行**：

1. **通过迁移管理器**
   ```javascript
   // server/database/migrations.js 会自动调用
   // server/database/add_participate_in_leaderboard.js
   ```

2. **通过 ensureColumn 函数**
   ```javascript
   // server/database/db.js
   ensureColumn(userDb, 'users', 'participate_in_leaderboard', 'participate_in_leaderboard INTEGER DEFAULT 1')
   ```

迁移脚本会：
1. 检查字段是否已存在
2. 如果不存在，自动添加该字段
3. 自动为所有现有用户设置默认值 1（参与排行榜）
4. 提供详细的执行日志

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
sqlite3 /app/data/user_data.db
.schema users
# 应该能看到 participate_in_leaderboard 字段
```

### 注意事项

- 数据库字段使用 INTEGER 类型存储布尔值（1/0）
- 前端接收到的是数字类型，需要转换为布尔值
- 默认值为 1，确保现有用户体验不受影响
