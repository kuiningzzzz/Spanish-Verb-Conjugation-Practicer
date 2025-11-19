<template>
  <view class="container" :style="{ paddingTop: containerPaddingTop }">
    <!-- 自定义导航栏 -->
    <view class="custom-navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="navbar-content">
        <view class="navbar-back" @click="goBack">
          <text class="back-icon">←</text>
          <text class="back-text">返回</text>
        </view>
        <view class="navbar-title">开始练习</view>
        <view class="navbar-placeholder"></view>
      </view>
    </view>
    
    <view class="practice-header">
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progress + '%' }"></view>
      </view>
      <text class="progress-text">{{ totalAnswered }} / {{ exerciseCount }}</text>
    </view>

    <view class="card exercise-card" v-if="currentExercise">
      <view class="card-header">
        <view class="exercise-type-tag">
          <text>{{ exerciseTypeText }}</text>
        </view>
        <view class="header-actions">
          <!-- 单词收藏按钮 -->
          <view class="favorite-btn" @click="toggleFavorite">
            <text class="favorite-icon">{{ isFavorited ? '★' : '☆' }}</text>
          </view>
          <!-- 题目收藏按钮（仅填空题和例句填空） -->
          <view 
            v-if="exerciseType === 'fill' || exerciseType === 'sentence'" 
            class="question-favorite-btn" 
            @click="toggleQuestionFavorite"
          >
            <text class="question-favorite-icon">{{ isQuestionFavorited ? '📌' : '📍' }}</text>
          </view>
        </view>
      </view>

      <view class="verb-info">
        <text class="infinitive">{{ currentExercise.infinitive }}</text>
        <text class="meaning">{{ currentExercise.meaning }}</text>
      </view>

      <view class="question-section">
        <text class="tense-info">{{ currentExercise.mood }} - {{ currentExercise.tense }}</text>
        <text class="person-info">{{ currentExercise.person }}</text>
      </view>

      <!-- 选择题 -->
      <view v-if="exerciseType === 'choice'" class="options-container">
        <view
          v-for="(option, index) in currentExercise.options"
          :key="index"
          :class="['option-item', selectedAnswer === option ? 'selected' : '']"
          @click="selectOption(option)"
        >
          <text>{{ option }}</text>
        </view>
      </view>

      <!-- 例句填空题 -->
      <view v-else-if="exerciseType === 'sentence'" class="sentence-container">
        <view class="sentence-text">{{ currentExercise.sentence }}</view>
        
        <!-- 辅助按钮组 -->
        <view class="helper-buttons">
          <button 
            v-if="currentExercise.translation" 
            class="helper-btn" 
            :class="{ 'active': showTranslation }"
            @click="toggleTranslation"
          >
            <text class="helper-icon">📖</text>
            <text>{{ showTranslation ? '隐藏翻译' : '查看翻译' }}</text>
          </button>
          <button 
            v-if="currentExercise.hint" 
            class="helper-btn" 
            :class="{ 'active': showHint }"
            @click="toggleHint"
          >
            <text class="helper-icon">💡</text>
            <text>{{ showHint ? '隐藏提示' : '查看提示' }}</text>
          </button>
        </view>
        
        <!-- 翻译内容 -->
        <view class="translation" v-if="currentExercise.translation && showTranslation">
          <text>翻译：{{ currentExercise.translation }}</text>
        </view>
        
        <!-- 提示内容 -->
        <view class="hint-box" v-if="currentExercise.hint && showHint">
          <text class="hint-label">💡 提示：</text>
          <text class="hint-text">{{ currentExercise.hint }}</text>
        </view>
        
        <input
          class="answer-input"
          v-model="userAnswer"
          placeholder="请填入正确的动词变位"
          :focus="true"
        />
      </view>

      <!-- 填空题和变位题 -->
      <view v-else class="input-container">
        <view class="question-text" v-if="currentExercise.question">
          <text>{{ currentExercise.question }}</text>
        </view>
        
        <!-- 辅助按钮组 -->
        <view class="helper-buttons">
          <button 
            v-if="currentExercise.example" 
            class="helper-btn" 
            :class="{ 'active': showExample }"
            @click="toggleExample"
          >
            <text class="helper-icon">📝</text>
            <text>{{ showExample ? '隐藏例句' : '查看例句' }}</text>
          </button>
          <button 
            v-if="currentExercise.hint" 
            class="helper-btn" 
            :class="{ 'active': showHint }"
            @click="toggleHint"
          >
            <text class="helper-icon">💡</text>
            <text>{{ showHint ? '隐藏提示' : '查看提示' }}</text>
          </button>
        </view>
        
        <!-- 例句内容 -->
        <view class="example-text" v-if="currentExercise.example && showExample">
          <text>例句：{{ currentExercise.example }}</text>
        </view>
        
        <!-- 提示内容 -->
        <view class="hint-box" v-if="currentExercise.hint && showHint">
          <text class="hint-label">💡 提示：</text>
          <text class="hint-text">{{ currentExercise.hint }}</text>
        </view>
        
        <input
          class="answer-input"
          v-model="userAnswer"
          placeholder="请输入变位形式"
          :focus="true"
        />
      </view>

      <button class="btn-primary mt-20" @click="submitAnswer">提交答案</button>

      <!-- 题目生成状态指示器 -->
      <view class="ai-status" v-if="generatingCount > 0">
        <view class="ai-status-icon">🤖</view>
        <text class="ai-status-text">正在生成第 {{ exercises.length + 1 }}-{{ Math.min(exercises.length + generatingCount, exerciseCount) }} 题...</text>
      </view>
    </view>

    <!-- 答案反馈 -->
    <view class="modal" v-if="showFeedback" @click="nextExercise">
      <view class="modal-content" :class="isCorrect ? 'correct' : 'wrong'" @click.stop>
        <view class="feedback-icon">{{ isCorrect ? '✓' : '✗' }}</view>
        <text class="feedback-title">{{ isCorrect ? '回答正确！' : '回答错误' }}</text>
        <view class="feedback-detail" v-if="!isCorrect">
          <text class="label">正确答案：</text>
          <text class="answer">{{ currentExercise.correctAnswer }}</text>
        </view>
        <button class="btn-secondary mt-20" @click="nextExercise">下一题</button>
      </view>
    </view>

    <!-- 完成练习 -->
    <view class="modal" v-if="showResult" @click="finishPractice">
      <view class="modal-content result" @click.stop>
        <text class="result-title">练习完成！</text>
        <view class="result-stats">
          <view class="result-item">
            <text class="result-number">{{ correctCount }}</text>
            <text class="result-label">答对</text>
          </view>
          <view class="result-item">
            <text class="result-number">{{ exercises.length }}</text>
            <text class="result-label">总题数</text>
          </view>
          <view class="result-item">
            <text class="result-number">{{ accuracy }}%</text>
            <text class="result-label">正确率</text>
          </view>
        </view>
        <button class="btn-primary mt-20" @click="finishPractice">完成</button>
        <button class="btn-secondary mt-20" @click="restartPractice">再来一次</button>
      </view>
    </view>

    <!-- 配置面板 -->
    <view class="settings-card card" v-if="!hasStarted">
      <text class="title">练习设置</text>
      
      <view class="form-item">
        <text class="label">练习类型</text>
        <picker @change="onExerciseTypeChange" :value="exerciseTypeIndex" :range="exerciseTypes" range-key="label">
          <view class="picker">{{ exerciseTypes[exerciseTypeIndex].label }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">题目数量</text>
        <slider @change="onCountChange" :value="exerciseCount" min="5" max="30" show-value />
      </view>

      <!-- 专项练习设置 -->
      <view class="form-item theme-practice-item">
        <view class="theme-header">
          <text class="theme-icon">🎯</text>
          <text class="label theme-label">专项练习</text>
        </view>
        
        <!-- 时态选择 -->
        <view class="theme-section">
          <text class="theme-subtitle">时态选择</text>
          <view class="checkbox-group">
            <view 
              v-for="(tense, index) in tenseOptions" 
              :key="index"
              :class="['checkbox-item', selectedTenses.includes(tense.value) ? 'checked' : '']"
              @click="toggleTense(tense.value)"
            >
              <text class="checkbox-icon">{{ selectedTenses.includes(tense.value) ? '☑' : '☐' }}</text>
              <text class="checkbox-label">{{ tense.label }}</text>
            </view>
          </view>
        </view>

        <!-- 变位类型选择 -->
        <view class="theme-section">
          <text class="theme-subtitle">变位类型</text>
          <view class="checkbox-group">
            <view 
              v-for="(type, index) in conjugationTypes" 
              :key="index"
              :class="['checkbox-item', selectedConjugationTypes.includes(type.value) ? 'checked' : '']"
              @click="toggleConjugationType(type.value)"
            >
              <text class="checkbox-icon">{{ selectedConjugationTypes.includes(type.value) ? '☑' : '☐' }}</text>
              <text class="checkbox-label">{{ type.label }}</text>
            </view>
          </view>
        </view>

        <!-- 不规则动词选项 -->
        <view class="theme-section">
          <text class="theme-subtitle">动词规则性</text>
          <view class="checkbox-group">
            <view 
              :class="['checkbox-item', includeIrregular ? 'checked' : '']"
              @click="includeIrregular = !includeIrregular"
            >
              <text class="checkbox-icon">{{ includeIrregular ? '☑' : '☐' }}</text>
              <text class="checkbox-label">包含不规则动词</text>
            </view>
          </view>
        </view>

        <!-- 快速设置 -->
        <view class="quick-settings">
          <text class="quick-label">快速设置：</text>
          <button class="quick-btn" @click="selectAllThemes">全选</button>
          <button class="quick-btn secondary" @click="clearAllThemes">清除</button>
        </view>
      </view>

      <button class="btn-primary mt-20" @click="startPractice">开始练习</button>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast, showLoading, hideLoading } from '@/utils/common.js'

