const express = require('express');
const router = express.Router();
const Textbook = require('../models/Textbook');
const Lesson = require('../models/Lesson');
const LessonVerb = require('../models/LessonVerb');
const UserTextbook = require('../models/UserTextbook');
const UserLessonProgress = require('../models/UserLessonProgress');
const { authMiddleware } = require('../middleware/auth');

// 获取所有可用的教材（用于添加）
router.get('/textbooks/available', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const allTextbooks = Textbook.getAll();
    
    // 标记哪些教材用户已添加
    const textbooksWithStatus = allTextbooks.map(textbook => ({
      ...textbook,
      isAdded: UserTextbook.hasTextbook(userId, textbook.id)
    }));
    
    res.json({
      success: true,
      textbooks: textbooksWithStatus
    });
  } catch (error) {
    console.error('获取可用教材列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取可用教材列表失败'
    });
  }
});

// 获取用户添加的教材
router.get('/textbooks', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const textbooks = UserTextbook.getUserTextbooks(userId);
    res.json({
      success: true,
      textbooks
    });
  } catch (error) {
    console.error('获取教材列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取教材列表失败'
    });
  }
});

// 添加教材
router.post('/textbooks/:id/add', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    // 检查教材是否存在
    const textbook = Textbook.getById(id);
    if (!textbook) {
      return res.status(404).json({
        success: false,
        message: '教材不存在'
      });
    }
    
    // 检查是否已添加
    if (UserTextbook.hasTextbook(userId, id)) {
      return res.json({
        success: true,
        message: '该教材已在列表中'
      });
    }
    
    UserTextbook.add(userId, id);
    res.json({
      success: true,
      message: '添加成功'
    });
  } catch (error) {
    console.error('添加教材失败:', error);
    res.status(500).json({
      success: false,
      message: '添加教材失败'
    });
  }
});

// 移除教材
router.delete('/textbooks/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    UserTextbook.remove(userId, id);
    res.json({
      success: true,
      message: '移除成功'
    });
  } catch (error) {
    console.error('移除教材失败:', error);
    res.status(500).json({
      success: false,
      message: '移除教材失败'
    });
  }
});

// 获取教材的课程列表
router.get('/textbooks/:id/lessons', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const lessons = Lesson.getByTextbookId(id);
    
    // 为每个课程添加单词数量和用户进度
    const lessonsWithProgress = lessons.map(lesson => {
      const progress = UserLessonProgress.getProgress(userId, lesson.id);
      return {
        ...lesson,
        lessonNumber: lesson.lesson_number, // 添加驼峰命名字段
        vocabularyCount: Lesson.getVocabularyCount(lesson.id),
        completedCount: progress ? progress.completed_count : 0,
        studyCompletedCount: progress ? progress.study_completed_count : 0,
        reviewCompletedCount: progress ? progress.review_completed_count : 0,
        isCompleted: progress && progress.study_completed_count >= 1 && progress.review_completed_count >= 1,
        lastCompletedAt: progress ? progress.last_completed_at : null
      };
    });
    
    res.json({
      success: true,
      lessons: lessonsWithProgress
    });
  } catch (error) {
    console.error('获取课程列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取课程列表失败'
    });
  }
});

// 获取课程的单词列表
router.get('/lessons/:id/vocabulary', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const vocabulary = Lesson.getVocabulary(id);
    res.json({
      success: true,
      vocabulary
    });
  } catch (error) {
    console.error('获取单词列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取单词列表失败'
    });
  }
});

// 获取滚动复习单词列表（从第1课到指定课程）
router.get('/lessons/:id/rolling-review', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { lessonNumber } = req.query;
    
    // 获取当前课程
    const currentLesson = Lesson.getById(id);
    if (!currentLesson) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }
    
    // 获取同一教材的所有课程
    const allLessons = Lesson.getByTextbookId(currentLesson.textbook_id);
    
    // 筛选出lesson_number从1到指定数字的课程
    const targetLessonNumber = parseInt(lessonNumber) || currentLesson.lesson_number;
    const lessonsToReview = allLessons.filter(
      lesson => lesson.lesson_number >= 1 && lesson.lesson_number <= targetLessonNumber
    );
    
    // 获取所有这些课程的单词（去重）
    const vocabularyMap = new Map();
    lessonsToReview.forEach(lesson => {
      const lessonVocab = Lesson.getVocabulary(lesson.id);
      lessonVocab.forEach(word => {
        if (!vocabularyMap.has(word.id)) {
          vocabularyMap.set(word.id, word);
        }
      });
    });
    
    const vocabulary = Array.from(vocabularyMap.values());
    
    // 合并所有课程的语气、时态和变位类型配置
    const moodsSet = new Set();
    const tensesSet = new Set();
    const conjugationTypesSet = new Set();
    
    lessonsToReview.forEach(lesson => {
      // 解析并合并语气
      if (lesson.moods) {
        const moods = JSON.parse(lesson.moods);
        moods.forEach(mood => moodsSet.add(mood));
      }
      
      // 解析并合并时态
      if (lesson.tenses) {
        const tenses = JSON.parse(lesson.tenses);
        tenses.forEach(tense => tensesSet.add(tense));
      }
      
      // 解析并合并变位类型
      if (lesson.conjugation_types) {
        const types = JSON.parse(lesson.conjugation_types);
        types.forEach(type => conjugationTypesSet.add(type));
      }
    });
    
    res.json({
      success: true,
      vocabulary,
      reviewRange: {
        from: 1,
        to: targetLessonNumber,
        totalLessons: lessonsToReview.length,
        totalWords: vocabulary.length
      },
      config: {
        moods: Array.from(moodsSet),
        tenses: Array.from(tensesSet),
        conjugation_types: Array.from(conjugationTypesSet)
      }
    });
  } catch (error) {
    console.error('获取滚动复习单词列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取滚动复习单词列表失败'
    });
  }
});

