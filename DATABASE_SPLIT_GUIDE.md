# 数据库拆分说明文档

## 概述

系统已从单一数据库拆分为三个独立的数据库，提高了数据管理的灵活性和安全性。

## 数据库文件

### 1. 用户数据库 (`user_data.db`)
**位置**: `server/user_data.db`
**用途**: 存储所有用户相关数据

**包含的表**:
- `users` - 用户账户信息
- `practice_records` - 练习记录
- `check_ins` - 打卡记录
- `user_progress` - 用户学习进度
- `favorite_verbs` - 收藏单词
- `wrong_verbs` - 错题单词
- `private_questions` - 用户私人题库
- `user_question_records` - 用户答题记录

### 2. 词库数据库 (`vocabulary.db`)
**位置**: `server/vocabulary.db`
**用途**: 存储西班牙语词汇和变位数据

**包含的表**:
- `verbs` - 动词表
- `conjugations` - 动词变位表

### 3. 题库数据库 (`questions.db`)
**位置**: `server/questions.db`
**用途**: 存储AI生成的公共题库

**包含的表**:
- `public_questions` - 公共题库（填空题和例句填空）

## 数据库访问

### 在代码中导入

```javascript
// 导入特定数据库
const { userDb } = require('../database/db')        // 用户数据库
const { vocabularyDb } = require('../database/db')  // 词库数据库
const { questionDb } = require('../database/db')    // 题库数据库

// 或同时导入多个
const { userDb, vocabularyDb, questionDb } = require('../database/db')
```

### 模型层使用情况

| 模型文件 | 使用的数据库 | 说明 |
|---------|------------|------|
| `User.js` | `userDb` | 用户账户管理 |
| `PracticeRecord.js` | `userDb` | 练习记录管理 |
| `CheckIn.js` | `userDb` | 打卡记录管理 |
| `FavoriteVerb.js` | `userDb` | 收藏单词管理 |
| `WrongVerb.js` | `userDb` | 错题单词管理 |
| `Verb.js` | `vocabularyDb` | 动词词汇管理 |
| `Conjugation.js` | `vocabularyDb` | 动词变位管理 |
| `Question.js` | `userDb` + `vocabularyDb` + `questionDb` | 题库管理（跨库访问） |

### Question.js 跨库访问说明

`Question` 模型需要访问三个数据库：

1. **题库数据库 (`questionDb`)**:
   - 添加/查询/删除公共题目
   - 更新题目置信度

2. **用户数据库 (`userDb`)**:
   - 添加/查询/删除私人题目
   - 记录用户答题情况

3. **词库数据库 (`vocabularyDb`)**:
   - 获取题目关联的动词信息
   - 用于丰富题目数据

**示例**:
```javascript
// 从公共题库获取题目（需要关联动词信息）
static getRandomFromPublic(filters = {}) {
  // 1. 从题库数据库获取题目
  const questions = questionDb.prepare('SELECT * FROM public_questions...').all()
  
  // 2. 从词库数据库获取动词信息
  const verbs = vocabularyDb.prepare('SELECT * FROM verbs WHERE id IN (...)').all()
  
  // 3. 合并数据
  questions.forEach(q => {
    q.infinitive = verb.infinitive
    q.meaning = verb.meaning
  })
  
  return questions
}
```

## 优势

### 1. **独立访问**
- 每个数据库可以独立打开、备份、恢复
- 使用 DB Browser 时不会相互锁定

### 2. **安全隔离**
- 用户数据与公共数据分离
- 可以为不同数据库设置不同的访问权限

### 3. **便于维护**
- 词库数据可以单独更新和分发
- 公共题库可以在不影响用户数据的情况下清理
- 用户数据可以单独备份

### 4. **性能优化**
- 减少单个数据库文件的大小
- 降低锁竞争
- 提高并发查询性能

### 5. **灵活部署**
- 词库数据库可以只读方式分发
- 题库可以集中管理和同步
- 用户数据可以本地存储

## 使用 DB Browser 访问

现在您可以同时打开三个数据库而不会冲突：

### 方法 1: 停止服务器后访问
```powershell
# 停止服务器
Ctrl+C

# 打开 DB Browser 选择任一数据库
user_data.db    # 查看用户数据
vocabulary.db   # 查看词库
questions.db    # 查看题库
```

### 方法 2: 只读模式访问
DB Browser → File → Open Database (Read Only) → 选择数据库文件

### 方法 3: 分别访问不同库
- **词库数据库** (`vocabulary.db`): 可以在服务器运行时以只读方式访问（很少修改）
- **题库数据库** (`questions.db`): 需要停止服务器后访问（有写入操作）
- **用户数据库** (`user_data.db`): 需要停止服务器后访问（频繁写入）

## 数据迁移

如果您有旧的 `database.db` 文件，数据会自动保留。系统会创建新的三个数据库，旧数据库文件可以手动删除或保留作为备份。

### 迁移步骤（如需要）:

```sql
-- 1. 从旧数据库导出词库数据
-- 在 DB Browser 中打开 database.db
-- 导出 verbs 和 conjugations 表

-- 2. 导入到 vocabulary.db

-- 3. 导出用户相关表
-- 导出 users, practice_records, check_ins 等表

-- 4. 导入到 user_data.db

-- 5. 导出公共题库
-- 导出 public_questions 表

-- 6. 导入到 questions.db
```

## 定时清理任务

定时任务会自动清理 30 天以上的公共题目：

1. 从 `questions.db` 删除旧题目
2. 从 `user_data.db` 删除相关的答题记录

这两个操作是协调进行的，确保数据一致性。

## 备份建议

### 开发环境
```powershell
# 备份所有数据库
Copy-Item server/*.db backup/$(Get-Date -Format 'yyyy-MM-dd')/
```

### 生产环境
- **每日备份**: `user_data.db`（用户数据频繁变化）
- **每周备份**: `questions.db`（题库定期清理）
- **每月备份**: `vocabulary.db`（词库很少变化）

## 注意事项

1. **跨库关联**
   - 三个数据库之间通过 verb_id 等字段关联
   - 不使用 SQLite 的 FOREIGN KEY 跨库约束
   - 应用层保证数据一致性

2. **事务处理**
   - 跨库操作不能使用单一事务
   - 需要在应用层实现补偿机制

3. **查询性能**
   - 跨库查询需要分步进行
   - Question.js 中已优化，先查询再关联

4. **并发访问**
   - 每个数据库独立锁定
   - 减少了锁竞争，提高并发性能

## 总结

数据库拆分后的架构更加清晰、灵活、易于维护。现在您可以：

✅ 使用 DB Browser 独立访问三个数据库  
✅ 单独备份和恢复不同类型的数据  
✅ 在不影响用户数据的情况下更新词库  
✅ 灵活管理题库的生命周期  
✅ 提高系统的可维护性和可扩展性  

所有现有功能保持不变，仅底层存储结构优化！