export default {
  data() {
    return {
      statusBarHeight: 0, // 状态栏高度
      hasStarted: false,
      exerciseTypes: [
        { value: 'choice', label: '选择题' },
        { value: 'fill', label: '填空题' },
        { value: 'conjugate', label: '变位练习' },
        { value: 'sentence', label: '例句填空' }
      ],
      exerciseTypeIndex: 0,
      exerciseType: 'choice',
      exerciseCount: 10,
      
      // 专项练习设置
      tenseOptions: [
        { value: 'presente', label: '现在时' },
        { value: 'preterito', label: '简单过去时' },
        { value: 'futuro', label: '将来时' }
        // 注意：过去未完成时和条件式暂未添加数据，待后续扩展
        // { value: 'imperfecto', label: '过去未完成时' },
        // { value: 'condicional', label: '条件式' }
      ],
      selectedTenses: ['presente', 'preterito', 'futuro'],  // 默认全选现有时态
      
      conjugationTypes: [
        { value: 'ar', label: '第一变位 (-ar)' },
        { value: 'er', label: '第二变位 (-er)' },
        { value: 'ir', label: '第三变位 (-ir)' }
      ],
      selectedConjugationTypes: ['ar', 'er', 'ir'],  // 默认全选
      
      includeIrregular: true,  // 是否包含不规则动词
      
      exercises: [],
      currentIndex: 0,
      userAnswer: '',
      selectedAnswer: '',
      showFeedback: false,
      showResult: false,
      isCorrect: false,
      correctCount: 0,
      // 流水线相关
      generatingCount: 0,  // 正在生成的题目数量（支持并发）
      generationError: false,  // 生成是否出错
      totalAnswered: 0,  // 已答题数
      bufferSize: 2,  // 缓冲区大小：保持提前生成2题
      maxConcurrent: 2,  // 最大并发生成数
      
      // 单词本相关
      isFavorited: false,  // 当前单词是否已收藏
      practiceMode: 'normal', // 练习模式：normal/favorite/wrong
      
      // 题目收藏相关（仅填空题和例句填空）
      isQuestionFavorited: false,  // 当前题目是否已收藏
      
      // 辅助内容显示控制
      showExample: false,    // 是否显示例句
      showHint: false,       // 是否显示提示
      showTranslation: false // 是否显示翻译
    }
  },
  onLoad(options) {
    // 获取系统信息，设置状态栏高度
    const systemInfo = uni.getSystemInfoSync()
    this.statusBarHeight = systemInfo.statusBarHeight || 0
    
    // 获取练习模式参数
    if (options.mode) {
      this.practiceMode = options.mode // favorite: 收藏练习, wrong: 错题练习
    }
  },
  computed: {
    containerPaddingTop() {
      // 状态栏高度 + 导航栏内容高度(88rpx转px) + 额外间距
      const navBarHeight = 88 / 750 * uni.getSystemInfoSync().windowWidth // 88rpx转px
      return (this.statusBarHeight + navBarHeight + 10) + 'px'
    },
    currentExercise() {
      return this.exercises[this.currentIndex]
    },
    progress() {
      return this.exerciseCount ? ((this.totalAnswered) / this.exerciseCount) * 100 : 0
    },
    accuracy() {
      return this.totalAnswered ? Math.round((this.correctCount / this.totalAnswered) * 100) : 0
    },
    exerciseTypeText() {
      const types = { choice: '选择题', fill: '填空题', conjugate: '变位练习', sentence: '例句填空' }
      return types[this.exerciseType] || ''
    }
  },
  methods: {
    goBack() {
      if (this.hasStarted) {
        uni.showModal({
          title: '提示',
          content: '练习尚未完成，确定要返回吗？',
          success: (res) => {
            if (res.confirm) {
              uni.navigateBack({
                delta: 1
              })
            }
          }
        })
      } else {
        uni.navigateBack({
          delta: 1
        })
      }
    },
    onExerciseTypeChange(e) {
      this.exerciseTypeIndex = e.detail.value
      this.exerciseType = this.exerciseTypes[e.detail.value].value
    },
    onCountChange(e) {
      this.exerciseCount = e.detail.value
    },
    
    // 专项练习设置方法
    toggleTense(tense) {
      const index = this.selectedTenses.indexOf(tense)
      if (index > -1) {
        this.selectedTenses.splice(index, 1)
      } else {
        this.selectedTenses.push(tense)
      }
    },
    
    toggleConjugationType(type) {
      const index = this.selectedConjugationTypes.indexOf(type)
      if (index > -1) {
        this.selectedConjugationTypes.splice(index, 1)
      } else {
        this.selectedConjugationTypes.push(type)
      }
    },
    
    selectAllThemes() {
      this.selectedTenses = this.tenseOptions.map(t => t.value)
      this.selectedConjugationTypes = this.conjugationTypes.map(c => c.value)
      this.includeIrregular = true
      showToast('已全选所有选项', 'success')
    },
    
    clearAllThemes() {
      this.selectedTenses = []
      this.selectedConjugationTypes = []
      this.includeIrregular = false
      showToast('已清除所有选项', 'none')
    },
    
    async startPractice() {
      // 验证是否登录
      const token = uni.getStorageSync('token')
      if (!token) {
        showToast('请先登录', 'none')
        setTimeout(() => {
          uni.navigateTo({
            url: '/pages/login/login'
          })
        }, 1500)
        return
      }
      
      // 验证是否至少选择了一个时态和变位类型
      if (this.selectedTenses.length === 0) {
        showToast('请至少选择一个时态', 'none')
        return
      }
      
      if (this.selectedConjugationTypes.length === 0) {
        showToast('请至少选择一个变位类型', 'none')
        return
      }
      
      showLoading('正在生成第一题...')

      try {
        // 流水线模式：先生成第一题
        const res = await api.getOneExercise({
          exerciseType: this.exerciseType,
          tenses: this.selectedTenses,
          conjugationTypes: this.selectedConjugationTypes,
          includeIrregular: this.includeIrregular,
          practiceMode: this.practiceMode  // 传递练习模式
        })

        hideLoading()

        if (res.success && res.exercise) {
          this.exercises = [res.exercise]
          this.hasStarted = true
          this.currentIndex = 0
          this.correctCount = 0
          this.totalAnswered = 0
          this.generationError = false
          
          // 检查第一题的收藏状态
          this.checkFavoriteStatus()
          this.checkQuestionFavoriteStatus()
          
          // 立即开始预生成题目（根据缓冲区大小）
          this.fillBuffer()
        } else {
          showToast('获取练习题失败')
        }
      } catch (error) {
        console.error('练习获取失败:', error)
        hideLoading()
        
        // 更详细的错误信息
        if (error.error === '无效的token' || error.error === 'token已过期') {
          showToast('登录已过期，请重新登录', 'none')
          setTimeout(() => {
            uni.removeStorageSync('token')
            uni.removeStorageSync('userInfo')
            uni.navigateTo({
              url: '/pages/login/login'
            })
          }, 1500)
        } else if (error.error) {
          showToast(error.error, 'none')
        } else {
          showToast('网络请求失败，请检查网络连接', 'none')
        }
      }
    },

    // 填充缓冲区：保持提前生成 bufferSize 道题
    async fillBuffer() {
      // 计算还需要的题目数
      const totalNeeded = this.exerciseCount
      const currentHave = this.exercises.length
      const inProgress = this.generatingCount
      const bufferTarget = this.currentIndex + 1 + this.bufferSize
      
      // 计算需要启动多少个生成任务
      const needed = Math.min(
        bufferTarget - currentHave - inProgress,  // 缓冲区缺口
        totalNeeded - currentHave - inProgress,   // 总题目数限制
        this.maxConcurrent - this.generatingCount // 并发数限制
      )

      // 启动生成任务
      for (let i = 0; i < needed; i++) {
        this.generateNextExercise()
      }
    },

    // 后台生成下一题
    async generateNextExercise() {
      // 如果已经生成了足够的题目，不再生成
      if (this.exercises.length >= this.exerciseCount) {
        return
      }

      // 并发控制
      if (this.generatingCount >= this.maxConcurrent) {
        return
      }

      this.generatingCount++
      this.generationError = false

      try {
        const res = await api.getOneExercise({
          exerciseType: this.exerciseType,
          tenses: this.selectedTenses,
          conjugationTypes: this.selectedConjugationTypes,
          includeIrregular: this.includeIrregular,
          practiceMode: this.practiceMode  // 传递练习模式
        })

        if (res.success && res.exercise) {
          this.exercises.push(res.exercise)
          this.generatingCount--
          
          // 生成成功后，继续填充缓冲区
          this.fillBuffer()
        } else {
          this.generationError = true
          this.generatingCount--
        }
      } catch (error) {
        console.error('生成下一题失败:', error)
        this.generationError = true
        this.generatingCount--
      }
    },
    selectOption(option) {
      this.selectedAnswer = option
    },
    
    // 切换收藏状态
    async toggleFavorite() {
      if (!this.currentExercise) return
      
      try {
        const verbId = this.currentExercise.verbId
        
        if (this.isFavorited) {
          // 取消收藏
          const res = await api.removeFavorite({ verbId })
          if (res.success) {
            this.isFavorited = false
            showToast('已取消收藏', 'success')
          }
        } else {
          // 添加收藏
          const res = await api.addFavorite({ verbId })
          if (res.success) {
            this.isFavorited = true
            showToast('收藏成功', 'success')
          }
        }
      } catch (error) {
        console.error('收藏操作失败:', error)
        showToast('操作失败', 'none')
      }
    },
    
    // 检查当前单词是否已收藏
    async checkFavoriteStatus() {
      if (!this.currentExercise) return
      
      try {
        const res = await api.checkFavorite(this.currentExercise.verbId)
        if (res.success) {
          this.isFavorited = res.isFavorited
        }
      } catch (error) {
        console.error('检查收藏状态失败:', error)
      }
    },
    
    // 记录错题
    async recordWrongAnswer() {
      if (!this.currentExercise) return
      
      try {
        const verbId = this.currentExercise.verbId
        await api.addWrongVerb({ verbId })
      } catch (error) {
        console.error('记录错题失败:', error)
      }
    },
    
    // 检查当前题目是否已收藏（仅填空题和例句填空）
    async checkQuestionFavoriteStatus() {
      const ex = this.currentExercise
      if (!ex || (ex.exerciseType !== 'fill' && ex.exerciseType !== 'sentence')) {
        this.isQuestionFavorited = false
        return
      }
      
      // 如果题目来自私人题库，默认已收藏
      if (ex.questionSource === 'private') {
        this.isQuestionFavorited = true
        return
      }
      
      // TODO: 暂时设为未收藏，后续可以添加检查逻辑
      this.isQuestionFavorited = false
    },
    
    // 切换题目收藏状态（仅填空题和例句填空）
    async toggleQuestionFavorite() {
      const ex = this.currentExercise
      if (!ex || (ex.exerciseType !== 'fill' && ex.exerciseType !== 'sentence')) {
        showToast('只支持收藏填空题和例句填空', 'none')
        return
      }
      
      try {
        if (this.isQuestionFavorited) {
          // 取消收藏
          showToast('该功能开发中', 'none')
          // TODO: 需要知道privateQuestionId才能取消收藏
        } else {
          // 收藏题目
          const questionData = {
            verbId: ex.verbId,
            questionType: ex.exerciseType,
            questionText: ex.exerciseType === 'sentence' ? ex.sentence : ex.question,
            correctAnswer: ex.correctAnswer,
            exampleSentence: ex.example || ex.sentence,
            translation: ex.translation,
            hint: ex.hint,
            tense: ex.tense,
            mood: ex.mood,
            person: ex.person
          }
          
          // 如果题目来自公共题库，传递questionId
          if (ex.questionId && ex.questionSource === 'public') {
            questionData.questionId = ex.questionId
            questionData.questionSource = ex.questionSource
          }
          
          await api.favoriteQuestion(questionData)
          this.isQuestionFavorited = true
          showToast('题目已收藏', 'success')
        }
      } catch (error) {
        console.error('收藏题目失败:', error)
        showToast('操作失败', 'none')
      }
    },
    
    // 切换例句显示
    toggleExample() {
      this.showExample = !this.showExample
    },
    
    // 切换提示显示
    toggleHint() {
      this.showHint = !this.showHint
    },
    
    // 切换翻译显示
    toggleTranslation() {
      this.showTranslation = !this.showTranslation
    },
    
    async submitAnswer() {
      const answer = this.exerciseType === 'choice' ? this.selectedAnswer : this.userAnswer

      if (!answer) {
        showToast('请先作答')
        return
      }

      try {
        const res = await api.submitAnswer({
          verbId: this.currentExercise.verbId,
          exerciseType: this.exerciseType,
          answer: answer,
          correctAnswer: this.currentExercise.correctAnswer,
          tense: this.currentExercise.tense,
          mood: this.currentExercise.mood,
          person: this.currentExercise.person,
          questionId: this.currentExercise.questionId,           // 题库题目ID（如果有）
          questionSource: this.currentExercise.questionSource     // 题目来源（public/private）
        })

        if (res.success) {
          this.isCorrect = res.isCorrect
          if (res.isCorrect) {
            this.correctCount++
          } else {
            // 答错了，记录到错题本
            this.recordWrongAnswer()
          }
          this.totalAnswered++
          this.showFeedback = true
        }
      } catch (error) {
        showToast('提交失败')
      }
    },

    async nextExercise() {
      this.showFeedback = false
      this.userAnswer = ''
      this.selectedAnswer = ''
      
      // 重置辅助内容显示状态
      this.showExample = false
      this.showHint = false
      this.showTranslation = false

      // 检查是否完成所有题目
      if (this.totalAnswered >= this.exerciseCount) {
        this.showResult = true
        return
      }

      // 检查下一题是否已生成
      if (this.currentIndex + 1 < this.exercises.length) {
        // 下一题已准备好，直接跳转
        this.currentIndex++
        // 检查新题目的收藏状态
        this.checkFavoriteStatus()
        this.checkQuestionFavoriteStatus()
        // 继续填充缓冲区
        this.fillBuffer()
      } else {
        // 下一题还没生成好
        if (this.generatingCount > 0) {
          // 正在生成中，显示等待提示
          showLoading('正在生成下一题，请稍候...')
          
          // 轮询等待生成完成
          const checkInterval = setInterval(() => {
            if (this.currentIndex + 1 < this.exercises.length) {
              // 生成完成
              clearInterval(checkInterval)
              hideLoading()
              this.currentIndex++
              this.fillBuffer()
            } else if (this.generationError && this.generatingCount === 0) {
              // 生成失败
              clearInterval(checkInterval)
              hideLoading()
              showToast('生成题目失败，请重试', 'none')
              // 重试生成
              this.fillBuffer()
            }
          }, 300)
          
          // 超时保护（15秒）
          setTimeout(() => {
            if (this.generatingCount > 0) {
              clearInterval(checkInterval)
              hideLoading()
              showToast('生成超时，请检查网络', 'none')
            }
          }, 15000)
        } else if (this.generationError) {
          // 生成出错，重试
          showToast('正在重新生成...', 'none')
          await this.fillBuffer()
          // 重试后检查
          if (this.currentIndex + 1 < this.exercises.length) {
            this.currentIndex++
            this.fillBuffer()
          }
        }
      }
    },
    finishPractice() {
      this.showResult = false
      this.hasStarted = false
      this.exercises = []
      this.currentIndex = 0
      this.correctCount = 0
      this.totalAnswered = 0
      this.generatingCount = 0
      this.generationError = false
    },
    restartPractice() {
      this.showResult = false
      this.currentIndex = 0
      this.correctCount = 0
      this.totalAnswered = 0
      this.generatingCount = 0
      this.generationError = false
    }
  }
}
</script>