// 获取课程详情（包括练习配置）
router.get('/lessons/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const lesson = Lesson.getById(id);
    
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }

    // 解析JSON字段
    if (lesson.moods) {
      lesson.moods = JSON.parse(lesson.moods);
    }
    if (lesson.tenses) {
      lesson.tenses = JSON.parse(lesson.tenses);
    }
    if (lesson.conjugation_types) {
      lesson.conjugation_types = JSON.parse(lesson.conjugation_types);
    }

    res.json({
      success: true,
      lesson
    });
  } catch (error) {
    console.error('获取课程详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取课程详情失败'
    });
  }
});

// 标记课程完成
router.post('/lessons/:id/complete', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { type } = req.body; // 'study' 或 'review'
    
    // 检查课程是否存在
    const lesson = Lesson.getById(id);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }
    
    UserLessonProgress.markCompleted(userId, id, type);
    const progress = UserLessonProgress.getProgress(userId, id);
    
    res.json({
      success: true,
      message: '已标记完成',
      completedCount: progress.completed_count,
      studyCompletedCount: progress.study_completed_count,
      reviewCompletedCount: progress.review_completed_count,
      isCompleted: progress.study_completed_count >= 1 && progress.review_completed_count >= 1
    });
  } catch (error) {
    console.error('标记课程完成失败:', error);
    res.status(500).json({
      success: false,
      message: '操作失败'
    });
  }
});

// 重置课程进度
router.delete('/lessons/:id/progress', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    UserLessonProgress.reset(userId, id);
    
    res.json({
      success: true,
      message: '已重置进度'
    });
  } catch (error) {
    console.error('重置课程进度失败:', error);
    res.status(500).json({
      success: false,
      message: '操作失败'
    });
  }
});

// 创建教材（管理员功能，这里暂不需要额外验证）
router.post('/textbooks', authMiddleware, (req, res) => {
  try {
    const { name, description, coverImage, orderIndex } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '教材名称不能为空'
      });
    }

    const result = Textbook.create(name, description, coverImage, orderIndex || 0);
    
    res.json({
      success: true,
      message: '创建成功',
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('创建教材失败:', error);
    res.status(500).json({
      success: false,
      message: '创建教材失败'
    });
  }
});

// 创建课程
router.post('/lessons', authMiddleware, (req, res) => {
  try {
    const { 
      textbookId, 
      title, 
      lessonNumber, 
      description, 
      grammarPoints,
      tenses,
      conjugationTypes 
    } = req.body;
    
    if (!textbookId || !title || !lessonNumber) {
      return res.status(400).json({
        success: false,
        message: '教材ID、课程标题和课程编号不能为空'
      });
    }

    // 将数组转换为JSON字符串存储
    const tensesStr = tenses ? JSON.stringify(tenses) : null;
    const conjugationTypesStr = conjugationTypes ? JSON.stringify(conjugationTypes) : null;

    const result = Lesson.create(
      textbookId, 
      title, 
      lessonNumber, 
      description, 
      grammarPoints,
      tensesStr,
      conjugationTypesStr
    );
    
    res.json({
      success: true,
      message: '创建成功',
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error('创建课程失败:', error);
    res.status(500).json({
      success: false,
      message: '创建课程失败'
    });
  }
});

// 为课程添加单词
router.post('/lessons/:id/verbs', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { verbIds } = req.body;
    
    if (!verbIds || !Array.isArray(verbIds)) {
      return res.status(400).json({
        success: false,
        message: '单词ID列表格式错误'
      });
    }

    LessonVerb.addBatch(id, verbIds);
    
    res.json({
      success: true,
      message: '添加成功'
    });
  } catch (error) {
    console.error('添加单词失败:', error);
    res.status(500).json({
      success: false,
      message: '添加单词失败'
    });
  }
});

module.exports = router;
