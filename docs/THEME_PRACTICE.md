# 专项练习功能说明

## 🎯 功能概述

专项练习功能允许用户根据学习需求，自定义选择**时态**、**变位类型**和**不规则动词**进行针对性练习，实现个性化学习路径。

## 📋 功能特性

### 1. 时态选择

用户可以自由选择一个或多个时态进行专项练习：

| 时态 | 西班牙语 | 说明 |
|------|---------|------|
| 现在时 | Presente | 陈述式现在时 |
| 简单过去时 | Pretérito Perfecto Simple | 陈述式简单过去时 |
| 将来时 | Futuro Simple | 陈述式将来时 |
| 过去未完成时 | Pretérito Imperfecto | 陈述式过去未完成时（可扩展） |
| 条件式 | Condicional Simple | 条件式（可扩展） |

**使用场景：**
- 🎓 **初学者**：只选择"现在时"集中练习
- 📚 **进阶学习**：选择"现在时 + 简单过去时"对比练习
- 🏆 **强化训练**：选择"简单过去时 + 过去未完成时"区分练习
- 💪 **全面复习**：全选所有时态综合练习

### 2. 变位类型选择

西班牙语动词分为三种规则变位，用户可选择练习重点：

| 变位类型 | 动词结尾 | 代表动词 | 特点 |
|---------|---------|---------|------|
| 第一变位 | -ar | hablar (说话) | 最常见，规则性最强 |
| 第二变位 | -er | comer (吃) | 数量较少，相对规则 |
| 第三变位 | -ir | vivir (生活) | 与第二变位相似 |

**使用场景：**
- 📖 **分类学习**：只选"第一变位"掌握最基础的规则
- 🔄 **对比练习**：选择"第二变位 + 第三变位"区分相似变位
- 🎯 **薄弱突破**：针对性练习掌握较差的变位类型
- ✅ **全面掌握**：全选进行综合练习

### 3. 不规则动词选项

不规则动词是西班牙语学习的难点，用户可选择是否包含：

- ✅ **包含不规则动词**：综合练习，贴近真实场景
- ❌ **仅规则动词**：先掌握规则，循序渐进

**常见不规则动词：**
- ser (是) - 完全不规则
- estar (在) - 部分不规则
- ir (去) - 完全不规则
- tener (有) - 部分不规则
- hacer (做) - 部分不规则

## 🎨 界面设计

### 专项练习设置面板

```
┌─────────────────────────────────────┐
│  🎯 专项练习                        │
│  ─────────────────────────────────  │
│                                     │
│  时态选择                           │
│  ┌──────┐ ┌──────┐ ┌──────┐       │
│  │☑现在时│ │☑过去时│ │☑将来时│       │
│  └──────┘ └──────┘ └──────┘       │
│  ┌──────────┐ ┌──────┐            │
│  │☐过去未完成│ │☐条件式│            │
│  └──────────┘ └──────┘            │
│                                     │
│  变位类型                           │
│  ┌────────────┐ ┌────────────┐    │
│  │☑第一变位(-ar)│ │☑第二变位(-er)│    │
│  └────────────┘ └────────────┘    │
│  ┌────────────┐                   │
│  │☑第三变位(-ir)│                   │
│  └────────────┘                   │
│                                     │
│  动词规则性                         │
│  ┌───────────────┐                │
│  │☑包含不规则动词  │                │
│  └───────────────┘                │
│                                     │
│  快速设置： [全选] [清除]          │
└─────────────────────────────────────┘
```

### 样式特点

