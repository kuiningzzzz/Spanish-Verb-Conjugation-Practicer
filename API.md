# API 接口文档

## 基础信息

**基础URL**: 请在 `utils/base_url.js` 中配置

所有需要认证的接口都需要在请求头中携带 token：
```
Authorization: Bearer <token>
```

## 错误处理

所有接口在出错时返回统一的错误格式：

```json
{
  "error": "错误信息描述"
}
```

常见HTTP状态码：
- `200`: 成功
- `400`: 请求参数错误
- `401`: 未授权（未登录或token过期）
- `404`: 资源不存在
- `500`: 服务器内部错误

---

## 用户相关接口

### 1. 发送注册验证码

**接口**: `POST /user/send-verification-code`

**请求体**:
```json
{
  "email": "test@example.com"
}
```

**响应**:
```json
{
  "success": true,
  "message": "验证码已发送"
}
```

### 2. 发送登录验证码

**接口**: `POST /user/send-login-code`

**请求体**:
```json
{
  "email": "test@example.com"
}
```

**响应**:
```json
{
  "success": true,
  "message": "验证码已发送"
}
```

### 3. 用户注册

**接口**: `POST /user/register`

**请求体**:
```json
{
  "username": "testuser",
  "password": "password123",
  "email": "test@example.com",
  "verificationCode": "123456",
  "school": "某某大学",
  "enrollmentYear": 2024,
  "userType": "student"
}
```

**响应**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "school": "某某大学",
    "enrollmentYear": 2024,
    "userType": "student"
  }
}
```

### 4. 用户名密码登录

**接口**: `POST /user/login`

**请求体**:
```json
{
  "username": "testuser",
  "password": "password123"
}
```

**响应**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com"
  }
}
```

### 5. 邮箱验证码登录

**接口**: `POST /user/login/email-code`

**请求体**:
```json
{
  "email": "test@example.com",
  "code": "123456"
}
```

**响应**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com"
  }
}
```

### 6. 获取用户信息

**接口**: `GET /user/info`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "school": "某某大学",
    "enrollmentYear": 2024,
    "userType": "student",
    "avatar": "https://example.com/avatar.jpg"
  }
}
```

### 7. 检查用户名是否可用

**接口**: `POST /user/check-username`

**请求体**:
```json
{
  "username": "testuser"
}
```

**响应**:
```json
{
  "success": true,
  "available": true
}
```

### 8. 更新用户资料

**接口**: `PUT /user/profile`

**需要认证**: 是

**请求体**:
```json
{
  "email": "newemail@example.com",
  "school": "新学校",
  "enrollmentYear": 2023
}
```

