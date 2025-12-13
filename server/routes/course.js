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
        vocabularyCount: Lesson.getVocabularyCount(lesson.id),
        completedCount: progress ? progress.completed_count : 0,
        isCompleted: progress && progress.completed_count >= 1,
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
    
    // 检查课程是否存在
    const lesson = Lesson.getById(id);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        message: '课程不存在'
      });
    }
    
    UserLessonProgress.markCompleted(userId, id);
    const progress = UserLessonProgress.getProgress(userId, id);
    
    res.json({
      success: true,
      message: '已标记完成',
      completedCount: progress.completed_count
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