- 🎨 **渐变背景**：淡橙到淡粉的柔和渐变 (#fff9f0 → #fff5fb)
- 🎯 **目标图标**：使用 🎯 强调专项练习概念
- ☑️ **复选框样式**：选中时橙色高亮，未选中灰色边框
- ⚡ **快速操作**：一键全选/清除，提高设置效率
- 📱 **响应式布局**：自动换行，适配不同屏幕尺寸

## 🔧 技术实现

### 前端实现

#### 数据结构

```javascript
data() {
  return {
    // 时态选项
    tenseOptions: [
      { value: 'presente', label: '现在时' },
      { value: 'preterito', label: '简单过去时' },
      { value: 'futuro', label: '将来时' },
      { value: 'imperfecto', label: '过去未完成时' },
      { value: 'condicional', label: '条件式' }
    ],
    selectedTenses: ['presente', 'preterito', 'futuro'], // 默认选择
    
    // 变位类型选项
    conjugationTypes: [
      { value: 'ar', label: '第一变位 (-ar)' },
      { value: 'er', label: '第二变位 (-er)' },
      { value: 'ir', label: '第三变位 (-ir)' }
    ],
    selectedConjugationTypes: ['ar', 'er', 'ir'], // 默认全选
    
    // 不规则动词选项
    includeIrregular: true
  }
}
```

#### 核心方法

```javascript
// 切换时态选择
toggleTense(tense) {
  const index = this.selectedTenses.indexOf(tense)
  if (index > -1) {
    this.selectedTenses.splice(index, 1)
  } else {
    this.selectedTenses.push(tense)
  }
}

// 切换变位类型
toggleConjugationType(type) {
  const index = this.selectedConjugationTypes.indexOf(type)
  if (index > -1) {
    this.selectedConjugationTypes.splice(index, 1)
  } else {
    this.selectedConjugationTypes.push(type)
  }
}

// 快速全选
selectAllThemes() {
  this.selectedTenses = this.tenseOptions.map(t => t.value)
  this.selectedConjugationTypes = this.conjugationTypes.map(c => c.value)
  this.includeIrregular = true
}

// 快速清除
clearAllThemes() {
  this.selectedTenses = []
  this.selectedConjugationTypes = []
  this.includeIrregular = false
}
```

#### 参数传递

```javascript
async startPractice() {
  // 验证是否至少选择了一个选项
  if (this.selectedTenses.length === 0) {
    showToast('请至少选择一个时态', 'none')
    return
  }
  
  if (this.selectedConjugationTypes.length === 0) {
    showToast('请至少选择一个变位类型', 'none')
    return
  }
  
  // 调用 API 并传递专项练习参数
  const res = await api.getOneExercise({
    exerciseType: this.exerciseType,
    useAI: this.useAI,
    tenses: this.selectedTenses,              // 时态数组
    conjugationTypes: this.selectedConjugationTypes,  // 变位类型数组
    includeIrregular: this.includeIrregular   // 是否包含不规则
  })
}
```

### 后端实现

#### API 接口

**路由：** `POST /api/exercise/generate-one`

**请求参数：**

```json
{
  "exerciseType": "choice",
  "useAI": true,
  "tenses": ["presente", "preterito", "futuro"],
  "conjugationTypes": ["ar", "er"],
  "includeIrregular": true
}
```

**响应示例：**

```json
{
  "success": true,
  "exercise": {
    "verbId": 1,
    "infinitive": "hablar",
    "meaning": "说话",
    "tense": "现在时",
    "mood": "陈述式",
    "person": "yo",
    "correctAnswer": "hablo",
    "exerciseType": "choice",
    "conjugationType": "第一变位",
    "isIrregular": false,
    "options": ["hablo", "hablas", "habla", "hablamos"]
  },
  "aiEnhanced": true
}
```

#### 核心逻辑

```javascript
// 1. 时态映射
const tenseMap = {
  'presente': '现在时',
  'preterito': '简单过去时',
  'futuro': '将来时',
  'imperfecto': '过去未完成时',
  'condicional': '条件式'
}

// 2. 根据选择的时态筛选变位
if (tenses && tenses.length > 0) {
  const selectedTenseNames = tenses.map(t => tenseMap[t]).filter(Boolean)
  filteredConjugations = conjugations.filter(c => 
    selectedTenseNames.includes(c.tense)
  )
}

// 3. 在 Verb 模型中按条件筛选动词
static getRandom(count = 1, filters = {}) {
  let query = 'SELECT * FROM verbs WHERE 1=1'
  const params = []
  
  // 按变位类型筛选
  if (filters.conjugationTypes && filters.conjugationTypes.length > 0) {
    const typeMap = {
      'ar': '第一变位',
      'er': '第二变位',
      'ir': '第三变位'
    }
    const types = filters.conjugationTypes.map(t => typeMap[t]).filter(Boolean)
    const placeholders = types.map(() => '?').join(',')
    query += ` AND conjugation_type IN (${placeholders})`
    params.push(...types)
  }
  
  // 是否只要规则动词
  if (filters.onlyRegular === true) {
    query += ' AND is_irregular = 0'
  }
  
  query += ' ORDER BY RANDOM() LIMIT ?'
  params.push(count)
  
  return db.prepare(query).all(...params)
}
```

## 📊 使用场景示例

### 场景 1：初学者 - 现在时基础练习

**设置：**
- ✅ 时态：仅选择"现在时"
- ✅ 变位类型：仅选择"第一变位 (-ar)"
- ❌ 不规则动词：不包含

**效果：**
- 只练习 hablar, estudiar 等 -ar 动词的现在时规则变位
- 难度最低，适合入门

### 场景 2：进阶学习 - 时态对比

**设置：**
- ✅ 时态：选择"现在时 + 简单过去时"
- ✅ 变位类型：全选
- ✅ 不规则动词：包含

**效果：**
- 同一个动词在不同时态的对比
- 帮助理解时态差异

### 场景 3：专项突破 - 第二、三变位

**设置：**
- ✅ 时态：全选
- ✅ 变位类型：仅选择"第二变位 + 第三变位"
- ✅ 不规则动词：包含

**效果：**
- 针对性练习 -er 和 -ir 动词
- 突破薄弱环节

### 场景 4：不规则动词专练

**设置：**
- ✅ 时态：全选
- ✅ 变位类型：全选
- ✅ 不规则动词：包含（且可在数据库中手动筛选只要不规则动词）

**效果：**
- 集中攻克不规则动词难点
- 适合考前冲刺

## 🎯 优势分析

### 与传统模式对比

| 特性 | 传统随机模式 | 专项练习模式 |
|------|------------|------------|
| 针对性 | ⭐⭐ 随机 | ⭐⭐⭐⭐⭐ 精准 |
| 学习效率 | ⭐⭐⭐ 中等 | ⭐⭐⭐⭐⭐ 高效 |
| 个性化 | ⭐ 无 | ⭐⭐⭐⭐⭐ 完全定制 |
| 难度控制 | ⭐⭐ 不可控 | ⭐⭐⭐⭐⭐ 自主控制 |
| 适用场景 | 综合复习 | 薄弱突破、专项提升 |

### 学习路径建议

```
初学阶段 (Level 1-2)
└─ 现在时 + 第一变位 + 仅规则动词
   ↓
基础巩固 (Level 3-4)
└─ 现在时 + 过去时 + 第一变位 + 包含部分不规则
   ↓
进阶提升 (Level 5-6)
└─ 三个时态 + 全部变位 + 包含不规则
   ↓
强化训练 (Level 7-8)
└─ 全部时态 + 全部变位 + 重点不规则动词
   ↓
考前冲刺 (Level 9-10)
└─ 混合练习 + AI 智能出题 + 全部选项
```

## 🚀 未来扩展

### 计划中的功能

1. **智能推荐**
   - 根据用户历史练习数据，AI 推荐薄弱时态和变位类型
   - 自动生成个性化练习计划

2. **更多时态**
   - 现在完成时 (Pretérito Perfecto Compuesto)
   - 过去完成时 (Pretérito Pluscuamperfecto)
   - 虚拟式现在时 (Presente de Subjuntivo)
   - 虚拟式过去时 (Imperfecto de Subjuntivo)
   - 命令式 (Imperativo)

3. **人称选择**
   - 单独练习某个人称（如 yo, tú）
   - 重点突破易混淆人称

4. **难度分级**
   - 根据动词频率和不规则程度自动分级
   - 用户选择难度等级（简单/中等/困难）

5. **主题词汇**
   - 按场景分类（日常生活、旅游、商务等）
   - 按主题练习相关动词

## 📝 使用提示

### 最佳实践

1. **循序渐进**：从单一时态、单一变位开始，逐步增加难度
2. **对比学习**：选择相似时态或变位类型进行对比练习
3. **薄弱突破**：查看统计数据，针对性选择掌握较差的类型
4. **定期全面复习**：每周进行一次全选综合练习

### 常见问题

**Q1: 为什么清除所有选项后无法开始练习？**
- A: 系统要求至少选择一个时态和一个变位类型，这是为了确保能够生成有效题目。

**Q2: 如何只练习不规则动词？**
- A: 目前需要包含不规则动词。未来版本会添加"仅不规则动词"选项。

**Q3: 专项练习会影响统计数据吗？**
- A: 不会。所有练习记录都会正常统计，且会标记练习的时态和变位类型。

**Q4: AI 出题在专项练习中如何工作？**
- A: AI 会根据你选择的时态和变位类型，生成符合条件的高质量题目，确保题目针对性更强。

## 🎓 教学应用

### 教师使用场景

1. **课堂练习**
   - 根据当天教学内容设置专项练习
   - 学生同步练习，实时反馈

2. **作业布置**
   - 指定时态和变位类型作为作业要求
   - 学生在家完成定向练习

3. **测验评估**
   - 设置综合选项进行阶段性测试
   - 分析学生薄弱环节

### 自学者使用场景

1. **教材配套**
   - 根据教材进度选择对应时态
   - 同步巩固课堂知识

2. **考试备考**
   - 针对考试大纲选择重点内容
   - 集中突破难点

3. **日常维持**
   - 每天 10 分钟专项练习
   - 保持语言敏感度

---

**专项练习功能让学习更有针对性，让进步更加明显！** 🎯✨