**响应**:
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "newemail@example.com",
    "school": "新学校",
    "enrollmentYear": 2023
  }
}
```

### 9. 上传头像

**接口**: `POST /user/avatar`

**需要认证**: 是

**请求体**:
```json
{
  "avatar": "base64_encoded_image_data"
}
```

**响应**:
```json
{
  "success": true,
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

---

## 动词相关接口

### 10. 获取动词列表

**接口**: `GET /verb/list`

**需要认证**: 是

**查询参数**:
- `lessonNumber` (可选): 课程编号
- `textbookVolume` (可选): 教材册数
- `conjugationType` (可选): 变位类型 (1/2/3)
- `page` (可选): 页码
- `limit` (可选): 每页数量

**响应**:
```json
{
  "success": true,
  "verbs": [
    {
      "id": 1,
      "infinitive": "hablar",
      "meaning": "说话",
      "conjugation_type": 1,
      "is_irregular": 0
    }
  ]
}
```

### 11. 获取动词详情

**接口**: `GET /verb/:id`

**需要认证**: 是

**路径参数**:
- `id`: 动词ID

**响应**:
```json
{
  "success": true,
  "verb": {
    "id": 1,
    "infinitive": "hablar",
    "meaning": "说话",
    "conjugation_type": 1,
    "is_irregular": 0
  },
  "conjugations": [
    {
      "tense": "现在时",
      "mood": "陈述式",
      "person": "yo",
      "conjugated_form": "hablo"
    }
  ]
}
```

### 12. 搜索动词

**接口**: `GET /verb/search/:keyword`

**需要认证**: 是

**路径参数**:
- `keyword`: 搜索关键词（西语或中文）

**响应**:
```json
{
  "success": true,
  "verbs": [
    {
      "id": 1,
      "infinitive": "hablar",
      "meaning": "说话",
      "conjugation_type": 1
    }
  ]
}
```

---

## 练习相关接口

### 13. 生成练习题（批量）

**接口**: `POST /exercise/generate`

**需要认证**: 是

**请求体**:
```json
{
  "exerciseType": "choice",
  "count": 10,
  "lessonNumber": 1,
  "textbookVolume": 1,
  "tenses": ["现在时", "简单过去时"],
  "verbIds": [1, 2, 3]
}
```

**参数说明**:
- `exerciseType`: 题型 ("choice" | "fill" | "conjugate" | "sentence")
- `count`: 题目数量 (1-30)
- `lessonNumber` (可选): 限定课程
- `textbookVolume` (可选): 限定教材册数
- `tenses` (可选): 指定时态数组
- `verbIds` (可选): 指定动词ID数组

**响应**:
```json
{
  "success": true,
  "exercises": [
    {
      "verbId": 1,
      "infinitive": "hablar",
      "meaning": "说话",
      "tense": "现在时",
      "mood": "陈述式",
      "person": "yo",
      "correctAnswer": "hablo",
      "exerciseType": "choice",
      "options": ["hablo", "hablas", "habla", "hablamos"]
    }
  ]
}
```

### 14. 生成单个练习题

**接口**: `POST /exercise/generate-one`

**需要认证**: 是

**请求体**:
```json
{
  "exerciseType": "choice",
  "lessonNumber": 1,
  "textbookVolume": 1
}
```

**响应**: 同上，但只返回一道题目

### 15. 批量生成练习题（优化版）

**接口**: `POST /exercise/generate-batch`

**需要认证**: 是

**请求体**:
```json
{
  "exerciseType": "choice",
  "count": 20,
  "verbIds": [1, 2, 3, 4, 5]
}
```

**响应**: 同练习题生成接口

### 16. AI生成单个练习题

**接口**: `POST /exercise/generate-single-ai`

**需要认证**: 是

**请求体**:
```json
{
  "verbId": 1,
  "exerciseType": "sentence",
  "difficulty": "medium"
}
```

**响应**:
```json
{
  "success": true,
  "exercise": {
    "verbId": 1,
    "infinitive": "hablar",
    "question": "我每天和朋友______。",
    "correctAnswer": "hablo",
    "exerciseType": "sentence"
  }
}
```

### 17. 提交答案

**接口**: `POST /exercise/submit`

**需要认证**: 是

**请求体**:
```json
{
  "verbId": 1,
  "exerciseType": "choice",
  "answer": "hablo",
  "correctAnswer": "hablo",
  "tense": "现在时",
  "mood": "陈述式",
  "person": "yo"
}
```

**响应**:
```json
{
  "success": true,
  "isCorrect": true,
  "correctAnswer": "hablo"
}
```

---

## 学习记录相关接口

### 18. 获取练习记录

**接口**: `GET /record/list`

**需要认证**: 是

**查询参数**:
- `page` (可选): 页码
- `limit` (可选): 每页数量
- `verbId` (可选): 筛选特定动词
- `startDate` (可选): 开始日期
- `endDate` (可选): 结束日期

**响应**:
```json
{
  "success": true,
  "records": [
    {
      "id": 1,
      "verb_id": 1,
      "infinitive": "hablar",
      "meaning": "说话",
      "exercise_type": "choice",
      "is_correct": 1,
      "answer": "hablo",
      "tense": "现在时",
      "created_at": "2024-01-01 12:00:00"
    }
  ],
  "total": 100
}
```

### 19. 获取学习统计

**接口**: `GET /record/statistics`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "statistics": {
    "total": {
      "total_exercises": 100,
      "correct_exercises": 85,
      "practiced_verbs": 20,
      "practice_days": 15
    },
    "today": {
      "total_exercises": 10,
      "correct_exercises": 8
    },
    "masteredVerbsCount": 5,
    "masteredVerbs": [
      {
        "id": 1,
        "infinitive": "hablar",
        "meaning": "说话",
        "mastery_level": 5,
        "practice_count": 12,
        "correct_count": 11
      }
    ]
  }
}
```

---

## 打卡相关接口

### 20. 每日打卡

**接口**: `POST /checkin`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "message": "打卡成功",
  "streakDays": 7
}
```

