# 教材单词数据文件

此目录用于存储各教材的课程和单词数据，采用JSON格式。

## 文件命名规范

- `textbook1.json` - 现代西班牙语第一册
- `textbook2.json` - 现代西班牙语第二册
- 依此类推...

## JSON文件格式

```json
{
  "textbook": {
    "name": "教材名称",
    "description": "教材描述",
    "orderIndex": 1
  },
  "lessons": [
    {
      "number": 1,
      "title": "第一课",
      "description": "课程描述",
      "grammarPoints": "语法点说明",
      "tenses": ["presente", "preterito"],
      "conjugationTypes": ["ar", "er", "ir"],
      "verbs": [
        "动词1",
        "动词2",
        "动词3"
      ]
    }
  ]
}
```

## 字段说明

### textbook 对象
- `name` (string, 必填) - 教材名称
- `description` (string, 必填) - 教材简介
- `orderIndex` (number, 必填) - 教材排序索引

### lessons 数组中的每个对象
- `number` (number, 必填) - 课程编号
- `title` (string, 必填) - 课程标题
- `description` (string, 必填) - 课程描述
- `grammarPoints` (string, 可选) - 涉及的语法点
- `tenses` (array, 可选) - 涉及的时态，如 `["presente", "preterito", "futuro"]`
- `conjugationTypes` (array, 可选) - 涉及的变位类型，如 `["ar", "er", "ir"]`
- `verbs` (array, 必填) - 本课的动词列表（原型形式）

## 时态参考

常用时态代码：
- `presente` - 现在时
- `preterito` - 简单过去时
- `imperfecto` - 未完成过去时
- `futuro` - 将来时
- `condicional` - 条件式
- `presente_subjuntivo` - 现在虚拟式
- `imperfecto_subjuntivo` - 过去虚拟式

## 添加新教材步骤

1. 在此目录下创建新的JSON文件（如 `textbook2.json`）
2. 按照格式填写教材和课程数据
3. 在 `server/data/initCourseData.js` 中添加加载新教材的代码
4. 运行初始化脚本更新数据库

## 注意事项

- 动词必须使用原型形式（infinitive）
- 自复动词需要加 `-se` 后缀，如 `levantarse`
- 确保动词已存在于 `verbs` 表中，否则会显示警告
- JSON格式必须严格正确（注意逗号、引号等）