<style scoped>
/* 自定义导航栏 */
.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-bottom: 1rpx solid #f0f0f0;
  z-index: 1000;
  /* padding-top 通过行内样式动态设置 */
}

.navbar-content {
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
}

.navbar-back {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
  cursor: pointer;
  min-width: 120rpx;
}

.back-icon {
  font-size: 40rpx;
  color: #667eea;
  font-weight: bold;
  margin-right: 8rpx;
  line-height: 1;
}

.back-text {
  font-size: 32rpx;
  color: #667eea;
  line-height: 1;
}

.navbar-title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 36rpx;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
}

.navbar-placeholder {
  width: 120rpx;
}

/* 容器样式 */
.container {
  min-height: 100vh;
  background: #f8f8f8;
  /* padding-top 通过行内样式动态设置 */
}

.practice-header {
  /* margin-top 已由容器的 padding-top 处理 */
  padding: 20rpx;
  background: #fff;
}

.progress-bar {
  height: 8rpx;
  background: #f0f0f0;
  border-radius: 4rpx;
  overflow: hidden;
  margin-bottom: 15rpx;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s;
}

.progress-text {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #999;
}

.exercise-card {
  margin-top: 20rpx;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.exercise-type-tag {
  display: inline-block;
  background: #f0f0f0;
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: #666;
}

.favorite-btn {
  padding: 10rpx 15rpx;
  cursor: pointer;
}

.header-actions {
  display: flex;
  gap: 15rpx;
  align-items: center;
}

.question-favorite-btn {
  padding: 10rpx 15rpx;
  cursor: pointer;
}

.favorite-icon {
  font-size: 48rpx;
  color: #ffd700;
  line-height: 1;
}

.question-favorite-icon {
  font-size: 44rpx;
  line-height: 1;
}

.verb-info {
  text-align: center;
  margin: 30rpx 0;
}

.infinitive {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 10rpx;
}

.meaning {
  display: block;
  font-size: 28rpx;
  color: #999;
}

.question-section {
  background: #f5f5f5;
  padding: 30rpx;
  border-radius: 12rpx;
  text-align: center;
  margin-bottom: 30rpx;
}

.tense-info {
  display: block;
  font-size: 32rpx;
  color: #333;
  font-weight: bold;
  margin-bottom: 10rpx;
}

.person-info {
  display: block;
  font-size: 28rpx;
  color: #667eea;
}

.options-container {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
}

.option-item {
  background: #f5f5f5;
  padding: 30rpx;
  border-radius: 12rpx;
  text-align: center;
  font-size: 28rpx;
  border: 2rpx solid transparent;
}

.option-item.selected {
  background: #e6f7ff;
  border-color: #667eea;
  color: #667eea;
}

.input-container {
  padding: 20rpx 0;
}

/* 辅助按钮组样式 */
.helper-buttons {
  display: flex;
  gap: 15rpx;
  margin: 25rpx 0 20rpx 0;
  justify-content: center;
  flex-wrap: wrap;
}

.helper-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 18rpx 30rpx;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  border: 2rpx solid #d1d9e6;
  border-radius: 50rpx;
  font-size: 26rpx;
  color: #555;
  transition: all 0.3s ease;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.helper-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: #fff;
  box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.3);
  transform: translateY(-2rpx);
}