或（今天已打卡）:
```json
{
  "success": true,
  "message": "今天已经打卡过了",
  "alreadyCheckedIn": true
}
```

### 21. 获取打卡历史

**接口**: `GET /checkin/history`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "history": [
    {
      "id": 1,
      "check_in_date": "2024-01-01",
      "exercise_count": 10,
      "correct_count": 8,
      "created_at": "2024-01-01 08:00:00"
    }
  ],
  "streakDays": 7,
  "hasCheckedInToday": true
}
```

### 22. 获取用户排名

**接口**: `GET /checkin/rank`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "rank": 15,
  "totalUsers": 1000,
  "streakDays": 7
}
```

---

## 排行榜接口

### 23. 获取排行榜

**接口**: `GET /leaderboard/:type`

**需要认证**: 是

**路径参数**:
- `type`: 排行榜类型 ("week" | "month" | "all")

**查询参数**:
- `limit` (可选): 返回数量，默认50

**响应**:
```json
{
  "success": true,
  "type": "week",
  "leaderboard": [
    {
      "id": 1,
      "username": "topuser",
      "school": "某某大学",
      "check_in_days": 7,
      "total_exercises": 150,
      "total_correct": 135,
      "rank": 1
    }
  ]
}
```

---

## 单词本相关接口

### 24. 获取单词本统计

**接口**: `GET /vocabulary/stats`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "stats": {
    "favoriteCount": 25,
    "wrongCount": 10,
    "masteredCount": 50
  }
}
```

### 25. 添加收藏

**接口**: `POST /vocabulary/favorite/add`

**需要认证**: 是

**请求体**:
```json
{
  "verbId": 1
}
```

**响应**:
```json
{
  "success": true,
  "message": "收藏成功"
}
```

### 26. 取消收藏

**接口**: `POST /vocabulary/favorite/remove`

**需要认证**: 是

**请求体**:
```json
{
  "verbId": 1
}
```

**响应**:
```json
{
  "success": true,
  "message": "已取消收藏"
}
```

### 27. 检查是否已收藏

**接口**: `GET /vocabulary/favorite/check/:verbId`

**需要认证**: 是

**路径参数**:
- `verbId`: 动词ID

**响应**:
```json
{
  "success": true,
  "isFavorite": true
}
```

### 28. 获取收藏列表

**接口**: `GET /vocabulary/favorite/list`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "favorites": [
    {
      "id": 1,
      "verb_id": 1,
      "infinitive": "hablar",
      "meaning": "说话",
      "conjugation_type": 1,
      "created_at": "2024-01-01 12:00:00"
    }
  ]
}
```

### 29. 添加错题

**接口**: `POST /vocabulary/wrong/add`

**需要认证**: 是

**请求体**:
```json
{
  "verbId": 1,
  "tense": "现在时",
  "mood": "陈述式",
  "person": "yo",
  "wrongAnswer": "habla",
  "correctAnswer": "hablo"
}
```

**响应**:
```json
{
  "success": true,
  "message": "已添加到错题本"
}
```

### 30. 移除错题

**接口**: `POST /vocabulary/wrong/remove`

**需要认证**: 是

**请求体**:
```json
{
  "verbId": 1
}
```

**响应**:
```json
{
  "success": true,
  "message": "已从错题本移除"
}
```

### 31. 获取错题列表

