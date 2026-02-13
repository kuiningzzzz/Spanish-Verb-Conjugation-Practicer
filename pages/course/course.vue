<template>
  <view class="container">
    <view class="header">
      <text class="title">课程练习</text>
      <text class="subtitle">选择课程进行系统化学习</text>
    </view>

    <!-- 添加教材按钮 -->
    <view class="add-textbook-section">
      <button class="btn-add-textbook-top" @click="showAddTextbookModal">
        <text class="add-icon">+</text>
        <text>添加教材</text>
      </button>
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
          <view class="header-actions">
            <text class="remove-btn" @click.stop="removeTextbook(book.textbook_id)">移除</text>
            <text class="expand-icon">{{ expandedBookId === book.id ? '▼' : '▶' }}</text>
          </view>
        </view>

        <!-- 课程列表 -->
        <view v-if="expandedBookId === book.id" class="lesson-list">
          <view 
            v-for="lesson in book.lessons" 
            :key="lesson.id" 
            class="lesson-item"
          >
            <view class="lesson-header" @click="toggleLesson(lesson.id)">
              <view class="lesson-title-wrapper">
                <text class="lesson-title">{{ lesson.title }}</text>
                <text v-if="lesson.isCompleted" class="complete-badge complete-all">✓ 已完成</text>
                <view v-else class="progress-badges">
                  <text v-if="lesson.studyCompletedCount > 0" class="progress-badge study">
                    学习✓{{ lesson.studyCompletedCount > 1 ? '×' + lesson.studyCompletedCount : '' }}
                  </text>
                  <text v-if="lesson.reviewCompletedCount > 0" class="progress-badge review">
                    复习✓{{ lesson.reviewCompletedCount > 1 ? '×' + lesson.reviewCompletedCount : '' }}
                  </text>
                </view>
              </view>
              <view class="lesson-actions">
                <button 
                  class="btn-small btn-study" 
                  @click.stop="startLessonPractice(lesson)"
                >
                  {{ lesson.isCompleted ? '再次练习' : '开始练习' }}
                </button>
                <button 
                  class="btn-small btn-review" 
                  :class="{ 'btn-disabled': lesson.lessonNumber <= 1 }"
                  :disabled="lesson.lessonNumber <= 1"
                  @click.stop="startRollingReview(lesson)"
                >
                  滚动复习
                </button>
                <button 
                  class="btn-small btn-expand" 
                  @click.stop="toggleLesson(lesson.id)"
                  v-if="lesson.vocabularyCount > 0"
                >
                  {{ expandedLessonId === lesson.id ? '收起' : '展开' }}
                </button>
              </view>
            </view>

            <!-- 单词列表 -->
            <view v-if="expandedLessonId === lesson.id" class="vocabulary-list">
              <view class="vocab-header">
                <text class="vocab-title">本课单词 ({{ lesson.vocabulary ? lesson.vocabulary.length : lesson.vocabularyCount }}个)</text>
              </view>
              <view 
                v-for="(word, index) in lesson.vocabulary" 
                :key="index" 
                class="vocab-item"
              >
                <view class="vocab-word">
                  <text class="vocab-spanish">{{ word.infinitive }}</text>
                  <text class="vocab-chinese">{{ word.meaning }}</text>
                </view>
                <view class="vocab-actions">
                  <view class="vocab-badges">
                    <text v-if="word.is_reflexive" class="vocab-badge reflexive">Prnl.</text>
                    <text v-if="word.is_irregular" class="vocab-badge irregular">Irreg.</text>
                  </view>
                  <text class="vocab-detail-btn" @click="viewConjugations(word.id)">查看全变位</text>
                </view>
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
        <text class="empty-text">还没有添加教材</text>
        <text class="empty-hint">点击上方按钮添加教材开始学习</text>
      </view>
    </view>

    <!-- 添加教材弹窗 -->
    <view v-if="showModal" class="modal-overlay" @click="closeModal">
      <view class="modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">选择教材</text>
          <text class="modal-close" @click="closeModal">×</text>
        </view>
        <view class="modal-body">
          <view 
            v-for="book in availableTextbooks" 
            :key="book.id" 
            class="textbook-option"
            :class="{ 'added': book.isAdded }"
            @click="toggleTextbook(book)"
          >
            <view class="option-info">
              <text class="option-name">{{ book.name }}</text>
              <text class="option-desc">{{ book.description }}</text>
            </view>
            <text class="option-status">{{ book.isAdded ? '已添加 ✓' : '添加' }}</text>
          </view>
        </view>
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
      availableTextbooks: [],
      expandedBookId: null,
      expandedLessonId: null,
      showModal: false
    }
  },
  onLoad() {
    this.loadTextbooks()
  },
  onShow() {
    // 每次显示时刷新列表
    const previousExpandedBookId = this.expandedBookId
    this.loadTextbooks().then(() => {
      // 如果之前有展开的教材，刷新其课程列表
      if (previousExpandedBookId) {
        this.expandedBookId = previousExpandedBookId
        this.refreshExpandedBookLessons()
      }
    })
  },
  methods: {
    async loadTextbooks() {
      try {
        const res = await api.getTextbooks()
        if (res.success) {
          this.textbooks = res.textbooks
          console.log('教材列表已加载:', this.textbooks)
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
        const book = this.textbooks.find(b => b.textbook_id === bookId)
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
        const book = this.textbooks.find(b => b.textbook_id === this.expandedBookId)
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
    },
    
    // 开始滚动复习（从第1课到本课）
    startRollingReview(lesson) {
      if (lesson.lessonNumber <= 1) return
      uni.navigateTo({
        url: `/pages/practice/practice?mode=rollingReview&lessonId=${lesson.id}&lessonTitle=${encodeURIComponent(lesson.title)}&lessonNumber=${lesson.lessonNumber}`
      })
    },
    
    // 查看动词完整变位
    viewConjugations(verbId) {
      uni.navigateTo({
        url: `/pages/conjugation-detail/conjugation-detail?verbId=${verbId}`
      })
    },
    
    // 刷新已展开教材的课程列表
    async refreshExpandedBookLessons() {
      if (!this.expandedBookId) return
      
      try {
        const res = await api.getLessonsByBook(this.expandedBookId)
        if (res.success) {
          const book = this.textbooks.find(b => b.textbook_id === this.expandedBookId)
          if (book) {
            book.lessons = res.lessons
            this.$forceUpdate()
          } else {
            console.log('未找到展开的教材，expandedBookId:', this.expandedBookId, '教材列表:', this.textbooks)
          }
        }
      } catch (error) {
        console.error('刷新课程列表失败:', error)
      }
    },
    
    async showAddTextbookModal() {
      try {
        const res = await api.getAvailableTextbooks()
        if (res.success) {
          this.availableTextbooks = res.textbooks
          this.showModal = true
        }
      } catch (error) {
        console.error('获取可用教材失败:', error)
        showToast('加载失败', 'none')
      }
    },
    
    // 关闭弹窗
    closeModal() {
      this.showModal = false
    },
    
    // 切换教材（添加/移除）
    async toggleTextbook(book) {
      try {
        if (book.isAdded) {
          const res = await api.removeTextbook(book.id)
          if (res.success) {
            showToast('已移除', 'success')
            book.isAdded = false
            this.loadTextbooks()
          }
        } else {
          const res = await api.addTextbook(book.id)
          if (res.success) {
            showToast('添加成功', 'success')
            book.isAdded = true
            this.loadTextbooks()
          }
        }
      } catch (error) {
        console.error('操作失败:', error)
        showToast('操作失败', 'none')
      }
    },
    
    // 移除教材
    async removeTextbook(textbookId) {
      uni.showModal({
        title: '确认移除',
        content: '确定要移除这个教材吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              const result = await api.removeTextbook(textbookId)
              if (result.success) {
                showToast('已移除', 'success')
                this.loadTextbooks()
              }
            } catch (error) {
              console.error('移除失败:', error)
              showToast('操作失败', 'none')
            }
          }
        }
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

.add-textbook-section {
  padding: 20rpx 20rpx 0;
}

.btn-add-textbook-top {
  width: 100%;
  padding: 24rpx;
  background: #8B0012;
  color: #fff;
  font-size: 28rpx;
  border-radius: 12rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  box-shadow: 0 4rpx 12rpx rgba(139, 0, 18, 0.3);
}

.add-icon {
  font-size: 32rpx;
  font-weight: bold;
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
  box-shadow: 0 4rpx 20rpx rgba(139, 0, 18, 0.15);
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.remove-btn {
  font-size: 24rpx;
  color: #f56c6c;
  padding: 4rpx 12rpx;
  border: 1rpx solid #f56c6c;
  border-radius: 8rpx;
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

.lesson-title-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.lesson-title {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.complete-badge {
  font-size: 22rpx;
  color: #67c23a;
  background: #f0f9ff;
  border: 1rpx solid #67c23a;
  padding: 2rpx 8rpx;
  border-radius: 8rpx;
}

.complete-badge.complete-all {
  background: #f0f9ff;
  color: #67c23a;
  border: 1rpx solid #67c23a;
}

.progress-badges {
  display: flex;
  gap: 8rpx;
}

.progress-badge {
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  border-radius: 8rpx;
  border: 1rpx solid;
}

.progress-badge.study {
  color: #409eff;
  background: #ecf5ff;
  border-color: #409eff;
}

.progress-badge.review {
  color: #f56c6c;
  background: #fef0f0;
  border-color: #f56c6c;
}

.complete-count {
  font-size: 20rpx;
  color: #909399;
  background: #f4f4f5;
  padding: 2rpx 8rpx;
  border-radius: 8rpx;
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
  background: #8B0012;
  color: #fff;
}

.btn-review {
  background: #D4A04A;
  color: #fff;
}

.btn-review.btn-disabled,
.btn-review[disabled] {
  background: #e0e0e0;
  color: #a8a8a8;
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

.vocab-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.vocab-badges {
  display: flex;
  gap: 8rpx;
}

.vocab-badge {
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
  white-space: nowrap;
}

.vocab-badge.reflexive {
  color: #ff6b6b;
  background: #ffe0e0;
}

.vocab-badge.irregular {
  color: #ff8c00;
  background: #fff4e6;
}

.vocab-type {
  font-size: 22rpx;
  color: #8B0012;
  background: #fff0f0;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

.vocab-detail-btn {
  font-size: 22rpx;
  color: #8B0012;
  background: #fff;
  border: 1rpx solid #8B0012;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  white-space: nowrap;
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

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 85%;
  max-height: 70vh;
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
}

.modal-header {
  padding: 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1rpx solid #f0f0f0;
}

.modal-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.modal-close {
  font-size: 48rpx;
  color: #999;
  line-height: 1;
}

.modal-body {
  max-height: 60vh;
  overflow-y: auto;
  padding: 20rpx;
}

.textbook-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  margin-bottom: 16rpx;
  background: #f9f9f9;
  border-radius: 12rpx;
  border: 2rpx solid transparent;
  transition: all 0.3s;
}

.textbook-option.added {
  background: #fff0f0;
  border-color: #8B0012;
}

.option-info {
  flex: 1;
}

.option-name {
  display: block;
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  margin-bottom: 8rpx;
}

.option-desc {
  display: block;
  font-size: 24rpx;
  color: #999;
}

.option-status {
  font-size: 24rpx;
  color: #8B0012;
  padding: 8rpx 20rpx;
  border: 1rpx solid #8B0012;
  border-radius: 20rpx;
}

.textbook-option.added .option-status {
  background: #8B0012;
  color: #fff;
}
</style>