.helper-icon {
  font-size: 32rpx;
  line-height: 1;
}

/* 例句、翻译、提示样式 */
.sentence-container {
  padding: 20rpx 0;
}

.sentence-text {
  font-size: 30rpx;
  color: #333;
  line-height: 1.8;
  margin-bottom: 20rpx;
  padding: 25rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  border-left: 4rpx solid #667eea;
}

.translation {
  background: #e8f5e9;
  padding: 20rpx 25rpx;
  border-radius: 12rpx;
  margin: 20rpx 0;
  font-size: 26rpx;
  color: #2e7d32;
  line-height: 1.6;
  border-left: 4rpx solid #4caf50;
  animation: slideIn 0.3s ease;
}

.example-text {
  background: #fff3e0;
  padding: 20rpx 25rpx;
  border-radius: 12rpx;
  margin: 20rpx 0;
  font-size: 26rpx;
  color: #e65100;
  line-height: 1.6;
  border-left: 4rpx solid #ff9800;
  animation: slideIn 0.3s ease;
}

.hint-box {
  background: #fff8e1;
  padding: 20rpx 25rpx;
  border-radius: 12rpx;
  margin: 20rpx 0;
  border-left: 4rpx solid #ffa726;
  animation: slideIn 0.3s ease;
}

.hint-label {
  font-size: 24rpx;
  color: #f57c00;
  font-weight: 600;
  display: block;
  margin-bottom: 8rpx;
}