**接口**: `GET /vocabulary/wrong/list`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "wrongVerbs": [
    {
      "id": 1,
      "verb_id": 1,
      "infinitive": "hablar",
      "meaning": "说话",
      "tense": "现在时",
      "mood": "陈述式",
      "person": "yo",
      "wrong_answer": "habla",
      "correct_answer": "hablo",
      "wrong_count": 3,
      "created_at": "2024-01-01 12:00:00"
    }
  ]
}
```

---

## 题库相关接口

### 32. 收藏题目

**接口**: `POST /question/favorite`

**需要认证**: 是

**请求体**:
```json
{
  "questionId": 1
}
```

**响应**:
```json
{
  "success": true,
  "message": "收藏成功"
}
```

### 33. 取消收藏题目

**接口**: `POST /question/unfavorite`

**需要认证**: 是

**请求体**:
```json
{
  "questionId": 1
}
```

**响应**:
```json
{
  "success": true,
  "message": "已取消收藏"
}
```

### 34. 获取我的题目

**接口**: `GET /question/my-questions`

**需要认证**: 是

**查询参数**:
- `type` (可选): 题目类型 ("created" | "favorite" | "wrong")
- `page` (可选): 页码
- `limit` (可选): 每页数量

**响应**:
```json
{
  "success": true,
  "questions": [
    {
      "id": 1,
      "verb_id": 1,
      "infinitive": "hablar",
      "question_type": "choice",
      "difficulty": "medium",
      "created_at": "2024-01-01 12:00:00"
    }
  ]
}
```

### 35. 获取题目统计

**接口**: `GET /question/stats`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "stats": {
    "totalQuestions": 100,
    "favoriteQuestions": 15,
    "wrongQuestions": 8,
    "createdQuestions": 5
  }
}
```

### 36. 题目评分

**接口**: `POST /question/rate`

**需要认证**: 是

**请求体**:
```json
{
  "questionId": 1,
  "rating": 5,
  "comment": "很好的题目"
}
```

**响应**:
```json
{
  "success": true,
  "message": "评分成功"
}
```

---

## 课程相关接口

### 37. 获取教材列表

**接口**: `GET /course/textbooks`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "textbooks": [
    {
      "id": 1,
      "name": "现代西班牙语第一册",
      "code": "MSE1",
      "description": "基础教材",
      "is_active": true
    }
  ]
}
```

### 38. 获取可用教材列表

**接口**: `GET /course/textbooks/available`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "textbooks": [
    {
      "id": 1,
      "name": "现代西班牙语第一册",
      "code": "MSE1",
      "is_added": false
    }
  ]
}
```

### 39. 添加教材

**接口**: `POST /course/textbooks/:textbookId/add`

**需要认证**: 是

**路径参数**:
- `textbookId`: 教材ID

**响应**:
```json
{
  "success": true,
  "message": "教材添加成功"
}
```

### 40. 移除教材

**接口**: `DELETE /course/textbooks/:textbookId`

**需要认证**: 是

**路径参数**:
- `textbookId`: 教材ID

**响应**:
```json
{
  "success": true,
  "message": "教材移除成功"
}
```

### 41. 获取教材的课程列表

**接口**: `GET /course/textbooks/:bookId/lessons`

**需要认证**: 是

**路径参数**:
- `bookId`: 教材ID

**响应**:
```json
{
  "success": true,
  "lessons": [
    {
      "id": 1,
      "textbook_id": 1,
      "lesson_number": 1,
      "title": "第一课",
      "description": "基础问候",
      "verb_count": 10,
      "is_completed": false,
      "is_review_completed": false
    }
  ]
}
```

### 42. 获取课程词汇

**接口**: `GET /course/lessons/:lessonId/vocabulary`

**需要认证**: 是

**路径参数**:
- `lessonId`: 课程ID

**响应**:
```json
{
  "success": true,
  "vocabulary": [
    {
      "id": 1,
      "infinitive": "hablar",
      "meaning": "说话",
      "conjugation_type": 1
    }
  ]
}
```

### 43. 获取滚动复习词汇

**接口**: `GET /course/lessons/:lessonId/rolling-review`

**需要认证**: 是

**路径参数**:
- `lessonId`: 课程ID

**查询参数**:
- `lessonNumber`: 课程编号

