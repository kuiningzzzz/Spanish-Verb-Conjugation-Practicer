const { vocabularyDb } = require('../database/db');
const Textbook = require('../models/Textbook');
const Lesson = require('../models/Lesson');
const LessonVerb = require('../models/LessonVerb');

// 初始化示例课程数据
async function initSampleCourseData() {
  try {
    console.log('\n📚 初始化课程示例数据...');
    
    // 检查是否已有教材数据
    const existingBooks = Textbook.getAll();
    if (existingBooks && existingBooks.length > 0) {
      console.log('   ⚠ 课程数据已存在，跳过初始化');
      return;
    }
    
    // 创建示例教材
    const textbook1 = Textbook.create(
      '现代西班牙语第一册',
      '适合西班牙语初学者，涵盖基础语法和常用动词',
      null,
      1
    );
    
    const textbook2 = Textbook.create(
      '现代西班牙语第二册',
      '进阶课程，深入学习各种时态和复杂变位',
      null,
      2
    );
    
    console.log('   ✓ 创建了 2 本教材');
    
    // 为第一册创建课程
    const lesson1 = Lesson.create(
      textbook1.lastID,
      '第一课 - 基础动词',
      1,
      '学习西班牙语最基础的动词和现在时变位',
      '现在时、陈述式',
      JSON.stringify(['presente']),
      JSON.stringify(['ar', 'er', 'ir'])
    );
    
    const lesson2 = Lesson.create(
      textbook1.lastID,
      '第二课 - 日常动词',
      2,
      '学习日常生活中常用的动词',
      '现在时、陈述式',
      JSON.stringify(['presente']),
      JSON.stringify(['ar', 'er', 'ir'])
    );
    
    const lesson3 = Lesson.create(
      textbook1.lastID,
      '第三课 - 过去时态',
      3,
      '学习简单过去时的用法',
      '简单过去时、陈述式',
      JSON.stringify(['preterito']),
      JSON.stringify(['ar', 'er', 'ir'])
    );
    
    // 为第二册创建课程
    const lesson4 = Lesson.create(
      textbook2.lastID,
      '第一课 - 将来时',
      1,
      '学习将来时的变位规则',
      '将来时、陈述式',
      JSON.stringify(['futuro']),
      JSON.stringify(['ar', 'er', 'ir'])
    );
    
    console.log('   ✓ 创建了 4 个课程');
    
    // 为第一课添加单词（使用数据库中已有的动词）
    // 获取一些基础动词
    const baseVerbs = vocabularyDb.prepare(`
      SELECT id FROM verbs 
      WHERE infinitive IN ('hablar', 'comer', 'vivir', 'estudiar', 'trabajar')
      LIMIT 5
    `).all();
    
    if (baseVerbs.length > 0) {
      const verbIds = baseVerbs.map(v => v.id);
      LessonVerb.addBatch(lesson1.lastID, verbIds);
      console.log(`   ✓ 为第一课添加了 ${verbIds.length} 个单词`);
    }
    
    // 为第二课添加单词
    const dailyVerbs = vocabularyDb.prepare(`
      SELECT id FROM verbs 
      WHERE infinitive IN ('beber', 'escribir', 'leer', 'aprender', 'comprender')
      LIMIT 5
    `).all();
    
    if (dailyVerbs.length > 0) {
      const verbIds = dailyVerbs.map(v => v.id);
      LessonVerb.addBatch(lesson2.lastID, verbIds);
      console.log(`   ✓ 为第二课添加了 ${verbIds.length} 个单词`);
    }
    
    // 为第三课添加单词
    const pastVerbs = vocabularyDb.prepare(`
      SELECT id FROM verbs 
      WHERE infinitive IN ('cantar', 'bailar', 'cocinar', 'viajar', 'descansar')
      LIMIT 5
    `).all();
    
    if (pastVerbs.length > 0) {
      const verbIds = pastVerbs.map(v => v.id);
      LessonVerb.addBatch(lesson3.lastID, verbIds);
      console.log(`   ✓ 为第三课添加了 ${verbIds.length} 个单词`);
    }
    
    // 为第四课添加单词
    const futureVerbs = vocabularyDb.prepare(`
      SELECT id FROM verbs 
      WHERE infinitive IN ('pensar', 'decidir', 'planear', 'preparar', 'organizar')
      LIMIT 5
    `).all();
    
    if (futureVerbs.length > 0) {
      const verbIds = futureVerbs.map(v => v.id);
      LessonVerb.addBatch(lesson4.lastID, verbIds);
      console.log(`   ✓ 为第四课添加了 ${verbIds.length} 个单词`);
    }
    
    console.log('\x1b[32m   ✓ 课程示例数据初始化完成\x1b[0m');
  } catch (error) {
    console.error('\x1b[31m   ✗ 课程数据初始化失败:\x1b[0m', error.message);
  }
}

module.exports = {
  initSampleCourseData
};
