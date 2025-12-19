const path = require('path');
const fs = require('fs');
const { vocabularyDb } = require('./db');
const Textbook = require('../models/Textbook');
const Lesson = require('../models/Lesson');
const LessonVerb = require('../models/LessonVerb');

// 从JSON文件加载教材数据
function loadTextbookData(filename) {
  const filePath = path.join(__dirname, '../src/textbookWord', filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`教材文件不存在: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

// 初始化课程数据
async function initSampleCourseData() {
  try {
    console.log('\n📚 初始化课程数据...');
    
    // 检查是否已有教材数据
    const existingBooks = Textbook.getAll();
    if (existingBooks && existingBooks.length > 0) {
      console.log('   ⚠ 课程数据已存在，跳过初始化');
      return;
    }
    
    // 从JSON文件加载教材数据
    const textbookData = loadTextbookData('textbook1.json');
    
    // 创建教材
    const textbook = Textbook.create(
      textbookData.textbook.name,
      textbookData.textbook.description,
      null,
      textbookData.textbook.orderIndex
    );
    
    console.log(`   ✓ 创建教材：${textbookData.textbook.name}`);
    
    let totalVerbs = 0;
    
    // 为每一课创建课程并添加单词
    for (const lessonData of textbookData.lessons) {
      const lesson = Lesson.create(
        textbook.lastInsertRowid,
        lessonData.title,
        lessonData.number,
        lessonData.description,
        lessonData.grammarPoints || '现在时、陈述式',
        JSON.stringify(lessonData.moods || ['indicativo']),
        JSON.stringify(lessonData.tenses || ['presente']),
        JSON.stringify(lessonData.conjugationTypes || ['ar', 'er', 'ir'])
      );
      
      // 获取该课所有单词的ID
      const verbIds = [];
      for (const infinitive of lessonData.verbs) {
        const verb = vocabularyDb.prepare('SELECT id FROM verbs WHERE infinitive = ?').get(infinitive);
        if (verb) {
          verbIds.push(verb.id);
        } else {
          console.log(`   ⚠ 警告：未找到动词 "${infinitive}"`);
        }
      }
      
      if (verbIds.length > 0) {
        LessonVerb.addBatch(lesson.lastInsertRowid, verbIds);
        totalVerbs += verbIds.length;
        console.log(`   ✓ ${lessonData.title}：添加了 ${verbIds.length} 个单词`);
      }
    }
    
    console.log(`\n   ✓ 创建了 ${textbookData.lessons.length} 个课程`);
    console.log(`   ✓ 总计添加了 ${totalVerbs} 个单词`);
    console.log('\x1b[32m   ✓ 课程数据初始化完成\x1b[0m');
  } catch (error) {
    console.error('\x1b[31m   ✗ 课程数据初始化失败:\x1b[0m', error.message);
    console.error(error.stack);
  }
}

module.exports = {
  initSampleCourseData
};