**响应**:
```json
{
  "success": true,
  "vocabulary": [
    {
      "id": 1,
      "infinitive": "hablar",
      "meaning": "说话",
      "source_lesson": 1
    }
  ]
}
```

### 44. 获取课程详情

**接口**: `GET /course/lessons/:lessonId`

**需要认证**: 是

**路径参数**:
- `lessonId`: 课程ID

**响应**:
```json
{
  "success": true,
  "lesson": {
    "id": 1,
    "lesson_number": 1,
    "title": "第一课",
    "description": "基础问候",
    "verb_count": 10,
    "is_completed": false
  }
}
```

### 45. 标记课程完成

**接口**: `POST /course/lessons/:lessonId/complete`

**需要认证**: 是

**路径参数**:
- `lessonId`: 课程ID

**请求体**:
```json
{
  "type": "study"
}
```

**参数说明**:
- `type`: 完成类型 ("study" | "review")

**响应**:
```json
{
  "success": true,
  "message": "课程已标记为完成"
}
```

### 46. 重置课程进度

**接口**: `DELETE /course/lessons/:lessonId/progress`

**需要认证**: 是

**路径参数**:
- `lessonId`: 课程ID

**响应**:
```json
{
  "success": true,
  "message": "进度已重置"
}
```

### 47. 创建教材

**接口**: `POST /course/textbooks`

**需要认证**: 是

**请求体**:
```json
{
  "name": "现代西班牙语第一册",
  "code": "MSE1",
  "description": "基础教材"
}
```

**响应**:
```json
{
  "success": true,
  "textbook": {
    "id": 1,
    "name": "现代西班牙语第一册",
    "code": "MSE1"
  }
}
```

### 48. 创建课程

**接口**: `POST /course/lessons`

**需要认证**: 是

**请求体**:
```json
{
  "textbookId": 1,
  "lessonNumber": 1,
  "title": "第一课",
  "description": "基础问候"
}
```

**响应**:
```json
{
  "success": true,
  "lesson": {
    "id": 1,
    "textbook_id": 1,
    "lesson_number": 1,
    "title": "第一课"
  }
}
```

### 49. 添加动词到课程

**接口**: `POST /course/lessons/:lessonId/verbs`

**需要认证**: 是

**路径参数**:
- `lessonId`: 课程ID

**请求体**:
```json
{
  "verbIds": [1, 2, 3, 4, 5]
}
```

**响应**:
```json
{
  "success": true,
  "message": "动词已添加到课程"
}
```

---

## 用户反馈相关接口

### 50. 提交反馈

**接口**: `POST /feedback/submit`

**需要认证**: 是

**请求体**:
```json
{
  "type": "bug",
  "content": "发现了一个bug",
  "contact": "user@example.com"
}
```

**参数说明**:
- `type`: 反馈类型 ("bug" | "feature" | "other")
- `content`: 反馈内容
- `contact` (可选): 联系方式

**响应**:
```json
{
  "success": true,
  "message": "反馈提交成功"
}
```

### 51. 获取反馈历史

**接口**: `GET /feedback/history`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "feedbacks": [
    {
      "id": 1,
      "type": "bug",
      "content": "发现了一个bug",
      "status": "pending",
      "created_at": "2024-01-01 12:00:00"
    }
  ]
}
```

### 52. 获取反馈统计

**接口**: `GET /feedback/statistics`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "stats": {
    "total": 10,
    "pending": 3,
    "resolved": 7,
    "byType": {
      "bug": 5,
      "feature": 3,
      "other": 2
    }
  }
}
```

---

## 题目反馈相关接口

### 53. 提交题目反馈

**接口**: `POST /question-feedback/submit`

**需要认证**: 是

**请求体**:
```json
{
  "questionId": 1,
  "type": "error",
  "content": "答案有误",
  "details": {
    "wrongAnswer": "habla",
    "suggestedAnswer": "hablo"
  }
}
```

**参数说明**:
- `type`: 反馈类型 ("error" | "unclear" | "other")
- `content`: 反馈内容
- `details` (可选): 详细信息

**响应**:
```json
{
  "success": true,
  "message": "反馈提交成功"
}
```

### 54. 获取题目反馈历史