.hint-text {
  font-size: 26rpx;
  color: #ef6c00;
  line-height: 1.6;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.answer-input {
  width: 100%;
  height: 100rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 30rpx;
  font-size: 32rpx;
  text-align: center;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  background: #fff;
  border-radius: 24rpx;
  padding: 60rpx 40rpx;
  width: 80%;
  max-width: 600rpx;
}

.modal-content.correct {
  border-top: 8rpx solid #52c41a;
}

.modal-content.wrong {
  border-top: 8rpx solid #ff4d4f;
}

.feedback-icon {
  text-align: center;
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.modal-content.correct .feedback-icon {
  color: #52c41a;
}

.modal-content.wrong .feedback-icon {
  color: #ff4d4f;
}

.feedback-title {
  display: block;
  text-align: center;
  font-size: 36rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
}

.feedback-detail {
  background: #f5f5f5;
  padding: 30rpx;
  border-radius: 12rpx;
  text-align: center;
}

.feedback-detail .label {
  display: block;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 10rpx;
}

.feedback-detail .answer {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.result-title {
  display: block;
  text-align: center;
  font-size: 40rpx;
  font-weight: bold;
  margin-bottom: 40rpx;
}

.result-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20rpx;
}

.result-item {
  text-align: center;
}

.result-number {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 10rpx;
}

.result-label {
  display: block;
  font-size: 24rpx;
  color: #999;
}

.settings-card {
  margin-top: 20rpx;
}

.settings-card .title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 30rpx;
  padding-bottom: 20rpx;
  border-bottom: 2rpx solid #f0f0f0;
  display: flex;
  align-items: center;
}

.settings-card .title::before {
  content: '⚙️';
  margin-right: 12rpx;
  font-size: 32rpx;
}

.form-item {
  margin-bottom: 30rpx;
}

.label {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 15rpx;
  font-weight: 500;
}

.picker {
  background: #f8f9fa;
  padding: 20rpx 30rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #333;
  border: 2rpx solid #e9ecef;
  position: relative;
  transition: all 0.3s ease;
}

.picker:active {
  background: #e9ecef;
  border-color: #667eea;
}

.picker::after {
  content: '▼';
  position: absolute;
  right: 30rpx;
  top: 50%;
  transform: translateY(-50%);
  font-size: 20rpx;
  color: #999;
}

slider {
  margin-top: 10rpx;
}

/* 专项练习样式 */
.theme-practice-item {
  background: linear-gradient(135deg, #fff9f0 0%, #fff5fb 100%);
  border: 2rpx solid #ffe7d6;
  border-radius: 16rpx;
  padding: 25rpx;
  margin-bottom: 35rpx;
  box-shadow: 0 4rpx 12rpx rgba(255, 153, 0, 0.08);
}

.theme-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 15rpx;
  border-bottom: 2rpx solid #ffe7d6;
}

.theme-icon {
  font-size: 36rpx;
  margin-right: 12rpx;
}

.theme-label {
  margin-bottom: 0;
  font-size: 30rpx;
  font-weight: 600;
  color: #ff9500;
}

.theme-section {
  margin-bottom: 25rpx;
}

.theme-subtitle {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
  font-weight: 500;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.checkbox-item {
  background: #fff;
  padding: 12rpx 20rpx;
  border-radius: 8rpx;
  border: 2rpx solid #e9ecef;
  display: flex;
  align-items: center;
  transition: all 0.3s ease;
}

.checkbox-item.checked {
  background: linear-gradient(135deg, #fff4e6 0%, #ffe7d6 100%);
  border-color: #ff9500;
}

.checkbox-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
  color: #999;
}

.checkbox-item.checked .checkbox-icon {
  color: #ff9500;
}

.checkbox-label {
  font-size: 24rpx;
  color: #333;
}

.quick-settings {
  display: flex;
  align-items: center;
  margin-top: 20rpx;
  padding-top: 15rpx;
  border-top: 2rpx solid #ffe7d6;
}

.quick-label {
  font-size: 24rpx;
  color: #666;
  margin-right: 15rpx;
}

.quick-btn {
  padding: 8rpx 20rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  background: linear-gradient(135deg, #ff9500 0%, #ff6b00 100%);
  color: #fff;
  border: none;
  margin-right: 10rpx;
  min-width: auto;
  line-height: 1.4;
}

.quick-btn.secondary {
  background: #fff;
  color: #ff9500;
  border: 2rpx solid #ff9500;
}

.quick-btn::after {
  border: none;
}

/* AI 开关样式优化 */
.ai-switch-item {
  background: linear-gradient(135deg, #f8f9ff 0%, #fff5f8 100%);
  border: 2rpx solid #e0e7ff;
  border-radius: 16rpx;
  padding: 25rpx;
  margin-bottom: 35rpx;
  box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.08);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.ai-switch-item::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(102, 126, 234, 0.03) 0%, transparent 70%);
  animation: glow 3s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% {
    opacity: 0.5;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.ai-switch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15rpx;
  position: relative;
  z-index: 1;
}

.ai-switch-title {
  display: flex;
  align-items: center;
  flex: 1;
}

.ai-icon {
  font-size: 36rpx;
  margin-right: 12rpx;
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6rpx);
  }
}

.ai-label {
  margin-bottom: 0;
  font-size: 30rpx;
  font-weight: 600;
  color: #667eea;
}

.ai-description-box {
  background: rgba(102, 126, 234, 0.05);
  padding: 15rpx 20rpx;
  border-radius: 12rpx;
  border-left: 4rpx solid #667eea;
  position: relative;
  z-index: 1;
}

.ai-description {
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
}

/* AI 生成状态指示器 */
.ai-status {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 20rpx;
  padding: 15rpx 25rpx;
  background: linear-gradient(135deg, #e0e7ff 0%, #f0e7ff 100%);
  border-radius: 50rpx;
  animation: pulse 2s ease-in-out infinite;
}

.ai-status-icon {
  font-size: 32rpx;
  margin-right: 10rpx;
  animation: rotate 3s linear infinite;
}

.ai-status-text {
  font-size: 24rpx;
  color: #667eea;
  font-weight: 500;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* AI 增强样式 */
.ai-info-box {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 20rpx;
  border-radius: 12rpx;
  margin: 15rpx 0;
  font-size: 26rpx;
  line-height: 1.6;
}

.ai-translation {
  background: #f0f4ff;
  color: #667eea;
  padding: 15rpx 20rpx;
  border-radius: 10rpx;
  margin-top: 15rpx;
  font-size: 24rpx;
  border-left: 4rpx solid #667eea;
}

.ai-hint {
  background: #fff8e1;
  color: #f57c00;
  padding: 15rpx 20rpx;
  border-radius: 10rpx;
  margin-top: 15rpx;
  font-size: 24rpx;
  border-left: 4rpx solid #f57c00;
}

.ai-example {
  background: #f1f8e9;
  color: #558b2f;
  padding: 15rpx 20rpx;
  border-radius: 10rpx;
  margin-top: 15rpx;
  font-size: 24rpx;
  line-height: 1.6;
}

.picker {
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 20rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
</style>
