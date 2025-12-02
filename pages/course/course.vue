<template>
  <view class="container">
    <view class="header">
      <text class="title">课程练习</text>
      <text class="subtitle">选择课程进行系统化学习</text>
    </view>

    <view class="textbook-list">
      <view 
        v-for="book in textbooks" 
        :key="book.id" 
        class="textbook-card"
        :class="{ 'active': expandedBookId === book.id }"
      >
        <view class="textbook-header" @click="toggleBook(book.id)">
          <view class="textbook-info">
            <text class="textbook-icon">📚</text>
            <view>
              <text class="textbook-name">{{ book.name }}</text>
              <text class="textbook-desc">{{ book.description }}</text>
            </view>
          </view>
          <text class="expand-icon">{{ expandedBookId === book.id ? '▼' : '▶' }}</text>
        </view>

        <!-- 课程列表 -->
        <view v-if="expandedBookId === book.id" class="lesson-list">
          <view 
            v-for="lesson in book.lessons" 
            :key="lesson.id" 
            class="lesson-item"
          >
            <view class="lesson-header" @click="toggleLesson(lesson.id)">
              <text class="lesson-title">{{ lesson.title }}</text>
              <view class="lesson-actions">
                <button 
                  class="btn-small btn-expand" 
                  @click.stop="toggleLesson(lesson.id)"
                  v-if="lesson.vocabulary && lesson.vocabulary.length > 0"
                >
                  {{ expandedLessonId === lesson.id ? '收起' : '展开' }}
                </button>
                <button 
                  class="btn-small btn-study" 
                  @click.stop="startLessonPractice(lesson)"
                >
                  学习
                </button>
              </view>
            </view>

            <!-- 单词列表 -->
            <view v-if="expandedLessonId === lesson.id" class="vocabulary-list">
              <view class="vocab-header">
                <text class="vocab-title">本课单词 ({{ lesson.vocabulary.length }}个)</text>
              </view>
              <view 
                v-for="(word, index) in lesson.vocabulary" 
                :key="index" 
                class="vocab-item"
              >
                <view class="vocab-word">
                  <text class="vocab-spanish">{{ word.infinitive }}</text>
                  <text class="vocab-chinese">{{ word.chinese }}</text>
                </view>
                <text class="vocab-type">{{ word.type || '动词' }}</text>
              </view>
            </view>
          </view>

          <view v-if="!book.lessons || book.lessons.length === 0" class="empty-lessons">
            <text>该教材暂无课程</text>
          </view>
        </view>
      </view>

      <view v-if="!textbooks || textbooks.length === 0" class="empty-state">
        <text class="empty-icon">📖</text>
        <text class="empty-text">暂无课程</text>
        <text class="empty-hint">敬请期待更多课程内容</text>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast } from '@/utils/common.js'

export default {
  data() {
    return {
      textbooks: [],
      expandedBookId: null,
      expandedLessonId: null
    }
  },
  onLoad() {
    this.loadTextbooks()
  },
  methods: {
    async loadTextbooks() {
      try {
        const res = await api.getTextbooks()
        if (res.success) {
          this.textbooks = res.textbooks
        }
      } catch (error) {
        console.error('加载课程失败:', error)
        showToast('加载课程失败', 'none')
      }
    },
    async toggleBook(bookId) {
      if (this.expandedBookId === bookId) {
        this.expandedBookId = null
        this.expandedLessonId = null
      } else {
        this.expandedBookId = bookId
        this.expandedLessonId = null
        
        // 加载该教材的课程列表
        const book = this.textbooks.find(b => b.id === bookId)
        if (book && (!book.lessons || book.lessons.length === 0)) {
          try {
            const res = await api.getLessonsByBook(bookId)
            if (res.success) {
              book.lessons = res.lessons
              // 强制更新视图
              this.$forceUpdate()
            }
          } catch (error) {
            console.error('加载课程列表失败:', error)
            showToast('加载课程失败', 'none')
          }
        }
      }
    },
    async toggleLesson(lessonId) {
      if (this.expandedLessonId === lessonId) {
        this.expandedLessonId = null
      } else {
        this.expandedLessonId = lessonId
        
        // 加载该课程的单词列表
        const book = this.textbooks.find(b => b.id === this.expandedBookId)
        if (book) {
          const lesson = book.lessons.find(l => l.id === lessonId)
          if (lesson && (!lesson.vocabulary || lesson.vocabulary.length === 0)) {
            try {
              const res = await api.getLessonVocabulary(lessonId)
              if (res.success) {
                lesson.vocabulary = res.vocabulary
                // 强制更新视图
                this.$forceUpdate()
              }
            } catch (error) {
              console.error('加载单词列表失败:', error)
              showToast('加载单词失败', 'none')
            }
          }
        }
      }
    },
    startLessonPractice(lesson) {
      // 跳转到练习页面，传递课程信息
      const params = {
        mode: 'course',
        lessonId: lesson.id,
        lessonTitle: lesson.title
      }
      
      uni.navigateTo({
        url: `/pages/practice/practice?mode=course&lessonId=${lesson.id}&lessonTitle=${encodeURIComponent(lesson.title)}`
      })
    }
  }
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
  text-align: center;
  padding: 40rpx 0 30rpx;
  background: #fff;
}

.title {
  display: block;
  font-size: 44rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.subtitle {
  display: block;
  font-size: 26rpx;
  color: #999;
}

.textbook-list {
  padding: 20rpx;
}

.textbook-card {
  background: #fff;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.textbook-card.active {
  box-shadow: 0 4rpx 20rpx rgba(102, 126, 234, 0.15);
}

.textbook-header {
  padding: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.textbook-info {
  display: flex;
  align-items: center;
  flex: 1;
}

.textbook-icon {
  font-size: 48rpx;
  margin-right: 20rpx;
}

.textbook-name {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 8rpx;
}

.textbook-desc {
  display: block;
  font-size: 24rpx;
  color: #999;
}

.expand-icon {
  font-size: 24rpx;
  color: #999;
  transition: transform 0.3s ease;
}

.lesson-list {
  border-top: 1rpx solid #f0f0f0;
  padding: 0 20rpx 20rpx;
}

.lesson-item {
  margin-top: 20rpx;
  background: #f9f9f9;
  border-radius: 12rpx;
  overflow: hidden;
}

.lesson-header {
  padding: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lesson-title {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  flex: 1;
}

.lesson-actions {
  display: flex;
  gap: 12rpx;
}

.btn-small {
  padding: 8rpx 20rpx;
  font-size: 24rpx;
  border-radius: 20rpx;
  border: none;
  white-space: nowrap;
}

.btn-expand {
  background: #f0f0f0;
  color: #666;
}

.btn-study {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.vocabulary-list {
  background: #fff;
  padding: 20rpx;
  border-top: 1rpx solid #e8e8e8;
}

.vocab-header {
  margin-bottom: 16rpx;
}

.vocab-title {
  font-size: 26rpx;
  color: #666;
  font-weight: 500;
}

.vocab-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.vocab-item:last-child {
  border-bottom: none;
}

.vocab-word {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.vocab-spanish {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  margin-bottom: 4rpx;
}

.vocab-chinese {
  font-size: 24rpx;
  color: #999;
}

.vocab-type {
  font-size: 22rpx;
  color: #667eea;
  background: #f0f2ff;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.empty-lessons {
  padding: 60rpx 0;
  text-align: center;
  color: #999;
  font-size: 26rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 100rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #666;
  margin-bottom: 10rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: #999;
}
</style>