**接口**: `GET /question-feedback/history`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "feedbacks": [
    {
      "id": 1,
      "question_id": 1,
      "type": "error",
      "content": "答案有误",
      "status": "pending",
      "created_at": "2024-01-01 12:00:00"
    }
  ]
}
```

### 55. 获取题目反馈统计

**接口**: `GET /question-feedback/statistics`

**需要认证**: 是

**响应**:
```json
{
  "success": true,
  "stats": {
    "total": 5,
    "pending": 2,
    "resolved": 3,
    "byType": {
      "error": 3,
      "unclear": 1,
      "other": 1
    }
  }
}
```

---

## 版本更新接口

### 56. 检查应用版本

**接口**: `GET /version/check`

**需要认证**: 否

**查询参数**:
- `versionCode`: 当前应用版本号（必需）

**向后兼容性**:
- 客户端版本号 < 1000：返回旧版本兼容格式（简化格式）
- 客户端版本号 >= 1000：返回新版本完整格式

**响应（旧版本客户端，versionCode < 1000）**:
```json
{
  "versionCode": 1485,
  "versionName": "1.0.1",
  "releaseNotes": "修复首个版本的关键问题，提升用户体验和系统稳定性\n\n新增功能：\n• 添加版本更新日志展示页面\n• 支持查看历史版本更新记录\n...",
  "packageFileName": "app-release-1.0.1.apk",
  "downloadUrl": "http://localhost:3000/api/version/download",
  "forceUpdate": false
}
```

**响应（新版本客户端，versionCode >= 1000）**:
```json
{
  "isLatest": false,
  "updateRequired": true,
  "latestVersion": {
    "versionCode": 1485,
    "versionName": "1.0.1",
    "releaseDate": "2025-12-20",
    "description": "修复首个版本的关键问题，提升用户体验和系统稳定性",
    "releaseNotes": "【版本描述】\n修复首个版本的关键问题...\n\n【新增功能】\n• 添加版本更新日志展示页面\n...",
    "newFeatures": [
      "添加版本更新日志展示页面",
      "支持查看历史版本更新记录",
      "新增版本信息API接口"
    ],
    "improvements": [
      "优化版本检查逻辑，提升响应速度",
      "改进更新日志界面设计，信息展示更清晰"
    ],
    "bugFixes": [
      "修复版本检查接口返回数据格式问题",
      "修复更新页面UI显示异常"
    ],
    "packageFileName": "app-release-1.0.1.apk",
    "packageUrl": "http://localhost:3000/api/version/download",
    "packageSize": 12345678,
    "packageAvailable": true,
    "forceUpdate": false
  }
}
```

或（已是最新版本）:
```json
{
  "isLatest": true,
  "updateRequired": false,
  "latestVersion": {
    "versionCode": 1484,
    "versionName": "1.0.0",
    ...
  }
}
```

**错误响应**:
```json
{
  "error": "缺少 versionCode 参数"
}
```

### 57. 获取所有版本信息

**接口**: `GET /version/all`

**需要认证**: 否

**描述**: 获取所有历史版本的完整信息，用于版本更新日志页面展示

**响应**:
```json
{
  "versions": [
    {
      "versionCode": 1485,
      "versionName": "1.0.1",
      "releaseDate": "2025-12-20",
      "description": "修复首个版本的关键问题，提升用户体验和系统稳定性",
      "newFeatures": [
        "添加版本更新日志展示页面",
        "支持查看历史版本更新记录",
        "新增版本信息API接口"
      ],
      "improvements": [
        "优化版本检查逻辑，提升响应速度",
        "改进更新日志界面设计，信息展示更清晰",
        "增强版本信息结构化展示"
      ],
      "bugFixes": [
        "修复版本检查接口返回数据格式问题",
        "修复更新页面UI显示异常",
        "修复版本比较逻辑错误"
      ]
    },
    {
      "versionCode": 1484,
      "versionName": "1.0.0",
      "releaseDate": "2025-12-19",
      "description": "西班牙语动词变位练习应用首次正式发布",
      "newFeatures": [
        "动词变位练习功能，支持多种时态和人称",
        "课程系统，结构化学习路径",
        "词汇表功能，管理个人学习词汇"
      ],
      "improvements": [
        "优雅的界面设计，提升用户体验",
        "流畅的动画效果"
      ],
      "bugFixes": [
        "修复首次发布前的测试问题"
      ]
    }
  ],
  "latestVersion": {
    "versionCode": 1485,
    "versionName": "1.0.1",
    ...
  }
}
```

**空响应（无版本信息）**:
```json
{
  "versions": []
}
```

### 58. 下载最新版本安装包

**接口**: `GET /version/download`

**需要认证**: 否

**描述**: 下载最新版本的APK安装包

**响应**: 
- 成功时返回APK文件流（Content-Type: application/vnd.android.package-archive）
- 失败时返回JSON错误信息

**错误响应**:
```json
{
  "error": "安装包不存在，请联系管理员"
}
```

**响应头**:
```
Content-Type: application/vnd.android.package-archive
Content-Disposition: attachment; filename="app-release-1.0.1.apk"
Content-Length: 12345678
```

---

## 数据模型说明

### 用户类型 (userType)

- `student`: 学生用户
- `public`: 社会用户
- `admin`: 管理员

### 变位类型 (conjugation_type)

- `1`: 第一变位（-ar结尾）
- `2`: 第二变位（-er结尾）
- `3`: 第三变位（-ir结尾）

### 练习类型 (exerciseType)

- `choice`: 选择题
- `fill`: 填空题
- `conjugate`: 变位练习
- `sentence`: 句子补充

### 时态 (tense)

- `现在时`: Presente
- `简单过去时`: Pretérito
- `将来时`: Futuro
- `未完成过去时`: Imperfecto
- `条件式`: Condicional
- 等...

### 语式 (mood)

- `陈述式`: Indicativo
- `虚拟式`: Subjuntivo
- `命令式`: Imperativo

### 人称 (person)

- `yo`: 我
- `tú`: 你
- `él/ella/usted`: 他/她/您
- `nosotros/nosotras`: 我们
- `vosotros/vosotras`: 你们
- `ellos/ellas/ustedes`: 他们/她们/诸位

### 掌握度级别 (mastery_level)

- `1`: 入门（刚开始练习）
- `2`: 初步掌握（正确率≥60%）
- `3`: 基本掌握（正确率≥70%且练习≥5次）
- `4`: 熟练掌握（正确率≥80%且练习≥8次）
- `5`: 完全掌握（正确率≥90%且练习≥10次）

### 反馈类型

**用户反馈**:
- `bug`: 错误报告
- `feature`: 功能建议
- `other`: 其他

**题目反馈**:
- `error`: 题目错误
- `unclear`: 题目不清晰
- `other`: 其他

### 反馈状态

- `pending`: 待处理
- `processing`: 处理中
- `resolved`: 已解决
- `rejected`: 已拒绝

---

## 测试建议

### 使用 Postman 测试

1. 创建一个新的Collection
2. 设置环境变量 `baseUrl` 为你的API地址
3. 先调用登录接口获取token
4. 在Collection中设置全局变量 `token`
5. 在需要认证的接口Header中使用 `Bearer {{token}}`

### 使用 cURL 测试

```bash
# 登录获取token
curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'

# 使用token访问需要认证的接口
curl -X GET http://localhost:3000/api/user/info \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 配置说明

API地址配置位于 `utils/base_url.js` 文件中。请根据实际情况修改：

```javascript
// 开发环境
export const BASE_URL = 'http://localhost:3000/api'

// 生产环境
// export const BASE_URL = 'https://your-domain.com/api'
```

---

## 认证说明

### Token获取

通过以下接口可以获取token：
- 用户名密码登录
- 邮箱验证码登录
- 用户注册

### Token使用

在所有需要认证的接口请求头中添加：
```
Authorization: Bearer <your_token>
```

### Token过期

Token默认有效期为30天。过期后需要重新登录获取新token。

当接收到401状态码时，客户端会自动：
1. 清除本地存储的token和用户信息
2. 跳转到登录页面
