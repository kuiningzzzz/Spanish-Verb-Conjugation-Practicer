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
    
    <!-- 自定义消息提示条 -->
    <view class="custom-message" :class="{ 'show': showCustomMessage, 'success': messageType === 'success', 'error': messageType === 'error' }">
      <text class="message-text">{{ customMessageText }}</text>
    </view>
    
    <view class="practice-header">
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progress + '%' }"></view>
      </view>
      <text class="progress-text">{{ totalAnswered }} / {{ exerciseCount }}</text>
    </view>

    <view class="card exercise-card" v-if="currentExercise">
      <view class="card-header">
        <view class="header-tags">
          <view class="exercise-type-tag">
            <text>{{ exerciseTypeText }}</text>
          </view>
          <view class="retry-tag" v-if="currentExercise.isRetry">
            <text>错题重做</text>
          </view>
        </view>
        <view class="header-actions">
          <!-- 单词收藏按钮 -->
          <view class="favorite-btn" @click="toggleFavorite">
            <text class="favorite-icon">{{ isFavorited ? '★' : '☆' }}</text>
          </view>
          <!-- 题目收藏按钮（仅例句填空） -->
          <view 
            v-if="exerciseType === 'sentence'" 
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

      <!-- 组合填空题不需要顶部提示，每个题目都有详细要求 -->
      
      <!-- 快变快填题和其他题型的题干信息 -->
      <view v-if="exerciseType === 'quick-fill'" class="question-section">
        <text class="tense-info">{{ currentExercise.mood }} - {{ currentExercise.tense }}</text>
        <text class="person-info">{{ currentExercise.person }}</text>
      </view>
      <view v-else-if="exerciseType !== 'sentence' && exerciseType !== 'combo-fill'" class="question-section">
        <text class="tense-info">{{ currentExercise.mood }} - {{ currentExercise.tense }}</text>
        <text class="person-info">{{ currentExercise.person }}</text>
      </view>

      <!-- 例句填空题 -->
      <view v-if="exerciseType === 'sentence'" class="sentence-container">
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
          :disabled="showFeedback"
          :focus="!showFeedback"
        />
      </view>

      <!-- 快变快填题 -->
      <view v-if="exerciseType === 'quick-fill'" class="input-container">
        <input
          class="answer-input"
          v-model="userAnswer"
          placeholder="请输入目标变位形式"
          :disabled="showFeedback"
          :focus="!showFeedback"
        />
      </view>

      <!-- 组合填空题 -->
      <view v-if="exerciseType === 'combo-fill' && currentExercise.comboItems" class="combo-container">
        <view 
          v-for="(item, index) in currentExercise.comboItems" 
          :key="index" 
          class="combo-item"
          :class="{ 'answered': comboAnswers[index], 'correct': showFeedback && item.isCorrect, 'wrong': showFeedback && !item.isCorrect && comboAnswers[index] }"
        >
          <view class="combo-header">
            <text class="combo-number">{{ index + 1 }}.</text>
            <view class="combo-requirement">
              <text class="requirement-mood">{{ item.mood }}</text>
              <text class="requirement-divider">-</text>
              <text class="requirement-tense">{{ item.tense }}</text>
              <text class="requirement-divider">-</text>
              <text class="requirement-person">{{ item.person }}</text>
            </view>
          </view>
          <input
            class="combo-input"
            v-model="comboAnswers[index]"
            placeholder="请输入变位形式"
            :disabled="showFeedback"
          />
          <view v-if="showFeedback && !item.isCorrect && comboAnswers[index]" class="combo-correct-answer">
            <text class="correct-label">正确答案：</text>
            <text class="correct-text">{{ item.correctAnswer }}</text>
          </view>
        </view>
      </view>

      <!-- 内嵌答案反馈区域（组合填空题不显示，因为每个输入框都有独立反馈） -->
      <view class="inline-feedback" v-if="showFeedback && exerciseType !== 'combo-fill'" :class="isCorrect ? 'correct' : 'wrong'">
        <view class="feedback-header">
          <view class="feedback-icon">{{ isCorrect ? '✓' : '✗' }}</view>
          <text class="feedback-title">{{ isCorrect ? '回答正确！' : '回答错误' }}</text>
        </view>
        
        <view class="feedback-detail" v-if="!isCorrect">
          <text class="label">正确答案：</text>
          <text class="answer">{{ currentExercise.correctAnswer }}</text>
        </view>
        
        <!-- 题目评价按钮（仅AI生成题或题库题显示） -->
        <view class="rating-buttons" v-if="showRatingButtons && !hasRated">
          <text class="rating-prompt">这道题的质量如何？</text>
          <view class="rating-btns">
            <button class="rating-btn good-btn" @click="rateQuestion(1)">
              <text class="rating-icon">👍</text>
              <text>好题</text>
            </button>
            <button class="rating-btn bad-btn" @click="rateQuestion(-1)">
              <text class="rating-icon">👎</text>
              <text>坏题</text>
            </button>
          </view>
        </view>
      </view>

      <button class="btn-primary mt-20" @click="handleAnswerAction">{{ showFeedback ? '下一题' : '提交答案' }}</button>

      <!-- 题目生成状态指示器 -->
      <view class="ai-status" v-if="generatingCount > 0">
        <view class="ai-status-icon">🤖</view>
        <text class="ai-status-text">正在生成第 {{ exercises.length + 1 }}-{{ Math.min(exercises.length + generatingCount, exerciseCount) }} 题...</text>
      </view>
    </view>

    <!-- 练习总结弹窗 -->
    <view class="modal" v-if="showSummary">
      <view class="modal-content summary" @click.stop>
        <text class="summary-title">🎯 本次练习总结</text>
        
        <view class="summary-stats">
          <view class="summary-row">
            <text class="summary-label">总题数：</text>
            <text class="summary-value">{{ summaryData.total }} 题</text>
          </view>
          <view class="summary-row success">
            <text class="summary-label">答对：</text>
            <text class="summary-value">{{ summaryData.correct }} 题</text>
          </view>
          <view class="summary-row error">
            <text class="summary-label">答错：</text>
            <text class="summary-value">{{ summaryData.wrong }} 题</text>
          </view>
          <view class="summary-row accuracy">
            <text class="summary-label">正确率：</text>
            <text class="summary-value highlight">{{ summaryData.accuracy }}%</text>
          </view>
        </view>
        
        <view class="summary-divider"></view>
        
        <view class="summary-question" v-if="wrongExercises.length > 0">
          <text class="question-icon">❓</text>
          <text class="question-text">发现 {{ wrongExercises.length }} 道错题，是否进行错题重做？</text>
        </view>
        
        <view class="summary-actions">
          <button class="btn-primary" @click="startRetryWrong" v-if="wrongExercises.length > 0">
            <text class="btn-icon">🔄</text>
            <text>重做错题</text>
          </button>
          <button class="btn-secondary" @click="skipRetryAndFinish">
            <text class="btn-icon">✓</text>
            <text>{{ wrongExercises.length > 0 ? '跳过' : '完成' }}</text>
          </button>
        </view>
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
      <!-- 课程模式提示 -->
      <view v-if="isCourseMode" class="course-mode-tip">
        <text class="tip-icon">{{ isRollingReview ? '🔄' : '📚' }}</text>
        <view class="tip-content">
          <text class="tip-title">{{ isRollingReview ? '滚动复习模式' : '课程练习模式' }}</text>
          <text class="tip-text">{{ lessonTitle }}</text>
          <text class="tip-hint">{{ isRollingReview ? '综合复习前面课程的所有单词及变位' : '练习范围和设置已根据课程配置自动锁定' }}</text>
        </view>
      </view>
      
      <text class="title">练习设置</text>
      
      <view class="form-item">
        <text class="label">练习类型</text>
        <picker 
          @change="onExerciseTypeChange" 
          :value="exerciseTypeIndex" 
          :range="exerciseTypes" 
          range-key="label"
          :disabled="isCourseMode"
        >
          <view class="picker" :class="{ 'disabled': isCourseMode }">{{ exerciseTypes[exerciseTypeIndex].label }}</view>
        </picker>
      </view>

      <view class="form-item">
        <text class="label">题目数量</text>
        <slider 
          @change="onCountChange" 
          :value="exerciseCount" 
          min="5" 
          max="30" 
          show-value 
          :disabled="isCourseMode"
        />
      </view>

      <!-- 专项练习设置 -->
      <view class="form-item theme-practice-item">
        <view class="theme-header" @click="!isCourseMode && toggleThemeSettings()">
          <view class="theme-header-left">
            <text class="theme-icon">🎯</text>
            <text class="label theme-label">专项练习</text>
            <text v-if="isCourseMode" class="locked-badge">🔒 已锁定</text>
          </view>
          <view class="theme-header-right" v-if="!isCourseMode">
            <text class="expand-icon">{{ themeSettingsExpanded ? '▲' : '▼' }}</text>
          </view>
        </view>
        
        <!-- 专项练习详细设置（可折叠） -->
        <view class="theme-details" v-show="themeSettingsExpanded || isCourseMode">
        
        <!-- 课程模式提示 -->
        <view v-if="isCourseMode" class="course-lock-tip">
          <text class="lock-icon">🔒</text>
          <text class="lock-text">课程练习中无法修改变位类型，以下为课程预设配置</text>
        </view>
        
        <!-- 语气分组选择 -->
        <view class="theme-section">
          <text class="theme-subtitle">语气选择</text>
          <view class="checkbox-group">
            <view 
              :class="['checkbox-item', selectedMoods.includes('indicativo') ? 'checked' : '', isCourseMode ? 'disabled' : '']"
              @click="!isCourseMode && toggleMood('indicativo')"
            >
              <text class="checkbox-icon">{{ selectedMoods.includes('indicativo') ? '☑' : '☐' }}</text>
              <text class="checkbox-label">陈述式（5种时态）</text>
            </view>
            <view 
              :class="['checkbox-item', selectedMoods.includes('subjuntivo') ? 'checked' : '', isCourseMode ? 'disabled' : '']"
              @click="!isCourseMode && toggleMood('subjuntivo')"
            >
              <text class="checkbox-icon">{{ selectedMoods.includes('subjuntivo') ? '☑' : '☐' }}</text>
              <text class="checkbox-label">虚拟式（3种时态）</text>
            </view>
            <view 
              :class="['checkbox-item', selectedMoods.includes('imperativo') ? 'checked' : '', isCourseMode ? 'disabled' : '']"
              @click="!isCourseMode && toggleMood('imperativo')"
            >
              <text class="checkbox-icon">{{ selectedMoods.includes('imperativo') ? '☑' : '☐' }}</text>
              <text class="checkbox-label">命令式（2种时态）</text>
            </view>
            <view 
              :class="['checkbox-item', selectedMoods.includes('indicativo_compuesto') ? 'checked' : '', isCourseMode ? 'disabled' : '']"
              @click="!isCourseMode && toggleMood('indicativo_compuesto')"
            >
              <text class="checkbox-icon">{{ selectedMoods.includes('indicativo_compuesto') ? '☑' : '☐' }}</text>
              <text class="checkbox-label">复合陈述式（5种时态）</text>
            </view>
            <view 
              :class="['checkbox-item', selectedMoods.includes('subjuntivo_compuesto') ? 'checked' : '', isCourseMode ? 'disabled' : '']"
              @click="!isCourseMode && toggleMood('subjuntivo_compuesto')"
            >
              <text class="checkbox-icon">{{ selectedMoods.includes('subjuntivo_compuesto') ? '☑' : '☐' }}</text>
              <text class="checkbox-label">复合虚拟式（3种时态）</text>
            </view>
          </view>
        </view>
        
        <!-- 时态选择（根据选择的语气过滤） -->
        <view class="theme-section" v-if="filteredTenseOptions.length > 0">
          <text class="theme-subtitle">时态选择（可选）</text>
          <view class="checkbox-group">
            <view 
              v-for="(tense, index) in filteredTenseOptions" 
              :key="index"
              :class="['checkbox-item', selectedTenses.includes(tense.value) ? 'checked' : '', isCourseMode ? 'disabled' : '']"
              @click="!isCourseMode && toggleTense(tense.value)"
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
              :class="['checkbox-item', selectedConjugationTypes.includes(type.value) ? 'checked' : '', isCourseMode ? 'disabled' : '']"
              @click="!isCourseMode && toggleConjugationType(type.value)"
            >
              <text class="checkbox-icon">{{ selectedConjugationTypes.includes(type.value) ? '☑' : '☐' }}</text>
              <text class="checkbox-label">{{ type.label }}</text>
            </view>
          </view>
        </view>

        <!-- 动词规则性与人称选项 -->
        <view class="theme-section">
          <text class="theme-subtitle">其他选项</text>
          <view class="checkbox-group">
            <view 
              :class="['checkbox-item', includeRegular ? 'checked' : '', isCourseMode ? 'disabled' : '']"
              @click="!isCourseMode && toggleRegular()"
            >
              <text class="checkbox-icon">{{ includeRegular ? '☑' : '☐' }}</text>
              <text class="checkbox-label">包含规则变位动词</text>
            </view>
            <view 
              :class="['checkbox-item', includeVos ? 'checked' : '', isCourseMode ? 'disabled' : '']"
              @click="!isCourseMode && toggleVos()"
            >
              <text class="checkbox-icon">{{ includeVos ? '☑' : '☐' }}</text>
              <text class="checkbox-label">包含 vos</text>
            </view>
            <view 
              :class="['checkbox-item', includeVosotros ? 'checked' : '', isCourseMode ? 'disabled' : '']"
              @click="!isCourseMode && toggleVosotros()"
            >
              <text class="checkbox-icon">{{ includeVosotros ? '☑' : '☐' }}</text>
              <text class="checkbox-label">包含 vosotros</text>
            </view>
          </view>
        </view>

        <!-- 快速设置 -->
        <view class="quick-settings" v-if="!isCourseMode">
          <text class="quick-label">快速设置：</text>
          <button class="quick-btn" @click="selectAllThemes">全选</button>
          <button class="quick-btn secondary" @click="clearAllThemes">清除</button>
        </view>
        
        </view>
        <!-- 结束 theme-details -->
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
        { value: 'sentence', label: '例句填空' },
        { value: 'quick-fill', label: '快变快填' },
        { value: 'combo-fill', label: '组合填空' }
      ],
      exerciseTypeIndex: 0,
      exerciseType: 'sentence',
      exerciseCount: 10,
      
      // 课程模式相关
      isCourseMode: false,  // 是否为课程模式
      isRollingReview: false, // 是否为滚动复习模式
      lessonId: null,       // 课程ID
      lessonNumber: 1,      // 课程编号（用于滚动复习）
      lessonTitle: '',      // 课程标题
      lessonVocabulary: [], // 课程单词列表
      lessonConfig: null,   // 课程配置（时态、变位类型等）
      defaultCourseCount: 20,  // 开始学习默认题量
      defaultReviewCount: 30,  // 滚动复习默认题量
      
      // 专项练习设置
      tenseOptions: [
        // 简单陈述式（5个）
        { value: 'presente', label: '陈述式-现在时', mood: 'indicativo' },
        { value: 'preterito', label: '陈述式-简单过去时', mood: 'indicativo' },
        { value: 'imperfecto', label: '陈述式-未完成过去时', mood: 'indicativo' },
        { value: 'futuro', label: '陈述式-将来时', mood: 'indicativo' },
        { value: 'condicional', label: '陈述式-条件式', mood: 'indicativo' },
        
        // 虚拟式（3个）
        { value: 'subjuntivo_presente', label: '虚拟式-现在时', mood: 'subjuntivo' },
        { value: 'subjuntivo_imperfecto', label: '虚拟式-过去时', mood: 'subjuntivo' },
        { value: 'subjuntivo_futuro', label: '虚拟式-将来时', mood: 'subjuntivo' },
        
        // 命令式（2个）
        { value: 'imperativo_afirmativo', label: '命令式-肯定', mood: 'imperativo' },
        { value: 'imperativo_negativo', label: '命令式-否定', mood: 'imperativo' },
        
        // 复合陈述式（5个）
        { value: 'perfecto', label: '复合陈述式-现在完成时', mood: 'indicativo_compuesto' },
        { value: 'pluscuamperfecto', label: '复合陈述式-过去完成时', mood: 'indicativo_compuesto' },
        { value: 'futuro_perfecto', label: '复合陈述式-将来完成时', mood: 'indicativo_compuesto' },
        { value: 'condicional_perfecto', label: '复合陈述式-条件完成时', mood: 'indicativo_compuesto' },
        { value: 'preterito_anterior', label: '复合陈述式-先过去时', mood: 'indicativo_compuesto' },
        
        // 复合虚拟式（3个）
        { value: 'subjuntivo_perfecto', label: '复合虚拟式-现在完成时', mood: 'subjuntivo_compuesto' },
        { value: 'subjuntivo_pluscuamperfecto', label: '复合虚拟式-过去完成时', mood: 'subjuntivo_compuesto' },
        { value: 'subjuntivo_futuro_perfecto', label: '复合虚拟式-将来完成时', mood: 'subjuntivo_compuesto' }
      ],
      selectedTenses: [],  // 默认为空，用户自选
      selectedMoods: [],   // 选择的语气（新增）
      
      conjugationTypes: [
        { value: 'ar', label: '第一变位 (-ar)' },
        { value: 'er', label: '第二变位 (-er)' },
        { value: 'ir', label: '第三变位 (-ir)' }
      ],
      selectedConjugationTypes: [],  // 从缓存或默认全选
      
      includeRegular: true,  // 是否包含规则变位动词
      
      // 人称筛选（不显示UI，但通过开关控制）
      includeVos: false,  // 是否包含vos（第二人称单数非正式，拉美）
      includeVosotros: true,  // 是否包含vosotros/vosotras（第二人称复数，西班牙）
      
      // 专项练习折叠状态
      themeSettingsExpanded: false,  // 默认折叠
      
      exercises: [],
      wrongExercises: [],  // 错题队列
      wrongExercisesSet: new Set(),  // 已添加到错题队列的题目集合（避免重复）
      questionPool: [],  // 题目池（用于从题库题中随机抽取）
      usedPoolIndices: new Set(),  // 已使用的题目池索引
      usedQuestionIds: new Set(),  // 已使用的题目ID（包括题库题和AI题）
      currentIndex: 0,
      userAnswer: '',
      selectedAnswer: '',
      comboAnswers: [],  // 组合填空的答案数组
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
      showTranslation: false, // 是否显示翻译
      
      // 题目评价相关
      showRatingButtons: false,  // 是否显示评价按钮（仅错题重做时显示）
      hasRated: false,  // 当前题目是否已评价
      
      // 自定义消息提示
      showCustomMessage: false,
      customMessageText: '',
      messageType: 'success',  // 'success' 或 'error'
      messageTimer: null,
      
      // 练习总结弹窗
      showSummary: false,  // 显示总结弹窗
      summaryData: {       // 总结数据
        total: 0,
        correct: 0,
        wrong: 0,
        accuracy: 0
      }
    }
  },
  onLoad(options) {
    // 获取系统信息，设置状态栏高度
    const systemInfo = uni.getSystemInfoSync()
    this.statusBarHeight = systemInfo.statusBarHeight || 0
    
    // 加载专项练习缓存配置
    this.loadThemeSettings()
    
    // 检查是否为课程模式
    if (options.mode === 'course' && options.lessonId) {
      this.isCourseMode = true
      this.lessonId = options.lessonId
      this.lessonTitle = decodeURIComponent(options.lessonTitle || '课程练习')
      this.exerciseCount = this.defaultCourseCount  // 开始学习使用默认题量20
      this.loadLessonConfig()
    } else if (options.mode === 'rollingReview' && options.lessonId) {
      // 滚动复习模式
      this.isCourseMode = true
      this.isRollingReview = true
      this.lessonId = options.lessonId
      this.lessonNumber = parseInt(options.lessonNumber || 1)
      this.lessonTitle = `滚动复习：第1-${this.lessonNumber}课`
      this.exerciseCount = this.defaultReviewCount  // 滚动复习使用默认题量30
      this.loadRollingReviewConfig()
    } else if (options.mode) {
      // 其他练习模式：favorite: 收藏练习, wrong: 错题练习
      this.practiceMode = options.mode
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
      const types = { sentence: '例句填空', 'quick-fill': '快变快填', 'combo-fill': '组合填空' }
      return types[this.exerciseType] || ''
    },
    // 根据选择的语气过滤时态选项
    filteredTenseOptions() {
      if (this.selectedMoods.length === 0) {
        return this.tenseOptions
      }
      return this.tenseOptions.filter(t => this.selectedMoods.includes(t.mood))
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
    // 加载专项练习缓存配置
    loadThemeSettings() {
      try {
        const cached = uni.getStorageSync('themeSettings')
        if (cached) {
          const settings = JSON.parse(cached)
          this.selectedMoods = settings.selectedMoods || []
          this.selectedTenses = settings.selectedTenses || []
          this.selectedConjugationTypes = settings.selectedConjugationTypes || []
          this.includeRegular = settings.includeRegular !== undefined ? settings.includeRegular : true
          this.includeVos = settings.includeVos !== undefined ? settings.includeVos : false
          this.includeVosotros = settings.includeVosotros !== undefined ? settings.includeVosotros : true
        } else {
          // 没有缓存，默认全选
          this.selectAllThemes()
        }
      } catch (e) {
        // 缓存读取失败，默认全选
        this.selectAllThemes()
      }
    },
    
    // 保存专项练习配置到缓存
    saveThemeSettings() {
      try {
        const settings = {
          selectedMoods: this.selectedMoods,
          selectedTenses: this.selectedTenses,
          selectedConjugationTypes: this.selectedConjugationTypes,
          includeRegular: this.includeRegular,
          includeVos: this.includeVos,
          includeVosotros: this.includeVosotros
        }
        uni.setStorageSync('themeSettings', JSON.stringify(settings))
      } catch (e) {
        console.error('保存设置失败:', e)
      }
    },
    
    // 切换专项练习折叠状态
    toggleThemeSettings() {
      this.themeSettingsExpanded = !this.themeSettingsExpanded
    },
    
    toggleMood(mood) {
      const index = this.selectedMoods.indexOf(mood)
      if (index > -1) {
        this.selectedMoods.splice(index, 1)
        // 取消选择语气时，清除该语气下的所有时态
        this.selectedTenses = this.selectedTenses.filter(t => {
          const tenseOption = this.tenseOptions.find(opt => opt.value === t)
          return tenseOption && tenseOption.mood !== mood
        })
      } else {
        this.selectedMoods.push(mood)
        // 选择语气时，自动选中该语气下的所有时态
        const tensesInMood = this.tenseOptions
          .filter(t => t.mood === mood)
          .map(t => t.value)
        tensesInMood.forEach(tense => {
          if (!this.selectedTenses.includes(tense)) {
            this.selectedTenses.push(tense)
          }
        })
      }
      this.saveThemeSettings()
    },
    
    toggleTense(tense) {
      const index = this.selectedTenses.indexOf(tense)
      if (index > -1) {
        this.selectedTenses.splice(index, 1)
      } else {
        this.selectedTenses.push(tense)
      }
      this.saveThemeSettings()
    },
    
    toggleConjugationType(type) {
      const index = this.selectedConjugationTypes.indexOf(type)
      if (index > -1) {
        this.selectedConjugationTypes.splice(index, 1)
      } else {
        this.selectedConjugationTypes.push(type)
      }
      this.saveThemeSettings()
    },
    
    toggleRegular() {
      this.includeRegular = !this.includeRegular
      this.saveThemeSettings()
    },
    
    toggleVos() {
      this.includeVos = !this.includeVos
      this.saveThemeSettings()
    },
    
    toggleVosotros() {
      this.includeVosotros = !this.includeVosotros
      this.saveThemeSettings()
    },
    
    selectAllThemes() {
      this.selectedMoods = ['indicativo', 'subjuntivo', 'imperativo', 'indicativo_compuesto', 'subjuntivo_compuesto']
      this.selectedTenses = this.tenseOptions.map(t => t.value)
      this.selectedConjugationTypes = this.conjugationTypes.map(c => c.value)
      this.includeRegular = true
      this.includeVos = false  // vos默认不勾选
      this.includeVosotros = true  // vosotros默认勾选
      this.saveThemeSettings()
      showToast('已全选所有选项', 'success')
    },
    
    clearAllThemes() {
      this.selectedMoods = []
      this.selectedTenses = []
      this.selectedConjugationTypes = []
      this.includeRegular = false
      this.includeVos = false
      this.includeVosotros = false
      this.saveThemeSettings()
      showToast('已清除所有选项', 'none')
    },
    
    // 加载课程配置
    async loadLessonConfig() {
      try {
        showLoading('加载课程配置...')
        
        // 获取课程详情
        const lessonRes = await api.getLessonDetail(this.lessonId)
        if (lessonRes.success && lessonRes.lesson) {
          const lesson = lessonRes.lesson
          this.lessonConfig = lesson
          
          // 使用课程的语气和时态设置（课程模式下无法修改）
          if (lesson.moods && lesson.moods.length > 0) {
            this.selectedMoods = lesson.moods
          }
          
          if (lesson.tenses && lesson.tenses.length > 0) {
            this.selectedTenses = lesson.tenses
          }
          
          // 使用课程的变位类型设置（课程模式下无法修改）
          if (lesson.conjugation_types && lesson.conjugation_types.length > 0) {
            this.selectedConjugationTypes = lesson.conjugation_types
          }
          
          console.log('课程配置:', {
            moods: this.selectedMoods,
            tenses: this.selectedTenses,
            conjugationTypes: this.selectedConjugationTypes
          })
        }
        
        // 获取课程单词列表
        const vocabRes = await api.getLessonVocabulary(this.lessonId)
        if (vocabRes.success && vocabRes.vocabulary) {
          this.lessonVocabulary = vocabRes.vocabulary
          console.log('课程单词列表:', this.lessonVocabulary)
        }
        
        hideLoading()
      } catch (error) {
        hideLoading()
        console.error('加载课程配置失败:', error)
        showToast('加载课程失败', 'none')
      }
    },
    
    // 加载滚动复习配置（从第1课到指定课程）
    async loadRollingReviewConfig() {
      try {
        showLoading('加载滚动复习配置...')
        
        // 获取从第1课到当前课的所有单词和合并后的配置
        const vocabRes = await api.getRollingReviewVocabulary(this.lessonId, this.lessonNumber)
        if (vocabRes.success) {
          // 设置单词列表
          if (vocabRes.vocabulary) {
            this.lessonVocabulary = vocabRes.vocabulary
            console.log(`滚动复习单词列表（第1-${this.lessonNumber}课）:`, this.lessonVocabulary)
          }
          
          // 使用后端返回的合并配置（包含所有课程的语气、时态、变位类型）
          if (vocabRes.config) {
            if (vocabRes.config.moods && vocabRes.config.moods.length > 0) {
              this.selectedMoods = vocabRes.config.moods
            }
            
            if (vocabRes.config.tenses && vocabRes.config.tenses.length > 0) {
              this.selectedTenses = vocabRes.config.tenses
            }
            
            if (vocabRes.config.conjugation_types && vocabRes.config.conjugation_types.length > 0) {
              this.selectedConjugationTypes = vocabRes.config.conjugation_types
            }
            
            console.log('滚动复习配置（合并第1-' + this.lessonNumber + '课）:', {
              moods: this.selectedMoods,
              tenses: this.selectedTenses,
              conjugationTypes: this.selectedConjugationTypes,
              vocabularyCount: this.lessonVocabulary.length
            })
          }
        }
        
        hideLoading()
      } catch (error) {
        hideLoading()
        console.error('加载滚动复习配置失败:', error)
        showToast('加载滚动复习失败', 'none')
      }
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
      
      // 验证是否至少选择了一个语气或时态
      if (this.selectedMoods.length === 0 && this.selectedTenses.length === 0) {
        showToast('请至少选择一个语气或时态', 'none')
        return
      }
      
      if (this.selectedConjugationTypes.length === 0) {
        showToast('请至少选择一个变位类型', 'none')
        return
      }
      
      showLoading('正在生成练习...')

      try {
        // 构建请求参数
        const requestData = {
          exerciseType: this.exerciseType,
          count: this.exerciseCount,
          tenses: this.selectedTenses,  // 具体时态（可选）
          moods: this.selectedMoods,     // 语气（新增）
          conjugationTypes: this.selectedConjugationTypes,
          includeRegular: this.includeRegular,
          includeVos: this.includeVos,  // 是否包含vos
          includeVosotros: this.includeVosotros,  // 是否包含vosotros
          practiceMode: this.practiceMode
        }
        
        // 如果是课程模式，传递课程单词ID列表
        if (this.isCourseMode && this.lessonVocabulary.length > 0) {
          requestData.verbIds = this.lessonVocabulary.map(v => v.id)
        }
        
        // 使用新的批量生成接口
        const res = await api.getBatchExercises(requestData)

        hideLoading()

        if (res.success) {
          // 初始化练习
          this.exercises = res.exercises || []
          
          // 接收题目池并立即去重
          const rawPool = res.questionPool || []
          const poolQuestionIds = new Set()
          this.questionPool = []
          
          for (const q of rawPool) {
            if (q.questionId && !poolQuestionIds.has(q.questionId)) {
              poolQuestionIds.add(q.questionId)
              this.questionPool.push(q)
            } else {
              console.warn(`接收到重复题目ID: ${q.questionId}，已过滤`)
            }
          }
          
          console.log(`题目池接收完成:`, {
            原始数量: rawPool.length,
            去重后数量: this.questionPool.length,
            题目IDs: Array.from(poolQuestionIds)
          })
          
          this.usedPoolIndices = new Set()
          this.usedQuestionIds = new Set()  // 重置已使用的题目ID
          this.hasStarted = true
          this.currentIndex = 0
          this.correctCount = 0
          this.totalAnswered = 0
          
          // 从题目池中随机抽取需要的题目添加到exercises中
          this.fillFromQuestionPool()
          
          // 检查是否有足够的题目（题库题或等待AI生成）
          const hasEnoughQuestions = this.exercises.length > 0 || (res.needAI && res.needAI > 0)
          
          if (hasEnoughQuestions) {
            // 如果有题库题，检查第一题的收藏状态
            if (this.exercises.length > 0) {
              // 初始化组合填空的答案数组
              if (this.exerciseType === 'combo-fill' && this.currentExercise.comboItems) {
                this.comboAnswers = new Array(this.currentExercise.comboItems.length).fill('')
              }
              this.checkFavoriteStatus()
              this.checkQuestionFavoriteStatus()
            } else if (res.needAI && res.needAI > 0) {
              // 题库为空，等待AI生成
              console.log('题库为空，等待AI生成题目...')
              showToast('正在生成练习题，请稍候...', 'loading', 3000)
            }
          } else {
            showToast('未能生成练习题，请重试')
            return
          }
          
          // 异步生成AI题目（如果需要）
          if (res.needAI && res.needAI > 0 && res.aiOptions) {
            console.log(`开始异步生成 ${res.needAI} 个AI题目`)
            this.generateAIQuestionsAsync(res.needAI, res.aiOptions)
          }
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
    
    // 异步生成AI题目并随机插入
    async generateAIQuestionsAsync(count, aiOptions) {
      const isFirstBatch = this.exercises.length === 0  // 判断是否是第一批题目（题库为空）
      let successCount = 0  // 成功生成的题目数量
      let failCount = 0     // 失败次数
      
      for (let i = 0; i < count; i++) {
        try {
          console.log(`正在生成第 ${i + 1}/${count} 个AI题目`)
          
          // 显示生成进度
          this.generatingCount = count - i
          
          // 在每次循环中收集已使用的动词ID和题目ID，避免重复
          const usedVerbIds = new Set(this.exercises.map(e => e.verbId).filter(id => id))
          
          // 将已使用的动诋ID传递给后端
          const res = await api.generateSingleAI({ 
            aiOptions: {
              ...aiOptions,
              excludeVerbIds: Array.from(usedVerbIds)
            }
          })
          
          if (res.success && res.exercise) {
            successCount++
            
            // 记录已使用的题目ID
            if (res.exercise.questionId) {
              this.usedQuestionIds.add(res.exercise.questionId)
            }
            
            // 如果是第一批题目，按顺序添加；否则随机插入
            if (isFirstBatch && i === 0) {
              // 第一题直接添加到开头
              this.exercises.push(res.exercise)
              console.log(`第一个AI题目已生成，开始练习`)
              
              // 隐藏加载提示，初始化第一题
              uni.hideToast()
              if (this.exerciseType === 'combo-fill' && this.currentExercise.comboItems) {
                this.comboAnswers = new Array(this.currentExercise.comboItems.length).fill('')
              }
              this.checkFavoriteStatus()
              this.checkQuestionFavoriteStatus()
            } else {
              // 后续题目插入到当前题目之后的位置（避免影响currentIndex）
              // 计算插入位置：在当前题目后面到末尾之间随机选择
              const insertStart = this.currentIndex + 1
              const insertEnd = this.exercises.length + 1
              const randomIndex = insertStart + Math.floor(Math.random() * (insertEnd - insertStart))
              
              this.exercises.splice(randomIndex, 0, res.exercise)
              
              console.log(`AI题目已插入到位置 ${randomIndex}, 当前位置: ${this.currentIndex}, 当前题目总数: ${this.exercises.length}`)
              
              // 注意：因为插入位置在currentIndex之后，所以不需要调整currentIndex
            }
          } else {
            failCount++
            console.error(`生成第 ${i + 1} 个AI题目失败: API返回无效数据`)
          }
        } catch (error) {
          failCount++
          console.error(`生成第 ${i + 1} 个AI题目失败:`, error)
          
          // 如果是第一批题目且前几次都失败了，给用户提示
          if (isFirstBatch && i < 3 && failCount > i) {
            if (i === 2) {
              // 连续3次失败，提示用户
              uni.hideToast()
              uni.showModal({
                title: 'AI生成失败',
                content: 'AI服务当前繁忙，无法生成题目。建议：\n1. 稍后再试\n2. 或先进行其他练习模式\n\n如果题库有数据，将优先使用题库题目。',
                showCancel: false
              })
              this.generatingCount = 0
              return  // 停止继续生成
            }
          }
        }
      }
      
      this.generatingCount = 0
      console.log(`AI题目异步生成完成: 成功 ${successCount}/${count}, 失败 ${failCount}/${count}`)
      
      // 如果是第一批且全部失败，显示错误信息
      if (isFirstBatch && successCount === 0) {
        uni.showModal({
          title: '生成失败',
          content: '无法生成练习题，AI服务可能暂时不可用。\n\n建议：\n1. 检查网络连接\n2. 稍后再试\n3. 或选择其他练习模式',
          showCancel: false,
          success: () => {
            // 返回上一页
            uni.navigateBack()
          }
        })
      }
    },
    
    // 从题目池中随机抽取题目
    fillFromQuestionPool() {
      if (this.questionPool.length === 0) {
        console.log('题目池为空')
        return
      }
      
      // 检查题目池是否有重复的题目ID
      const poolQuestionIds = this.questionPool.map(q => q.questionId)
      const uniquePoolIds = new Set(poolQuestionIds)
      console.log('题目池信息：', {
        poolSize: this.questionPool.length,
        uniqueQuestions: uniquePoolIds.size,
        hasDuplicates: this.questionPool.length !== uniquePoolIds.size,
        currentExercises: this.exercises.length,
        targetCount: this.exerciseCount,
        questionIds: poolQuestionIds
      })
      
      // 计算还需要多少题库题
      const totalNeeded = this.exerciseCount
      const aiCount = this.exercises.length // AI生成的题目
      const bankNeeded = totalNeeded - aiCount // 需要从题库抽取的数量
      
      // 从题目池中随机抽取
      const availableCount = this.questionPool.length - this.usedPoolIndices.size
      const toExtract = Math.min(bankNeeded, availableCount)
      
      console.log('准备从题目池抽取：', { bankNeeded, availableCount, toExtract })
      
      for (let i = 0; i < toExtract; i++) {
        // 找出所有未使用的题目索引
        const unusedIndices = []
        for (let idx = 0; idx < this.questionPool.length; idx++) {
          const q = this.questionPool[idx]
          if (!this.usedPoolIndices.has(idx) && !this.usedQuestionIds.has(q.questionId)) {
            unusedIndices.push(idx)
          }
        }
        
        // 如果没有未使用的题目了，停止抽取
        if (unusedIndices.length === 0) {
          console.warn(`无法找到更多不重复的题目，已抽取 ${i}/${toExtract} 个`)
          break
        }
        
        // 从未使用的题目中随机选择一个
        const randomIdx = Math.floor(Math.random() * unusedIndices.length)
        const randomIndex = unusedIndices[randomIdx]
        const selectedQuestion = this.questionPool[randomIndex]
        
        // 标记为已使用
        this.usedPoolIndices.add(randomIndex)
        this.usedQuestionIds.add(selectedQuestion.questionId)
        
        console.log(`抽取题目 ${i + 1}/${toExtract}:`, {
          index: randomIndex,
          questionId: selectedQuestion.questionId,
          infinitive: selectedQuestion.infinitive
        })
        
        this.exercises.push(selectedQuestion)
      }
      
      // 使用 Fisher-Yates 洗牌算法打乱题目顺序
      for (let i = this.exercises.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[this.exercises[i], this.exercises[j]] = [this.exercises[j], this.exercises[i]]
      }
      
      // 验证打乱后没有重复的题目ID
      const finalQuestionIds = this.exercises.map(e => e.questionId)
      const uniqueFinalIds = new Set(finalQuestionIds)
      console.log('打乱后的题目列表：', {
        count: this.exercises.length,
        uniqueCount: uniqueFinalIds.size,
        hasDuplicates: this.exercises.length !== uniqueFinalIds.size,
        exercises: this.exercises.map(e => ({
          id: e.questionId,
          verb: e.infinitive,
          type: e.exerciseType
        }))
      })
      
      if (this.exercises.length !== uniqueFinalIds.size) {
        console.error('警告：exercises数组中有重复的题目ID！', finalQuestionIds)
      }
    },
    
    // 显示自定义消息提示
    showMessage(text, type = 'success', duration = 3000) {
      // 清除之前的定时器
      if (this.messageTimer) {
        clearTimeout(this.messageTimer)
      }
      
      this.customMessageText = text
      this.messageType = type
      this.showCustomMessage = true
      
      // 自动隐藏
      this.messageTimer = setTimeout(() => {
        this.showCustomMessage = false
      }, duration)
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
    
    // 用户评价题目（好题/坏题）
    async rateQuestion(rating) {
      const ex = this.currentExercise
      
      // 检查是否有题目信息
      if (!ex) {
        showToast('当前没有题目', 'none')
        return
      }
      
      // 检查是否已经评价过
      if (this.hasRated) {
        showToast('已经评价过了', 'none')
        return
      }
      
      // AI新生成的题目可能还没有questionId（正在保存中）
      if (!ex.questionId || !ex.questionSource) {
        showToast('题目信息不完整，请稍后再试', 'none')
        return
      }
      
      try {
        const res = await api.rateQuestion({
          questionId: ex.questionId,
          questionSource: ex.questionSource,
          rating: rating  // 1=好题, -1=坏题
        })
        
        if (res.success) {
          this.hasRated = true
          // 使用自定义消息提示
          this.showMessage(res.message, 'success', 3000)
          // 隐藏评价按钮
          this.showRatingButtons = false
        }
      } catch (error) {
        console.error('评价题目失败:', error)
        showToast('评价失败', 'none')
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
      
      // 如果题目有privateQuestionId，说明已经被收藏过
      if (ex.privateQuestionId) {
        this.isQuestionFavorited = true
        return
      }
      
      // 其他情况默认未收藏
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
          // 如果题目来自私人题库，使用questionId作为privateQuestionId
          // 如果题目是刚收藏的，使用保存的privateQuestionId
          const privateQuestionId = ex.questionSource === 'private' ? ex.questionId : ex.privateQuestionId
          
          if (!privateQuestionId) {
            showToast('无法取消收藏，题目信息不完整', 'none')
            return
          }
          
          const unfavoriteData = {
            privateQuestionId: privateQuestionId
          }
          
          // 如果有关联的公共题库ID，也传递过去
          if (ex.publicQuestionId) {
            unfavoriteData.publicQuestionId = ex.publicQuestionId
          } else if (ex.questionSource === 'public' && ex.questionId) {
            unfavoriteData.publicQuestionId = ex.questionId
          }
          
          const res = await api.unfavoriteQuestion(unfavoriteData)
          if (res.success) {
            this.isQuestionFavorited = false
            // 清除privateQuestionId
            if (ex.privateQuestionId) {
              delete ex.privateQuestionId
            }
            showToast('已取消收藏', 'success')
          }
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
          
          const res = await api.favoriteQuestion(questionData)
          if (res.success && res.privateQuestionId) {
            // 保存privateQuestionId到当前题目，以便后续取消收藏
            ex.privateQuestionId = res.privateQuestionId
            this.isQuestionFavorited = true
            showToast('题目已收藏', 'success')
          }
        }
      } catch (error) {
        console.error('操作题目收藏失败:', error)
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
    
    // 统一处理提交答案和下一题的按钮点击
    handleAnswerAction() {
      if (this.showFeedback) {
        // 已经显示反馈，点击进入下一题
        this.nextExercise()
      } else {
        // 还未提交，点击提交答案
        this.submitAnswer()
      }
    },
    
    async submitAnswer() {
      // 组合填空题的答案处理
      if (this.exerciseType === 'combo-fill') {
        // 检查是否全部填写
        if (this.comboAnswers.some(a => !a || !a.trim())) {
          showToast('请填写所有空格')
          return
        }
        
        try {
          // 批量提交组合填空的答案
          let correctCount = 0
          const items = this.currentExercise.comboItems
          
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            const userAnswer = this.comboAnswers[i].trim()
            
            const res = await api.submitAnswer({
              verbId: this.currentExercise.verbId,
              exerciseType: 'combo-fill',
              answer: userAnswer,
              correctAnswer: item.correctAnswer,
              tense: item.tense,
              mood: item.mood,
              person: item.person
            })
            
            if (res.success && res.isCorrect) {
              correctCount++
              item.isCorrect = true
            } else {
              item.isCorrect = false
            }
          }
          
          // 如果全对才算正确
          this.isCorrect = (correctCount === items.length)
          if (this.isCorrect) {
            this.correctCount++
          } else {
            // 答错了，记录到错题本
            this.recordWrongAnswer()
            
            // 添加到错题队列
            const exerciseKey = `${this.currentExercise.verbId}-combo-fill-${this.currentExercise.mood}`
            if (!this.wrongExercisesSet.has(exerciseKey) && !this.currentExercise.isRetry) {
              this.wrongExercisesSet.add(exerciseKey)
              const retryExercise = { ...this.currentExercise, isRetry: true }
              this.wrongExercises.push(retryExercise)
              console.log('错题已添加到队列，当前错题数:', this.wrongExercises.length)
            }
          }
          
          this.totalAnswered++
          this.showFeedback = true
        } catch (error) {
          showToast('提交失败')
        }
        return
      }
      
      // 其他题型的答案处理
      const answer = this.userAnswer

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
            
            // 添加到错题队列（如果还没添加过）
            const exerciseKey = `${this.currentExercise.verbId}-${this.currentExercise.exerciseType}-${this.currentExercise.tense}-${this.currentExercise.person}`
            if (!this.wrongExercisesSet.has(exerciseKey) && !this.currentExercise.isRetry) {
              this.wrongExercisesSet.add(exerciseKey)
              // 标记为重做题目
              const retryExercise = { ...this.currentExercise, isRetry: true }
              this.wrongExercises.push(retryExercise)
              console.log('错题已添加到队列，当前错题数:', this.wrongExercises.length)
            }
          }
          this.totalAnswered++
          
          // 如果是例句填空且是错题重做，显示评价按钮
          if (this.exerciseType === 'sentence' && this.currentExercise.isRetry) {
            // 只有AI生成的题目或题库题目才显示评价按钮
            if (this.currentExercise.aiGenerated || this.currentExercise.fromQuestionBank) {
              this.showRatingButtons = true
            }
          }
          
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
      this.comboAnswers = []  // 重置组合填空答案
      this.showRatingButtons = false
      this.hasRated = false
      
      // 重置辅助内容显示状态
      this.showExample = false
      this.showHint = false
      this.showTranslation = false

      // 检查是否完成所有初始题目（但还有错题需要重做）
      if (this.totalAnswered >= this.exerciseCount && this.wrongExercises.length > 0) {
        // 显示练习总结弹窗，让用户选择是否重做错题
        console.log('完成原有题目，有', this.wrongExercises.length, '道错题')
        this.showPracticeSummary()
        return
      }

      // 检查是否完成所有题目（包括错题重做）
      if (this.currentIndex + 1 >= this.exercises.length && this.wrongExercises.length === 0) {
        this.showResult = true
        return
      }

      // 检查下一题是否已生成
      if (this.currentIndex + 1 < this.exercises.length) {
        // 下一题已准备好，直接跳转
        this.currentIndex++
        // 初始化组合填空的答案数组
        if (this.exerciseType === 'combo-fill' && this.currentExercise.comboItems) {
          this.comboAnswers = new Array(this.currentExercise.comboItems.length).fill('')
        }
        // 检查新题目的收藏状态
        this.checkFavoriteStatus()
        this.checkQuestionFavoriteStatus()
        // 继续填充缓冲区（只有在非错题重做阶段）
        if (this.totalAnswered < this.exerciseCount) {
          this.fillBuffer()
        }
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
    // 显示练习总结弹窗
    showPracticeSummary() {
      const initialCorrect = this.correctCount
      const initialTotal = this.exerciseCount
      const initialWrong = initialTotal - initialCorrect
      const accuracy = initialTotal > 0 ? Math.round((initialCorrect / initialTotal) * 100) : 0
      
      this.summaryData = {
        total: initialTotal,
        correct: initialCorrect,
        wrong: initialWrong,
        accuracy: accuracy
      }
      
      this.showSummary = true
    },
    
    // 选择重做错题
    startRetryWrong() {
      this.showSummary = false
      console.log('开始重做错题，共', this.wrongExercises.length, '题')
      
      // 将错题添加到exercises数组
      this.exercises.push(...this.wrongExercises)
      // 清空错题队列
      this.wrongExercises = []
      // 更新总题数
      this.exerciseCount = this.exercises.length
      // 继续下一题
      this.currentIndex++
      this.checkFavoriteStatus()
      this.checkQuestionFavoriteStatus()
    },
    
    // 跳过错题重做，直接完成
    skipRetryAndFinish() {
      this.showSummary = false
      // 清空错题队列
      this.wrongExercises = []
      this.wrongExercisesSet.clear()
      // 显示最终结果
      this.showResult = true
    },
    
    finishPractice() {
      // 如果是课程模式，自动标记课程完成
      if (this.isCourseMode && this.lessonId) {
        this.markLessonComplete()
      }
      
      this.showResult = false
      this.showSummary = false
      this.hasStarted = false
      this.exercises = []
      this.currentIndex = 0
      this.correctCount = 0
      this.totalAnswered = 0
      this.generatingCount = 0
      this.generationError = false
      this.wrongExercises = []
      this.wrongExercisesSet.clear()
    },
    
    // 标记课程完成
    async markLessonComplete() {
      try {
        // 根据模式确定完成类型
        const type = this.isRollingReview ? 'review' : 'study'
        await api.markLessonComplete(this.lessonId, type)
        console.log(`课程已标记完成 (${type})`)
      } catch (error) {
        console.error('标记课程完成失败:', error)
        // 不影响用户体验，静默失败
      }
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
  z-index: 1000;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
}

/* 自定义消息提示条 */
.custom-message {
  position: fixed;
  top: calc(var(--status-bar-height) + 88rpx + 10rpx);
  left: 30rpx;
  right: 30rpx;
  padding: 24rpx 30rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  color: #fff;
  text-align: center;
  transform: translateY(-200%);
  opacity: 0;
  transition: all 0.3s ease;
  z-index: 999;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
  line-height: 1.5;
}

.custom-message.show {
  transform: translateY(0);
  opacity: 1;
}

.custom-message.success {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.custom-message.error {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.message-text {
  color: #fff;
  font-weight: 500;
}

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

.header-tags {
  display: flex;
  gap: 15rpx;
  align-items: center;
}

.exercise-type-tag {
  display: inline-block;
  background: #f0f0f0;
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: #666;
}

.retry-tag {
  display: inline-block;
  background: #ff4444;
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: #fff;
  font-weight: bold;
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
  box-sizing: border-box;
}

.answer-input[disabled] {
  opacity: 0.6;
  background: #e8e8e8;
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

/* 内嵌反馈区域样式 */
.inline-feedback {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin: 30rpx 0 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.inline-feedback.correct {
  border-left: 6rpx solid #52c41a;
  background: linear-gradient(135deg, #f6ffed 0%, #ffffff 100%);
}

.inline-feedback.wrong {
  border-left: 6rpx solid #ff4d4f;
  background: linear-gradient(135deg, #fff1f0 0%, #ffffff 100%);
}

.inline-feedback .feedback-header {
  display: flex;
  align-items: center;
  margin-bottom: 15rpx;
}

.inline-feedback .feedback-icon {
  font-size: 48rpx;
  margin-right: 15rpx;
}

.inline-feedback.correct .feedback-icon {
  color: #52c41a;
}

.inline-feedback.wrong .feedback-icon {
  color: #ff4d4f;
}

.inline-feedback .feedback-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.inline-feedback .feedback-detail {
  background: rgba(0, 0, 0, 0.03);
  padding: 20rpx;
  border-radius: 12rpx;
  margin-bottom: 15rpx;
}

.inline-feedback .feedback-detail .label {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 8rpx;
}

.inline-feedback .feedback-detail .answer {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.inline-feedback .rating-buttons {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 2rpx solid rgba(0, 0, 0, 0.06);
}

.inline-feedback .rating-prompt {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 15rpx;
  text-align: center;
}

.inline-feedback .rating-btns {
  display: flex;
  gap: 15rpx;
  justify-content: center;
}

.inline-feedback .rating-btn {
  flex: 1;
  max-width: 200rpx;
  padding: 20rpx;
  border-radius: 12rpx;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: none;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.inline-feedback .rating-btn::after {
  border: none;
}

.inline-feedback .rating-btn.good-btn {
  background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
  color: #fff;
  border: none;
}

.inline-feedback .rating-btn.good-btn:active {
  background: linear-gradient(135deg, #389e0d 0%, #52c41a 100%);
  transform: scale(0.95);
}

.inline-feedback .rating-btn.bad-btn {
  background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%);
  color: #fff;
  border: none;
}

.inline-feedback .rating-btn.bad-btn:active {
  background: linear-gradient(135deg, #cf1322 0%, #ff4d4f 100%);
  transform: scale(0.95);
}

.inline-feedback .rating-icon {
  font-size: 36rpx;
  margin-bottom: 8rpx;
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

/* 课程模式提示 */
.course-mode-tip {
  background: linear-gradient(135deg, #e0e7ff 0%, #f0e7ff 100%);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 30rpx;
  display: flex;
  align-items: flex-start;
  border: 2rpx solid #667eea;
}

.tip-icon {
  font-size: 40rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
}

.tip-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tip-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 8rpx;
}

.tip-text {
  font-size: 26rpx;
  color: #333;
  margin-bottom: 6rpx;
}

.tip-hint {
  font-size: 22rpx;
  color: #999;
}

.locked-badge {
  font-size: 22rpx;
  color: #999;
  margin-left: auto;
  background: #f0f0f0;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}

/* 课程锁定提示 */
.course-lock-tip {
  background: linear-gradient(135deg, #fff4e6 0%, #ffe6e6 100%);
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  border-left: 4rpx solid #ff9800;
}

.lock-icon {
  font-size: 32rpx;
  margin-right: 12rpx;
}

.lock-text {
  font-size: 24rpx;
  color: #d84315;
  line-height: 1.5;
}

.checkbox-item.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.picker.disabled {
  opacity: 0.6;
  background: #f0f0f0;
  cursor: not-allowed;
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
  background: linear-gradient(135deg, #f8f9ff 0%, #fff5fb 100%);
  border: 2rpx solid #e0e7ff;
  border-radius: 16rpx;
  padding: 25rpx;
  margin-bottom: 35rpx;
  box-shadow: 0 4rpx 12rpx rgba(102, 126, 234, 0.08);
  transition: all 0.3s ease;
  position: relative;
}

.theme-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding-bottom: 15rpx;
  border-bottom: 2rpx solid #e0e7ff;
  cursor: pointer;
  transition: all 0.3s ease;
}

.theme-header:active {
  opacity: 0.8;
}

.theme-header-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.theme-header-right {
  display: flex;
  align-items: center;
}

.expand-icon {
  font-size: 24rpx;
  color: #667eea;
  font-weight: bold;
  transition: transform 0.3s ease;
}

.theme-icon {
  font-size: 36rpx;
  margin-right: 12rpx;
}

.theme-label {
  margin-bottom: 0;
  font-size: 30rpx;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.theme-details {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  background: linear-gradient(135deg, #f0e7ff 0%, #e0e7ff 100%);
  border-color: #667eea;
}

.checkbox-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
  color: #999;
}

.checkbox-item.checked .checkbox-icon {
  color: #667eea;
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
  border-top: 2rpx solid #e0e7ff;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  margin-right: 10rpx;
  min-width: auto;
  line-height: 1.4;
}

.quick-btn.secondary {
  background: #fff;
  color: #667eea;
  border: 2rpx solid #667eea;
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

/* 错题重做标记 */
.retry-badge {
  position: absolute;
  top: -15rpx;
  right: 20rpx;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
  color: #fff;
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  font-size: 22rpx;
  box-shadow: 0 4rpx 12rpx rgba(255, 107, 107, 0.3);
  animation: shake 0.5s ease-in-out;
}

.retry-text {
  font-weight: 600;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5rpx); }
  75% { transform: translateX(5rpx); }
}

/* 题目评价按钮 */
.rating-buttons {
  margin-top: 30rpx;
  padding-top: 25rpx;
  border-top: 2rpx dashed rgba(0, 0, 0, 0.1);
  width: 100%;
}

.rating-prompt {
  display: block;
  text-align: center;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 20rpx;
}

.rating-btns {
  display: flex;
  gap: 20rpx;
  justify-content: center;
}

.rating-btn {
  flex: 1;
  max-width: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20rpx;
  border-radius: 12rpx;
  border: none;
  font-size: 26rpx;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.rating-btn::after {
  border: none;
}

.good-btn {
  background: linear-gradient(135deg, #52c41a 0%, #73d13d 100%);
  color: #fff;
}

.good-btn:active {
  background: linear-gradient(135deg, #389e0d 0%, #52c41a 100%);
  transform: scale(0.95);
}

.bad-btn {
  background: linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%);
  color: #fff;
}

.bad-btn:active {
  background: linear-gradient(135deg, #cf1322 0%, #ff4d4f 100%);
  transform: scale(0.95);
}

.rating-icon {
  font-size: 36rpx;
  margin-bottom: 8rpx;
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

/* 练习总结弹窗样式 */
.modal-content.summary {
  padding: 50rpx 40rpx;
}

.summary-title {
  display: block;
  text-align: center;
  font-size: 38rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 40rpx;
}

.summary-stats {
  margin-bottom: 30rpx;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #f0f0f0;
}

.summary-row:last-child {
  border-bottom: none;
}

.summary-label {
  font-size: 28rpx;
  color: #666;
}

.summary-value {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.summary-row.success .summary-value {
  color: #52c41a;
}

.summary-row.error .summary-value {
  color: #ff4d4f;
}

.summary-row.accuracy .summary-value.highlight {
  font-size: 36rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.summary-divider {
  height: 2rpx;
  background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
  margin: 30rpx 0;
}

.summary-question {
  background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
  border-left: 6rpx solid #ff9800;
  padding: 25rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  margin-bottom: 30rpx;
}

.question-icon {
  font-size: 32rpx;
  margin-right: 15rpx;
  flex-shrink: 0;
}

.question-text {
  font-size: 28rpx;
  color: #e65100;
  font-weight: 500;
  line-height: 1.6;
}

.summary-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 10rpx;
}

.summary-actions button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.summary-actions .btn-icon {
  font-size: 28rpx;
}

/* 快变快填样式 */
.given-form-section {
  background: linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 100%);
  border-left: 6rpx solid #2196f3;
  padding: 25rpx;
  border-radius: 12rpx;
  margin-bottom: 30rpx;
}

.given-label {
  display: block;
  font-size: 24rpx;
  color: #1976d2;
  margin-bottom: 10rpx;
  font-weight: 500;
}

.given-form {
  display: block;
  font-size: 40rpx;
  font-weight: bold;
  color: #0d47a1;
  margin-bottom: 8rpx;
}

.given-desc {
  display: block;
  font-size: 24rpx;
  color: #1976d2;
  font-style: italic;
}

/* 组合填空样式 */
.combo-container {
  margin-top: 20rpx;
}

.combo-item {
  background: #f8f9fa;
  border-radius: 12rpx;
  padding: 30rpx 25rpx;
  margin-bottom: 25rpx;
  border: 2rpx solid #e9ecef;
  transition: all 0.3s ease;
}

.combo-item.answered {
  background: #fff;
  border-color: #667eea;
}

.combo-item.correct {
  background: #f6ffed;
  border-color: #52c41a;
}

.combo-item.wrong {
  background: #fff2f0;
  border-color: #ff4d4f;
}

.combo-header {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
  gap: 15rpx;
}

.combo-number {
  font-size: 28rpx;
  color: #999;
  font-weight: bold;
  flex-shrink: 0;
}

.combo-requirement {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-wrap: wrap;
}

.requirement-mood {
  font-size: 24rpx;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.requirement-tense {
  font-size: 24rpx;
  color: #764ba2;
  background: rgba(118, 75, 162, 0.1);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.requirement-person {
  font-size: 24rpx;
  color: #52c41a;
  background: rgba(82, 196, 26, 0.1);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.requirement-divider {
  font-size: 20rpx;
  color: #d9d9d9;
}

.combo-input {
  width: 100%;
  height: 90rpx;
  background: white;
  padding: 25rpx 30rpx;
  border-radius: 12rpx;
  font-size: 32rpx;
  border: 2rpx solid #e0e0e0;
  transition: all 0.3s ease;
  box-sizing: border-box;
  pointer-events: auto;
}

.combo-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 4rpx rgba(102, 126, 234, 0.1);
}

.combo-correct-answer {
  margin-top: 15rpx;
  padding: 15rpx;
  background: #fff3cd;
  border-radius: 8rpx;
  border-left: 4rpx solid #ffc107;
}

.correct-label {
  font-size: 24rpx;
  color: #856404;
  margin-right: 10rpx;
}

.correct-text {
  font-size: 28rpx;
  color: #856404;
  font-weight: bold;
}
</style>
