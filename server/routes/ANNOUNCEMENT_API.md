# 公告系统 API 文档

## 概述
公告系统提供了完整的公告管理功能，支持多种公告类型和优先级设置。

## API 端点

### 1. 获取所有激活的公告
获取当前激活且未过期的公告列表。

**端点:** `GET /api/announcement`

**权限:** 无需认证

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "欢迎使用西班牙语动词变位学习软件",
      "content": "感谢您选择我们的应用！...",
      "type": "welcome",
      "priority": "high",
      "publisher": "系统管理员",
      "publishTime": "2026-01-01T10:00:00Z",
      "isActive": true,
      "expiryTime": null
    }
  ]
}
```

### 2. 获取所有公告（包括未激活）
获取所有公告，包括未激活和已过期的。

**端点:** `GET /api/announcement/all`

**权限:** 需要管理员权限

**Headers:**
```
Authorization: Bearer <admin_token>
```

### 3. 根据ID获取公告详情
获取指定ID的公告详细信息。

**端点:** `GET /api/announcement/:id`

**权限:** 无需认证

**参数:**
- `id` (路径参数): 公告ID

### 4. 按类型获取公告
获取指定类型的所有激活公告。

**端点:** `GET /api/announcement/type/:type`

**权限:** 无需认证

**参数:**
- `type` (路径参数): 公告类型
  - `welcome`: 欢迎
  - `feature`: 新功能
  - `maintenance`: 维护通知
  - `tips`: 小贴士
  - `update`: 更新通知
  - `general`: 一般通知

### 5. 创建新公告
创建一条新公告。

**端点:** `POST /api/announcement`

**权限:** 需要管理员权限

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**请求体:**
```json
{
  "title": "公告标题",
  "content": "公告内容",
  "type": "general",
  "priority": "medium",
  "publisher": "发布者名称",
  "publishTime": "2026-02-02T12:00:00Z",
  "isActive": true,
  "expiryTime": null
}
```

**字段说明:**
- `title` (必填): 公告标题
- `content` (必填): 公告内容
- `type` (可选): 公告类型，默认 "general"
- `priority` (可选): 优先级 (high/medium/low)，默认 "medium"
- `publisher` (可选): 发布者，默认为当前管理员用户名
- `publishTime` (可选): 发布时间，默认为当前时间
- `isActive` (可选): 是否激活，默认 true
- `expiryTime` (可选): 过期时间，null表示永不过期

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": 6,
    "title": "公告标题",
    "content": "公告内容",
    ...
  },
  "message": "公告创建成功"
}
```

### 6. 更新公告
更新指定ID的公告信息。

**端点:** `PUT /api/announcement/:id`

**权限:** 需要管理员权限

**Headers:**
```
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**参数:**
- `id` (路径参数): 公告ID

**请求体:**
```json
{
  "title": "更新后的标题",
  "content": "更新后的内容",
  "isActive": false
}
```

### 7. 删除公告
删除指定ID的公告。

**端点:** `DELETE /api/announcement/:id`

**权限:** 需要管理员权限

**Headers:**
```
Authorization: Bearer <admin_token>
```

**参数:**
- `id` (路径参数): 公告ID

**响应示例:**
```json
{
  "success": true,
  "message": "公告删除成功"
}
```

### 8. 切换公告激活状态
快速切换公告的激活/停用状态。

**端点:** `PATCH /api/announcement/:id/toggle`

**权限:** 需要管理员权限

**Headers:**
```
Authorization: Bearer <admin_token>
```

**参数:**
- `id` (路径参数): 公告ID

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "isActive": false,
    ...
  },
  "message": "公告已停用"
}
```

## 数据结构

### 公告对象
```typescript
interface Announcement {
  id: number                  // 公告ID
  title: string              // 标题
  content: string            // 内容
  type: string               // 类型
  priority: 'high' | 'medium' | 'low'  // 优先级
  publisher: string          // 发布者
  publishTime: string        // 发布时间 (ISO 8601)
  isActive: boolean          // 是否激活
  expiryTime: string | null  // 过期时间 (ISO 8601)
}
```

### 公告类型
- `welcome`: 欢迎信息
- `feature`: 新功能介绍
- `maintenance`: 系统维护通知
- `tips`: 学习小贴士
- `update`: 版本更新说明
- `general`: 一般通知

### 优先级
- `high`: 高优先级（红色标识）
- `medium`: 中优先级（橙色标识）
- `low`: 低优先级（绿色标识）

## 前端集成

### 在 utils/api.js 中使用
```javascript
// 获取公告列表
const announcements = await api.getAnnouncements()

// 获取单个公告
const announcement = await api.getAnnouncementById(1)

// 按类型获取公告
const updates = await api.getAnnouncementsByType('update')
```

### 页面路由
公告页面位于: `/pages/announcement/announcement.vue`

从首页访问:
```javascript
uni.navigateTo({
  url: '/pages/announcement/announcement'
})
```

## 数据存储

公告数据存储在 `server/src/announcement.json` 文件中。修改此文件会立即生效，无需重启服务。

## 注意事项

1. **权限管理**: 
   - 普通用户只能查看激活的公告
   - 管理员可以进行增删改查操作

2. **自动过期**: 
   - 系统会自动过滤已过期的公告
   - 过期判断基于 `expiryTime` 字段

3. **优先级排序**: 
   - 高优先级公告显示在前
   - 相同优先级按发布时间倒序

4. **数据持久化**: 
   - 所有修改会立即写入 JSON 文件
   - 建议定期备份 announcement.json

## 管理建议

1. 及时清理过期公告
2. 重要公告使用 high 优先级
3. 为临时通知设置过期时间
4. 定期更新公告内容保持活跃度
