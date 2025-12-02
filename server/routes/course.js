const express = require('express');
const router = express.Router();
const Textbook = require('../models/Textbook');
const Lesson = require('../models/Lesson');
const LessonVerb = require('../models/LessonVerb');
const { authMiddleware } = require('../middleware/auth');

// 获取所有教材
router.get('/textbooks', authMiddleware, (req, res) => {
  try {
    const textbooks = Textbook.getAll();
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

// 获取教材的课程列表
router.get('/textbooks/:id/lessons', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const lessons = Lesson.getByTextbookId(id);
    res.json({
      success: true,
      lessons
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
