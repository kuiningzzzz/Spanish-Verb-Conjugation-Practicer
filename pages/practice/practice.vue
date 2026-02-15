<template>
  <view class="page-root">
    <view
      class="container"
      :style="{
        paddingTop: containerPaddingTop,
        paddingBottom: imeVisible ? imeHeight + 'px' : '',
        transform: imeLift ? 'translateY(-' + imeLift + 'px)' : ''
      }"
    >
    <!-- 自定义导航栏 -->
    <view class="custom-navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="navbar-content">
        <view class="navbar-back" @click="goBack">
          <text class="back-icon">←</text>
          <text class="back-text">返回</text>
        </view>
        <view class="navbar-title">开始练习</view>
        <view class="navbar-right" v-if="shouldShowReportButton">
          <view class="report-btn" @click="showReportModal = true">
            <text class="report-icon">⚠️</text>
            <text class="report-text">反馈错误</text>
          </view>
        </view>
        <view class="navbar-placeholder" v-else></view>
      </view>
    </view>
    
    <!-- 自定义消息提示条 -->
    <view class="custom-message" :class="{ 'show': showCustomMessage, 'success': messageType === 'success', 'error': messageType === 'error' }">
      <text class="message-text">{{ customMessageText }}</text>
    </view>
    
    <view class="practice-header" v-if="hasStarted">
      <view class="progress-bar-wrapper">
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: progress + '%' }"></view>
        </view>
        <text class="progress-text">{{ displayProgressCount }} / {{ exerciseCount }}</text>
      </view>
      <view class="progress-actions">
        <button class="progress-btn back" @click="goToPreviousExercise" :disabled="!canGoPrevious">
          <text class="arrow">←</text>
          <text>返回上题</text>
        </button>
        <button class="progress-btn skip" @click="skipCurrentExercise" :disabled="!canSkipCurrent">
          <text>跳过此题</text>
          <text class="arrow">→</text>
        </button>
      </view>
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
          <!-- 收藏题目按钮（仅例句填空） -->
          <view 
            v-if="exerciseType === 'sentence'" 
            class="favorite-action-card"
            :class="{ active: isQuestionFavorited }"
            @click="toggleQuestionFavorite"
          >
            <text class="favorite-action-icon">{{ isQuestionFavorited ? '★' : '☆' }}</text>
            <text class="favorite-action-text">收藏题目</text>
          </view>
          <!-- 收藏单词按钮 -->
          <view
            class="favorite-action-card"
            :class="{ active: isFavorited }"
            @click="toggleFavorite"
          >
            <text class="favorite-action-icon">{{ isFavorited ? '★' : '☆' }}</text>
            <text class="favorite-action-text">收藏单词</text>
          </view>
        </view>
      </view>

      <view class="verb-info">
        <text class="infinitive">{{ currentExercise.infinitive }}{{ currentExercise.isReflexive ? '(se)' : '' }}</text>
        <text class="meaning">{{ currentExercise.meaning }}</text>
      </view>
      <view
        v-if="exerciseType === 'sentence' && currentExercise && currentExercise.questionBank === 'pronoun'"
        class="pronoun-meta"
      >
        <text class="pronoun-meta-item">形式：{{ currentExercise.hostFormZh || '未知' }}</text>
        <text
          v-if="currentExercise.hostForm !== 'prnl'"
          class="pronoun-meta-item"
        >
          代词模式：{{ formatPronounPattern(currentExercise.pronounPattern) || '—' }}
        </text>
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
            v-if="hasHintData(currentExercise)" 
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
        <view class="hint-box" v-if="hasHintData(currentExercise) && showHint">
          <text class="hint-label">💡 提示：</text>
          <text class="hint-text">{{ getHintText(currentExercise) }}</text>
        </view>
        
        <InAppInput
          v-if="useInAppIME"
          :key="`sentence-inapp-${currentIndex}`"
          class="answer-input"
          v-model="userAnswer"
          placeholder="请填入正确的动词变位"
          :disabled="showFeedback"
          :autoFocus="answerInputFocus && !showFeedback"
          inputId="answer-sentence"
          @focus="handleInAppFocus('answer-sentence')"
          @confirm="handleAnswerAction"
        />
        <input
          v-else
          :key="`sentence-native-${currentIndex}`"
          class="answer-input"
          v-model="userAnswer"
          placeholder="请填入正确的动词变位"
          :disabled="showFeedback"
          :focus="answerInputFocus && !showFeedback"
        />
      </view>

      <!-- 快变快填题 -->
      <view v-if="exerciseType === 'quick-fill'" class="input-container">
        <InAppInput
          v-if="useInAppIME"
          :key="`quick-inapp-${currentIndex}`"
          class="answer-input"
          v-model="userAnswer"
          placeholder="请输入目标变位形式"
          :disabled="showFeedback"
          :autoFocus="answerInputFocus && !showFeedback"
          inputId="answer-quick"
          @focus="handleInAppFocus('answer-quick')"
          @confirm="handleAnswerAction"
        />
        <input
          v-else
          :key="`quick-native-${currentIndex}`"
          class="answer-input"
          v-model="userAnswer"
          placeholder="请输入目标变位形式"
          :disabled="showFeedback"
          :focus="answerInputFocus && !showFeedback"
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
          <InAppInput
            v-if="useInAppIME"
            class="combo-input"
            v-model="comboAnswers[index]"
            placeholder="请输入变位形式"
            :disabled="showFeedback"
            :inputId="`combo-input-${index}`"
            :ref="`comboInput-${index}`"
            @focus="handleComboFocus(index)"
            @confirm="onComboConfirm(index)"
          />
          <input
            v-else
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

      <button class="btn-primary mt-20 answer-action-btn" @click="handleAnswerAction">{{ showFeedback ? '下一题' : '提交答案' }}</button>

      <!-- 题目生成状态指示器 -->
      <view class="ai-status" v-if="showAiGeneratingStatus">
        <view class="ai-status-icon">🤖</view>
        <text class="ai-status-text">正在生成第 {{ aiGeneratingStart }}-{{ aiGeneratingEnd }} 题...</text>
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

    <!-- 题目反馈弹窗 -->
    <view class="modal" v-if="showReportModal" @click="showReportModal = false">
      <view class="modal-content report-modal" @click.stop>
        <text class="report-title">📝 反馈题目错误</text>
        <text class="report-subtitle">帮助我们改进题目质量</text>
        
        <view class="report-info">
          <view class="info-row">
            <text class="info-label">题型：</text>
            <text class="info-value">{{ exerciseTypeText }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">动词：</text>
            <text class="info-value">{{ currentExercise ? currentExercise.infinitive : '' }}</text>
          </view>
          <view class="info-row" v-if="currentExercise && exerciseType !== 'combo-fill'">
            <text class="info-label">答案：</text>
            <text class="info-value">{{ currentExercise.correctAnswer }}</text>
          </view>
        </view>
        
        <view class="issue-types-section">
          <text class="section-label">问题类型（可多选）</text>
          <view class="issue-types-grid">
            <view 
              v-for="(issue, index) in issueTypeOptions" 
              :key="index"
              class="issue-type-item"
              :class="{ 'selected': selectedIssueTypes.includes(issue.value) }"
              @click="toggleIssueType(issue.value)"
            >
              <text class="issue-checkbox">{{ selectedIssueTypes.includes(issue.value) ? '☑' : '☐' }}</text>
              <text class="issue-label">{{ issue.label }}</text>
            </view>
          </view>
        </view>
        
        <view class="report-input-section">
          <text class="input-label">问题描述{{ selectedIssueTypes.includes('other') ? '（必填）' : '（选填）' }}</text>
          <textarea
            class="report-textarea"
            v-model="reportComment"
            placeholder="请详细描述遇到的问题..."
            :maxlength="500"
          />
          <text class="char-count">{{ reportComment.length }}/500</text>
        </view>
        
        <view class="report-actions">
          <button class="btn-secondary" @click="showReportModal = false">取消</button>
          <button class="btn-primary" @click="submitReport">提交反馈</button>
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
          <text class="result-number">{{ answeredCount }}</text>
          <text class="result-label">作答题数</text>
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
    <view
      class="settings-card card"
      v-if="!hasStarted"
      @touchstart="handleExerciseTypeSwipeStart"
      @touchend="handleExerciseTypeSwipeEnd"
      @touchcancel="resetExerciseTypeSwipeState"
    >
      <!-- 课程模式提示 -->
      <view v-if="isCourseMode" class="course-mode-tip">
        <text class="tip-icon">{{ isRollingReview ? '🔄' : '📚' }}</text>
        <view class="tip-content">
          <text class="tip-title">{{ isRollingReview ? '滚动复习模式' : '课程练习模式' }}</text>
          <text class="tip-text">{{ lessonTitle }}</text>
          <text class="tip-hint">{{ isRollingReview ? '综合复习前面课程的所有单词及变位' : '练习范围和设置已根据课程配置自动锁定' }}</text>
        </view>
      </view>
      
      <!-- 练习类型导航栏 -->
      <view class="exercise-type-navbar" :class="{ 'disabled': isCourseMode }">
        <view 
          v-for="(type, index) in exerciseTypes" 
          :key="type.value"
          class="navbar-item" 
          :class="{ 'active': exerciseTypeIndex === index, 'disabled': isCourseMode || isExerciseTypeDisabled(type.value) }"
          @click="handleExerciseTypeClick(index)"
        >
          <text class="navbar-item-text">{{ type.label }}</text>
        </view>
      </view>
      
      <!-- 大圆形开始按钮 -->
      <view class="start-button-container">
        <view class="big-circle-button" @click="startPractice">
          <text class="button-type">{{ exerciseTypes[exerciseTypeIndex].label }}</text>
          <text class="button-action">开始练习</text>
        </view>
        <view class="mode-help-button" @click="openExerciseModeModal">
          <text class="mode-help-button-text">?</text>
        </view>
      </view>

      <view v-if="exerciseType === 'sentence'" class="form-item theme-practice-item sentence-mode-practice-item">
        <view class="sentence-mode-header">
          <view class="sentence-mode-header-left">
            <text class="label theme-label sentence-mode-title">模式选择：</text>
            <view class="mode-info-button" @click.stop="openSentenceModeInfoModal">
              <text class="mode-info-button-text">i</text>
            </view>
          </view>
          <text v-if="isCourseMode" class="locked-badge sentence-mode-locked">🔒 已锁定</text>
        </view>
        <view class="exercise-type-navbar sentence-mode-navbar" :class="{ 'disabled': isCourseMode }">
          <view
            v-for="mode in sentenceModeOptions"
            :key="mode.value"
            class="navbar-item sentence-mode-navbar-item"
            :class="{ active: selectedSentenceMode === mode.value, disabled: isCourseMode }"
            @click="!isCourseMode && selectSentenceMode(mode.value)"
          >
            <text class="navbar-item-text sentence-mode-navbar-item-text">{{ mode.label }}</text>
          </view>
        </view>
      </view>

      <view class="form-item theme-practice-item count-practice-item">
        <view class="count-header">
          <text class="label theme-label">题目数量</text>
          <text v-if="isCourseMode" class="locked-badge">🔒 已锁定</text>
        </view>
        <view :class="['count-selector', { disabled: isCourseMode }]">
          <button
            class="count-btn"
            :disabled="isCourseMode || exerciseCount <= minExerciseCount"
            @click="changeExerciseCount(-exerciseCountStep)"
          >
            -
          </button>
          <view class="count-display">
            <text class="count-value">{{ exerciseCount }}</text>
          </view>
          <button
            class="count-btn"
            :disabled="isCourseMode || exerciseCount >= maxExerciseCount"
            @click="changeExerciseCount(exerciseCountStep)"
          >
            +
          </button>
        </view>
      </view>

      <!-- 语气与时态设置 -->
      <view v-if="showThemeTenseSelector" class="form-item theme-practice-item">
        <view class="theme-header" @click="!isCourseMode && toggleThemeSettings()">
          <view class="theme-header-left">
            <text class="label theme-label">语气与时态选择</text>
            <text v-if="isCourseMode" class="locked-badge">🔒 已锁定</text>
          </view>
          <view class="theme-header-right" v-if="!isCourseMode">
            <text class="expand-icon">{{ themeSettingsExpanded ? '▲' : '▼' }}</text>
          </view>
        </view>
        
        <!-- 语气与时态详细设置（可折叠） -->
        <view class="theme-details" v-show="themeSettingsExpanded || isCourseMode">
        
        <!-- 课程模式提示 -->
        <view v-if="isCourseMode" class="course-lock-tip">
          <text class="lock-icon">🔒</text>
          <text class="lock-text">课程练习中无法修改时态设置，以下为课程预设配置</text>
        </view>
        
        <!-- 语气分组选择 -->
        <view class="theme-section">
          <view class="mood-accordion">
            <view
              v-for="(mood, index) in moodOptions"
              :key="index"
              class="mood-panel"
            >
              <view class="mood-panel-header" @click="toggleMoodPanel(mood.value)">
                <text class="mood-panel-title">{{ mood.label }}</text>
                <view class="mood-panel-right">
                  <text class="mood-panel-count">已选{{ getSelectedTenseCountByMood(mood.value) }}项</text>
                  <text class="expand-icon">{{ isMoodPanelExpanded(mood.value) ? '▲' : '▼' }}</text>
                </view>
              </view>

              <view v-if="isMoodPanelExpanded(mood.value)" class="mood-panel-body">
                <view class="mood-actions">
                  <button
                    class="quick-btn"
                    :disabled="isCourseMode"
                    @click.stop="selectAllTensesInMood(mood.value)"
                  >
                    全选
                  </button>
                  <button
                    class="quick-btn secondary"
                    :disabled="isCourseMode"
                    @click.stop="clearTensesInMood(mood.value)"
                  >
                    清除
                  </button>
                </view>

                <view class="checkbox-group">
                  <view
                    v-for="(tense, tIndex) in getTensesByMood(mood.value)"
                    :key="`${mood.value}-${tIndex}`"
                    :class="['checkbox-item', selectedTenses.includes(tense.value) ? 'checked' : '', isCourseMode ? 'disabled' : '']"
                    @click="!isCourseMode && toggleTense(tense.value)"
                  >
                    <text class="checkbox-icon">{{ selectedTenses.includes(tense.value) ? '☑' : '☐' }}</text>
                    <text :class="['checkbox-label', isDimmedTense(tense.value) ? 'checkbox-label-dimmed' : '']">{{ tense.label }}</text>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>
        </view>
        <!-- 结束 theme-details -->
      </view>

      <!-- 变位形式设置 -->
      <view v-if="showConjugationFormSelector" class="form-item theme-practice-item">
        <view class="theme-header" @click="!isCourseMode && toggleConjugationFormSettings()">
          <view class="theme-header-left">
            <text class="label theme-label">带代词变位形式选择</text>
            <text v-if="isCourseMode" class="locked-badge">🔒 已锁定</text>
          </view>
          <view class="theme-header-right" v-if="!isCourseMode">
            <text class="expand-icon">{{ conjugationFormSettingsExpanded ? '▲' : '▼' }}</text>
          </view>
        </view>
        <view class="theme-details" v-show="conjugationFormSettingsExpanded || isCourseMode">
          <view class="theme-section">
            <view class="checkbox-group">
              <view
                v-for="form in conjugationFormOptions"
                :key="form.value"
                :class="['checkbox-item', selectedConjugationForms.includes(form.value) ? 'checked' : '', isCourseMode ? 'disabled' : '']"
                @click="!isCourseMode && toggleConjugationForm(form.value)"
              >
                <text class="checkbox-icon">{{ selectedConjugationForms.includes(form.value) ? '☑' : '☐' }}</text>
                <text class="checkbox-label">{{ form.label }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 其他选项 -->
      <view v-if="showOtherOptionsSelector" class="form-item theme-practice-item">
        <view class="theme-header" @click="!isCourseMode && toggleOtherSettings()">
          <view class="theme-header-left">
            <text class="label theme-label">其他选项</text>
            <text v-if="isCourseMode" class="locked-badge">🔒 已锁定</text>
          </view>
          <view class="theme-header-right" v-if="!isCourseMode">
            <text class="expand-icon">{{ otherSettingsExpanded ? '▲' : '▼' }}</text>
          </view>
        </view>

        <view class="theme-details" v-show="otherSettingsExpanded || isCourseMode">
          <view class="other-option-item">
            <view class="other-option-info">
              <text class="other-option-title">包含规则变位动词</text>
              <text class="other-option-desc">关闭后，将只练习不规则动词</text>
            </view>
            <switch
              :checked="includeRegular"
              :disabled="isCourseMode"
              @change="onIncludeRegularChange"
              color="#8B0012"
            />
          </view>
        </view>
      </view>
    </view>

    <!-- 练习模式说明弹窗 -->
    <view class="modal" v-if="showExerciseModeModal" @click="closeExerciseModeModal">
      <view class="modal-content exercise-mode-modal" @click.stop>
        <text class="exercise-mode-modal-title">练习模式说明</text>
        <view class="exercise-mode-list">
          <view class="exercise-mode-item">
            <text class="exercise-mode-item-title">{{ currentExerciseModeInfo.label }}</text>
            <text class="exercise-mode-item-desc">{{ currentExerciseModeInfo.description }}</text>
          </view>
        </view>
        <button class="btn-primary mt-20" @click="closeExerciseModeModal">我知道了</button>
      </view>
    </view>

    <view class="modal" v-if="showSentenceModeInfoModal" @click="closeSentenceModeInfoModal">
      <view class="modal-content exercise-mode-modal" @click.stop>
        <text class="exercise-mode-modal-title">例句填空模式说明</text>
        <view class="exercise-mode-list">
          <view
            v-for="mode in sentenceModeOptions"
            :key="mode.value"
            class="exercise-mode-item"
          >
            <text class="exercise-mode-item-title">{{ mode.label }}</text>
            <text class="exercise-mode-item-desc">{{ mode.description }}</text>
          </view>
        </view>
        <button class="btn-primary mt-20" @click="closeSentenceModeInfoModal">我知道了</button>
      </view>
    </view>

  </view>
  <InAppKeyboardHost
    @height-change="onImeHeightChange"
    @visibility-change="onImeVisibilityChange"
    @popup-height-change="onImePopupHeightChange"
  />
</view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast, showLoading, hideLoading } from '@/utils/common.js'
import {
  getPronounSettings,
  getPracticeGenerationSettings,
  getPracticeTenseSelectionSettings
} from '@/utils/settings.js'
import { getUseInAppIME, subscribeUseInAppIME } from '@/utils/ime/settings-store.js'
import { setActiveTarget } from '@/utils/ime/focus-controller.js'
import InAppInput from '@/components/inapp-ime/InAppInput.vue'
import InAppKeyboardHost from '@/components/inapp-ime/InAppKeyboardHost.vue'

export default {
  components: {
    InAppInput,
    InAppKeyboardHost
  },
  data() {
    return {
      fromRegister: false, // 是否从注册页面跳转过来
      useInAppIME: getUseInAppIME(),
      imeVisible: false,
      imeHeight: 0,
      imePopupHeight: 0,
      imeLift: 0,
      focusedInputId: '',
      focusedComboIndex: null,
      exerciseTypeSwipeStartX: 0,
      exerciseTypeSwipeStartY: 0,
      isExerciseTypeSwipeTracking: false,
      statusBarHeight: 0, // 状态栏高度
      hasStarted: false,
      exerciseTypes: [
        { value: 'sentence', label: '例句填空' },
        { value: 'quick-fill', label: '快变快填' },
        { value: 'combo-fill', label: '组合填空' }
      ],
      exerciseModeDescriptions: [
        {
          value: 'sentence',
          label: '例句填空',
          description: '在真实语境的例句中填入正确的动词变位形式，通过上下文理解和运用动词变位，提升实战能力。'
        },
        {
          value: 'quick-fill',
          label: '快变快填',
          description: '给出一个已知动词，要求快速变换到另一个指定的时态、语气和人称，锻炼变位形式之间的快速转换能力。'
        },
        {
          value: 'combo-fill',
          label: '组合填空',
          description: '一次性完成同一个动词的六个不同时态、语气和人称的变位填空，全面考查对动词变位体系的掌握程度。'
        }
      ],
      sentenceModeOptions: [
        {
          value: 'verb-only',
          label: '纯动词变位',
          description: '纯动词例句填空，请根据例句上下文判断你要填入的时态和人称变位。'
        },
        {
          value: 'with-pronoun',
          label: '带代词变位',
          description: '“动词+代词”组合填空，支持一般/命令式/原形/副动词/自反等形式，并按上下文判断格、性、数与位置。'
        },
        {
          value: 'mixed',
          label: '混合模式',
          description: '纯动词变位与带代词变位混合出题。'
        }
      ],
      exerciseTypeIndex: 0,
      exerciseType: 'sentence',
      showExerciseModeModal: false,
      showSentenceModeInfoModal: false,
      selectedSentenceMode: 'verb-only',
      conjugationFormOptions: [
        { value: 'general', label: '一般变位' },
        { value: 'imperative', label: '命令式' },
        { value: 'infinitive', label: '动词原形' },
        { value: 'gerund', label: '副动词' },
        { value: 'reflexive', label: '自反动词' }
      ],
      selectedConjugationForms: ['general', 'imperative', 'infinitive', 'gerund', 'reflexive'],
      exerciseCount: 10,
      minExerciseCount: 5,
      maxExerciseCount: 50,
      exerciseCountStep: 5,
      
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
      // 自定义动词练习
      isCustomPractice: false,
      hasExplicitVerbIds: false,
      isSingleVerbPractice: false,
      customVerbIds: [],
      // 专项练习设置
      moodOptions: [
        { value: 'indicativo', label: 'Indicativo 陈述式' },
        { value: 'subjuntivo', label: 'Subjuntivo 虚拟式' },
        { value: 'condicional', label: 'Condicional 条件式' },
        { value: 'imperativo', label: 'Imperativo 命令式' }
      ],
      tenseOptions: [
        // Indicativo 陈述式（8个）
        { value: 'presente', label: 'Presente（陈述式 一般现在时）', mood: 'indicativo' },
        { value: 'perfecto', label: 'Pretérito Perfecto（陈述式 现在完成时）', mood: 'indicativo' },
        { value: 'imperfecto', label: 'Pretérito Imperfecto（陈述式 过去未完成时）', mood: 'indicativo' },
        { value: 'preterito', label: 'Pretérito Indefinido（陈述式 简单过去时）', mood: 'indicativo' },
        { value: 'futuro', label: 'Futuro Imperfecto（陈述式 将来未完成时）', mood: 'indicativo' },
        { value: 'pluscuamperfecto', label: 'Pretérito Pluscuamperfecto（陈述式 过去完成时）', mood: 'indicativo' },
        { value: 'futuro_perfecto', label: 'Futuro Perfecto（陈述式 将来完成时）', mood: 'indicativo' },
        { value: 'preterito_anterior', label: 'Pretérito Anterior（陈述式 前过去时）', mood: 'indicativo' },

        // Subjuntivo 虚拟式（6个）
        { value: 'subjuntivo_presente', label: 'Presente（虚拟式 现在时）', mood: 'subjuntivo' },
        { value: 'subjuntivo_imperfecto', label: 'Pretérito Imperfecto（虚拟式 过去未完成时）', mood: 'subjuntivo' },
        { value: 'subjuntivo_perfecto', label: 'Pretérito Perfecto（虚拟式 现在完成时）', mood: 'subjuntivo' },
        { value: 'subjuntivo_pluscuamperfecto', label: 'Pretérito Pluscuamperfecto（虚拟式 过去完成时）', mood: 'subjuntivo' },
        { value: 'subjuntivo_futuro', label: 'Futuro（虚拟式 将来未完成时）', mood: 'subjuntivo' },
        { value: 'subjuntivo_futuro_perfecto', label: 'Futuro Perfecto（虚拟式 将来完成时）', mood: 'subjuntivo' },

        // Condicional 条件式（2个）
        { value: 'condicional', label: 'Condicional Simple（简单条件式）', mood: 'condicional' },
        { value: 'condicional_perfecto', label: 'Condicional Compuesto（复合条件式）', mood: 'condicional' },

        // Imperativo 命令式（2个）
        { value: 'imperativo_afirmativo', label: 'Imperativo（命令式）', mood: 'imperativo' },
        { value: 'imperativo_negativo', label: 'Imperativo Negativo（否定命令式）', mood: 'imperativo' }
      ],
      selectedTenses: [],  // 默认为空，用户自选
      selectedMoods: [],   // 选择的语气（新增）
      expandedMoodPanels: {}, // 语气面板展开状态
      
      includeRegular: true,  // 是否包含规则变位动词
      
      // 人称筛选（不显示UI，但通过开关控制）
      includeVos: false,  // 是否包含vos（第二人称单数非正式，拉美）
      includeVosotros: true,  // 是否包含vosotros/vosotras（第二人称复数，西班牙）
      reduceRareTenseFrequency: true, // 是否减少罕见时态出现
      
      // 专项练习折叠状态
      themeSettingsExpanded: false,  // 默认折叠
      conjugationFormSettingsExpanded: false,  // 带代词变位形式默认折叠
      otherSettingsExpanded: false, // 其他选项默认折叠
      
      exercises: [],
      wrongExercises: [],  // 错题队列
      wrongExercisesSet: new Set(),  // 已添加到错题队列的题目集合（避免重复）
      questionPool: [],  // 题目池（用于从题库题中随机抽取）
      mainQuestionPool: [],  // 主要题目池（85%）
      backupQuestionPool: [],  // 备用题目池（15%）
      hasEnoughInBank: false,  // 题库是否有足够的题目
      usedPoolIndices: new Set(),  // 已使用的题目池索引
      usedQuestionIds: new Set(),  // 已使用的题目ID（包括题库题和AI题）
      currentIndex: 0,
      userAnswer: '',
      answerInputFocus: false,  // 控制填空输入框的聚焦
      selectedAnswer: '',
      comboAnswers: [],  // 组合填空的答案数组
      showFeedback: false,
      showResult: false,
      isCorrect: false,
      correctCount: 0,
      // 流水线相关
      generatingCount: 0,  // 正在生成的题目数量（支持并发）
      generationError: false,  // 生成是否出错
      bufferSize: 2,  // 缓冲区大小：保持提前生成2题
      maxConcurrent: 2,  // 最大并发生成数

      // 题目状态记录
      questionStates: [],

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
      },

      // 返回控制
      allowNavigateBack: false,
      
      // 题目反馈相关
      showReportModal: false,  // 显示反馈弹窗
      reportComment: '',       // 反馈内容
      issueTypeOptions: [      // 问题类型选项
        { value: 'wrong_answer', label: '答案有误' },
        { value: 'multiple_solutions', label: '一题多解' },
        { value: 'inappropriate', label: '内容不适' },
        { value: 'other', label: '其他问题' }
      ],
      selectedIssueTypes: [],  // 选中的问题类型
      unsubscribeImeSetting: null
    }
  },
  onLoad(options) {
    // 获取系统信息，设置状态栏高度
    const systemInfo = uni.getSystemInfoSync()
    this.statusBarHeight = systemInfo.statusBarHeight || 0

    // 检查是否从注册页面跳转而来
    if (options.fromRegister === 'true') {
      this.fromRegister = true
    }

    this.initMoodPanels()
    // 每次进入页面重置时态勾选（灰色时态默认不勾选）
    this.resetThemeSelections()
    this.loadPronounSettings()
    this.loadPracticeGenerationSettings()
    
    // 检查是否为课程模式
    if (options.mode === 'course' && options.lessonId) {
      this.isCourseMode = true
      this.lessonId = options.lessonId
      this.lessonTitle = decodeURIComponent(options.lessonTitle || '课程练习')
      this.setExerciseCount(this.defaultCourseCount)  // 开始学习使用默认题量20
      this.loadLessonConfig()
    } else if (options.mode === 'rollingReview' && options.lessonId) {
      // 滚动复习模式
      this.isCourseMode = true
      this.isRollingReview = true
      this.lessonId = options.lessonId
      this.lessonNumber = parseInt(options.lessonNumber || 1)
      this.lessonTitle = `滚动复习：第1-${this.lessonNumber}课`
      this.setExerciseCount(this.defaultReviewCount)  // 滚动复习使用默认题量30
      this.loadRollingReviewConfig()
    } else if (options.mode) {
      // 其他练习模式：favorite: 收藏练习, wrong: 错题练习
      this.practiceMode = options.mode
    }
        if (options.practiceMode) {
      this.practiceMode = options.practiceMode
    }
    if (options.verbIds) {
      this.customVerbIds = options.verbIds
        .split(',')
        .map(id => parseInt(id))
        .filter(id => !Number.isNaN(id))
      this.hasExplicitVerbIds = this.customVerbIds.length > 0
    }
    if (options.singleVerbPractice === 'true') {
      this.isSingleVerbPractice = true
    }
    if (this.practiceMode === 'custom' && this.customVerbIds.length > 0) {
      this.isCustomPractice = true
      this.exerciseTypes = this.exerciseTypes.filter(type => type.value !== 'sentence')
      if (this.exerciseTypes.length > 0) {
        this.exerciseTypeIndex = 0
        this.exerciseType = this.exerciseTypes[0].value
      }
    }
    if (this.shouldDisableSentenceInCurrentMode()) {
      this.resetExerciseTypeForSentenceDisabledMode()
    }
    this.setExerciseCount(this.exerciseCount)
  },
  onShow() {
    if (!this.hasStarted && !this.isCourseMode) {
      this.resetThemeSelections()
    }
    this.loadPronounSettings()
    this.loadPracticeGenerationSettings()
    if (!this.unsubscribeImeSetting) {
      this.unsubscribeImeSetting = subscribeUseInAppIME((value) => {
        this.useInAppIME = value
        if (!value) {
          setActiveTarget(null)
        }
      })
    }
  },
  onHide() {
    setActiveTarget(null)
  },
  onUnload() {
    setActiveTarget(null)
    if (this.unsubscribeImeSetting) {
      this.unsubscribeImeSetting()
      this.unsubscribeImeSetting = null
    }
  },
  onBackPress() {
    if (this.imeVisible) {
      setActiveTarget(null)
      return true
    }
    if (this.allowNavigateBack) {
      return false
    }
    if (this.hasStarted) {
      this.goBack()
      return true
    }
    return false
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
      currentQuestionState() {
        return this.questionStates[this.currentIndex] || null
      },
      shouldShowReportButton() {
        if (!this.hasStarted) return false
        const state = this.currentQuestionState
        return state ? state.status === 'answered' || state.showFeedback : false
      },
      answeredCount() {
        return this.questionStates.filter(s => s.status === 'answered').length
      },
      skippedCount() {
        return this.questionStates.filter(s => s.status === 'skipped').length
      },
      completedCount() {
        return this.answeredCount + this.skippedCount
      },
      displayProgressCount() {
        if (!this.hasStarted || this.exerciseCount <= 0) return 0
        if (!this.currentExercise) {
          return Math.min(this.completedCount, this.exerciseCount)
        }
        return Math.min(this.currentIndex + 1, this.exerciseCount)
      },
      progress() {
        return this.exerciseCount ? (this.displayProgressCount / this.exerciseCount) * 100 : 0
      },
      accuracy() {
        return this.answeredCount ? Math.round((this.correctCount / this.answeredCount) * 100) : 0
      },
      canGoPrevious() {
        return this.hasStarted && this.currentIndex > 0
      },
      canSkipCurrent() {
        return this.hasStarted && this.currentExercise && !this.showFeedback
      },
      currentExerciseModeInfo() {
        return this.exerciseModeDescriptions.find((mode) => mode.value === this.exerciseType) || {
          label: '',
          description: ''
        }
      },
      exerciseTypeText() {
        const types = { sentence: '例句填空', 'quick-fill': '快变快填', 'combo-fill': '组合填空' }
        if (this.exerciseType === 'sentence') {
          if (this.currentExercise && this.currentExercise.hostForm) return '带代词变位'
          const questionBank = this.currentExercise && this.currentExercise.questionBank
          if (questionBank === 'pronoun') return '带代词变位'
          if (questionBank === 'traditional') return '纯动词变位'
          if (this.currentExercise) return '纯动词变位'
          if (this.selectedSentenceMode === 'with-pronoun') return '带代词变位'
          if (this.selectedSentenceMode === 'verb-only') return '纯动词变位'
        }
        return types[this.exerciseType] || ''
      },
      isSentenceWithPronounMode() {
        return this.exerciseType === 'sentence' && this.selectedSentenceMode === 'with-pronoun'
      },
      showThemeTenseSelector() {
        return !this.isSentenceWithPronounMode
      },
      showConjugationFormSelector() {
        return this.exerciseType === 'sentence'
          && (this.selectedSentenceMode === 'with-pronoun' || this.selectedSentenceMode === 'mixed')
      },
      showOtherOptionsSelector() {
        return !this.isSentenceWithPronounMode
      },
      remainingExerciseSlots() {
        return Math.max(this.exerciseCount - this.exercises.length, 0)
      },
      effectiveGeneratingCount() {
        return Math.min(this.generatingCount, this.remainingExerciseSlots)
      },
      showAiGeneratingStatus() {
        return this.effectiveGeneratingCount > 0
      },
      aiGeneratingStart() {
        if (this.exerciseCount <= 0) return 0
        return Math.min(this.exercises.length + 1, this.exerciseCount)
      },
      aiGeneratingEnd() {
        if (this.exerciseCount <= 0) return 0
        return Math.min(this.exercises.length + this.effectiveGeneratingCount, this.exerciseCount)
      }
    },
  watch: {
    showFeedback(value) {
      if (value) {
        setActiveTarget(null)
      }
    }
  },
  methods: {
  onImeHeightChange(height) {
    this.imeHeight = height || 0
    if (this.imeVisible && this.focusedInputId) {
      this.$nextTick(() => {
        this.ensureInputVisible(this.focusedInputId)
      })
    }
  },
  onImePopupHeightChange(height) {
    this.imePopupHeight = height || 0
    if (this.imeVisible && this.focusedInputId) {
      this.$nextTick(() => {
        this.ensureInputVisible(this.focusedInputId)
      })
    }
  },
    onImeVisibilityChange(visible) {
      this.imeVisible = visible
      if (!visible) {
        this.imeLift = 0
        this.imePopupHeight = 0
      }
      if (visible && this.focusedInputId) {
        this.$nextTick(() => {
          this.ensureInputVisible(this.focusedInputId)
        })
      }
    },
    handleInAppFocus(inputId) {
      this.focusedInputId = inputId
      this.ensureInputVisible(inputId)
    },
    handleComboFocus(index) {
      this.focusedComboIndex = index
      this.handleInAppFocus(`combo-input-${index}`)
    },
    onComboConfirm(index) {
      if (this.exerciseType !== 'combo-fill') {
        this.handleAnswerAction()
        return
      }
      const nextIndex = this.findNextEmptyCombo(index)
      if (nextIndex === null) {
        this.handleAnswerAction()
        return
      }
      this.focusComboInput(nextIndex)
    },
    findNextEmptyCombo(currentIndex) {
      const items = Array.isArray(this.comboAnswers) ? this.comboAnswers : []
      if (!items.length) return null
      const emptyIndexes = []
      for (let i = 0; i < items.length; i += 1) {
        const value = items[i]
        if (!value || !value.trim()) {
          emptyIndexes.push(i)
        }
      }
      if (emptyIndexes.length === 0) return null
      const afterCurrent = emptyIndexes.find(index => index > currentIndex)
      return afterCurrent !== undefined ? afterCurrent : emptyIndexes[0]
    },
    focusComboInput(index) {
      const refKey = `comboInput-${index}`
      const ref = this.$refs[refKey]
      const instance = Array.isArray(ref) ? ref[0] : ref
      if (instance && typeof instance.focus === 'function') {
        instance.focus()
      }
    },
    ensureInputVisible(inputId) {
      if (!this.imeVisible || !this.imeHeight || !inputId) return
      const query = uni.createSelectorQuery().in(this)
      query.select(`#${inputId}`).boundingClientRect()
      query.select('.answer-action-btn').boundingClientRect()
      query.exec((res) => {
        const inputRect = res[0]
        const actionButtonRect = res[1]
        if (!inputRect) return
        const systemInfo = uni.getSystemInfoSync()
        const windowHeight = systemInfo.windowHeight || 0
        const keyboardTop = windowHeight - this.imeHeight - this.imePopupHeight
        const margin = 24
        const inputBottom = inputRect.bottom + this.imeLift
        const shouldKeepActionVisible = this.exerciseType === 'sentence'
        const actionButtonBottom = shouldKeepActionVisible && actionButtonRect
          ? actionButtonRect.bottom + this.imeLift
          : 0
        const targetBottom = shouldKeepActionVisible
          ? Math.max(inputBottom, actionButtonBottom)
          : inputBottom
        const requiredLift = targetBottom > keyboardTop - margin ? targetBottom - (keyboardTop - margin) : 0
        this.imeLift = requiredLift
      })
    },
    goBack() {
      // 如果是从注册页面跳转过来的，直接返回首页
      if (this.fromRegister) {
        uni.switchTab({
          url: '/pages/index/index'
        })
        return
      }

      if (this.hasStarted) {
        uni.showModal({
          title: '提示',
          content: '练习尚未完成，确定要返回吗？',
          success: (res) => {
            if (res.confirm) {
              this.allowNavigateBack = true
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
    shouldDisableSentenceInCurrentMode() {
      return this.practiceMode === 'favorite' || this.practiceMode === 'wrong'
    },
    isExerciseTypeDisabled(typeValue) {
      if (!typeValue) return false
      return this.shouldDisableSentenceInCurrentMode() && typeValue === 'sentence'
    },
    getSentenceUnsupportedToastText() {
      if (this.isSingleVerbPractice) return '单词专练暂不支持例句填空练习'
      if (this.practiceMode === 'favorite') return '收藏专练暂不支持例句填空练习'
      if (this.practiceMode === 'wrong') return '错词专练暂不支持例句填空练习'
      return '当前模式暂不支持例句填空练习'
    },
    showSentenceUnsupportedToast() {
      showToast(this.getSentenceUnsupportedToastText(), 'none')
    },
    resetExerciseTypeForSentenceDisabledMode() {
      const quickFillIndex = this.exerciseTypes.findIndex(type => type.value === 'quick-fill' && !this.isExerciseTypeDisabled(type.value))
      const fallbackIndex = this.exerciseTypes.findIndex(type => !this.isExerciseTypeDisabled(type.value))
      const targetIndex = quickFillIndex >= 0 ? quickFillIndex : fallbackIndex
      if (targetIndex >= 0) {
        this.exerciseTypeIndex = targetIndex
        this.exerciseType = this.exerciseTypes[targetIndex].value
      }
    },
    handleExerciseTypeClick(index) {
      if (this.isCourseMode) return
      const target = this.exerciseTypes[index]
      if (!target) return
      if (this.isExerciseTypeDisabled(target.value)) {
        this.showSentenceUnsupportedToast()
        return
      }
      this.selectExerciseType(index)
    },
    // 选择练习类型（新方法）
    selectExerciseType(index) {
      const target = this.exerciseTypes[index]
      if (!target) return
      if (this.isExerciseTypeDisabled(target.value)) {
        this.showSentenceUnsupportedToast()
        return
      }
      this.exerciseTypeIndex = index
      this.exerciseType = target.value
    },

    handleExerciseTypeSwipeStart(e) {
      if (this.isCourseMode || !Array.isArray(this.exerciseTypes) || this.exerciseTypes.length <= 1) return
      const touch = e && e.touches && e.touches[0]
      if (!touch) return
      this.exerciseTypeSwipeStartX = touch.clientX
      this.exerciseTypeSwipeStartY = touch.clientY
      this.isExerciseTypeSwipeTracking = true
    },

    handleExerciseTypeSwipeEnd(e) {
      if (this.isCourseMode || !Array.isArray(this.exerciseTypes) || this.exerciseTypes.length <= 1) {
        this.resetExerciseTypeSwipeState()
        return
      }
      if (!this.isExerciseTypeSwipeTracking) return
      const touch = e && e.changedTouches && e.changedTouches[0]
      if (!touch) {
        this.resetExerciseTypeSwipeState()
        return
      }

      const deltaX = touch.clientX - this.exerciseTypeSwipeStartX
      const deltaY = touch.clientY - this.exerciseTypeSwipeStartY
      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)
      const minSwipeDistance = 60

      if (absX < minSwipeDistance || absX <= absY) {
        this.resetExerciseTypeSwipeState()
        return
      }

      if (deltaX < 0) {
        this.switchExerciseTypeByStep(1)
      } else {
        this.switchExerciseTypeByStep(-1)
      }
      this.resetExerciseTypeSwipeState()
    },

    resetExerciseTypeSwipeState() {
      this.exerciseTypeSwipeStartX = 0
      this.exerciseTypeSwipeStartY = 0
      this.isExerciseTypeSwipeTracking = false
    },

    switchExerciseTypeByStep(step) {
      let nextIndex = this.exerciseTypeIndex + step
      while (nextIndex >= 0 && nextIndex < this.exerciseTypes.length) {
        const target = this.exerciseTypes[nextIndex]
        if (target && !this.isExerciseTypeDisabled(target.value)) {
          this.selectExerciseType(nextIndex)
          return
        }
        nextIndex += step
      }
    },

    openExerciseModeModal() {
      this.showExerciseModeModal = true
    },

    closeExerciseModeModal() {
      this.showExerciseModeModal = false
    },

    openSentenceModeInfoModal() {
      this.showSentenceModeInfoModal = true
    },

    closeSentenceModeInfoModal() {
      this.showSentenceModeInfoModal = false
    },

    selectSentenceMode(mode) {
      this.selectedSentenceMode = mode
    },

    toggleConjugationForm(form) {
      const index = this.selectedConjugationForms.indexOf(form)
      if (index > -1) {
        if (this.selectedConjugationForms.length === 1) {
          showToast('请至少选择一个变位形式', 'none')
          return
        }
        this.selectedConjugationForms.splice(index, 1)
      } else {
        this.selectedConjugationForms.push(form)
      }
    },

    isPublicQuestionSource(source) {
      return source === 'public'
        || source === 'public_traditional'
        || source === 'public_pronoun'
    },

    getQuestionUniqueKey(exercise) {
      if (!exercise) return ''
      if (exercise.questionId && exercise.questionSource) {
        return `${exercise.questionSource}:${exercise.questionId}`
      }
      if (exercise.verbId) {
        return `verb:${exercise.verbId}:${exercise.sentence || exercise.correctAnswer || ''}`
      }
      return ''
    },

    formatPronounPattern(pattern) {
      const normalized = String(pattern || '').trim().toUpperCase()
      if (normalized === 'DO') return 'DO'
      if (normalized === 'IO') return 'IO'
      if (normalized === 'DO_IO') return 'DO+IO'
      return ''
    },

    hasHintData(exercise) {
      if (!exercise) return false
      if (exercise.questionBank === 'pronoun') return true
      return !!exercise.hint
    },

    getHintText(exercise) {
      if (!exercise) return ''
      if (exercise.questionBank !== 'pronoun') {
        return exercise.hint || ''
      }
      if (exercise.hostForm === 'prnl') {
        return '自反形式（本题不区分 IO/DO）'
      }
      const pronounParts = []
      if (exercise.ioPronoun) pronounParts.push(`IO: ${exercise.ioPronoun}`)
      if (exercise.doPronoun) pronounParts.push(`DO: ${exercise.doPronoun}`)
      if (pronounParts.length === 0 && exercise.pronounPattern) {
        pronounParts.push(`模式: ${this.formatPronounPattern(exercise.pronounPattern)}`)
      }
      const pronounHint = pronounParts.length > 0
        ? pronounParts.join(' | ')
        : '请结合上下文判断代词格、性数和位置'

      const hostForm = String(exercise.hostForm || '').trim().toLowerCase()
      const needMoodTensePersonLine = hostForm === 'finite' || hostForm === 'imperative'
      if (!needMoodTensePersonLine) {
        return pronounHint
      }

      const moodTensePerson = [exercise.mood, exercise.tense, exercise.person]
        .filter(item => !!item)
        .join('-')
      if (!moodTensePerson) {
        return pronounHint
      }

      return `${moodTensePerson}\n${pronounHint}`
    },

    createStateForExercise(exercise) {
      return {
        status: 'pending',
        userAnswer: '',
        selectedAnswer: '',
        comboAnswers: exercise && exercise.comboItems ? new Array(exercise.comboItems.length).fill('') : [],
        showFeedback: false,
        isCorrect: false,
        showExample: false,
        showHint: false,
        showTranslation: false,
        showRatingButtons: false,
        hasRated: false
      }
    },

    ensureStateExists(index) {
      if (!this.exercises[index]) return
      if (!this.questionStates[index]) {
        this.$set(this.questionStates, index, this.createStateForExercise(this.exercises[index]))
      }
    },

    applyState(index) {
      this.ensureStateExists(index)
      const state = this.questionStates[index]
      if (!state) return

      this.userAnswer = state.userAnswer || ''
      this.selectedAnswer = state.selectedAnswer || ''
      if (state.comboAnswers && state.comboAnswers.length > 0) {
        this.comboAnswers = [...state.comboAnswers]
      } else if (this.exercises[index] && this.exercises[index].comboItems) {
        this.comboAnswers = new Array(this.exercises[index].comboItems.length).fill('')
      } else {
        this.comboAnswers = []
      }
      this.showFeedback = !!state.showFeedback
      this.isCorrect = !!state.isCorrect
      this.showExample = !!state.showExample
      this.showHint = !!state.showHint
      this.showTranslation = !!state.showTranslation
      this.showRatingButtons = !!state.showRatingButtons
      this.hasRated = !!state.hasRated
    },

    saveCurrentState(statusOverride = null) {
      if (!this.currentExercise) return
      this.ensureStateExists(this.currentIndex)
      const state = this.questionStates[this.currentIndex] || {}

      const nextState = {
        ...state,
        status: statusOverride || state.status || 'pending',
        userAnswer: this.userAnswer,
        selectedAnswer: this.selectedAnswer,
        comboAnswers: [...this.comboAnswers],
        showFeedback: this.showFeedback,
        isCorrect: this.isCorrect,
        showExample: this.showExample,
        showHint: this.showHint,
        showTranslation: this.showTranslation,
        showRatingButtons: this.showRatingButtons,
        hasRated: this.hasRated
      }

      this.$set(this.questionStates, this.currentIndex, nextState)
    },

    goToExercise(index, skipSave = false) {
      if (index < 0 || index >= this.exercises.length) return
      if (!skipSave) {
        this.saveCurrentState()
      }

      this.currentIndex = index
      this.ensureStateExists(index)
      this.applyState(index)
      this.checkFavoriteStatus()
      this.checkQuestionFavoriteStatus()
      this.focusAnswerInput()
    },
    
    onExerciseTypeChange(e) {
      this.exerciseTypeIndex = e.detail.value
      this.exerciseType = this.exerciseTypes[e.detail.value].value
    },
    changeExerciseCount(delta) {
      if (this.isCourseMode) return
      const nextCount = this.normalizeExerciseCount(this.exerciseCount + delta)
      this.exerciseCount = nextCount
    },
    setExerciseCount(count) {
      this.exerciseCount = this.normalizeExerciseCount(count)
    },
    normalizeExerciseCount(count) {
      const clamped = Math.min(this.maxExerciseCount, Math.max(this.minExerciseCount, count))
      const rounded = Math.round(clamped / this.exerciseCountStep) * this.exerciseCountStep
      return Math.min(this.maxExerciseCount, Math.max(this.minExerciseCount, rounded))
    },
    
    // 专项练习设置方法
    initMoodPanels() {
      const panels = {}
      this.moodOptions.forEach((m, index) => {
        panels[m.value] = index === 0
      })
      this.expandedMoodPanels = panels
    },

    isMoodPanelExpanded(mood) {
      return !!this.expandedMoodPanels[mood]
    },

    toggleMoodPanel(mood) {
      const nextState = !this.expandedMoodPanels[mood]
      const panels = {}
      this.moodOptions.forEach((m) => {
        panels[m.value] = false
      })
      panels[mood] = nextState
      this.expandedMoodPanels = panels
    },

    getTensesByMood(mood) {
      return this.tenseOptions.filter(t => t.mood === mood)
    },

    getSelectedTenseCountByMood(mood) {
      const inMood = this.getTensesByMood(mood).map(t => t.value)
      return inMood.filter(t => this.selectedTenses.includes(t)).length
    },

    getDimmedTenseSet() {
      return new Set([
        'preterito_anterior',
        'subjuntivo_futuro',
        'subjuntivo_pluscuamperfecto',
        'subjuntivo_futuro_perfecto'
      ])
    },

    getSecondClassTenseSet() {
      return new Set([
        'pluscuamperfecto',
        'futuro_perfecto',
        'condicional_perfecto',
        'subjuntivo_imperfecto',
        'subjuntivo_perfecto'
      ])
    },

    isDimmedTense(tense) {
      return this.getDimmedTenseSet().has(tense)
    },

    isSecondClassTense(tense) {
      return this.getSecondClassTenseSet().has(tense)
    },

    resetThemeSelections() {
      const configured = getPracticeTenseSelectionSettings().selectedTenses || []
      const available = new Set(this.tenseOptions.map(t => t.value))
      const normalized = configured.filter(t => available.has(t))
      this.selectedTenses = normalized.length > 0
        ? normalized
        : this.tenseOptions
          .map(t => t.value)
          .filter(v => !this.isDimmedTense(v) && !this.isSecondClassTense(v))
      this.syncSelectedMoodsFromTenses()
      this.includeRegular = true
    },

    syncSelectedMoodsFromTenses() {
      this.selectedMoods = this.getDisplayMoodsFromTenses(this.selectedTenses)
    },

    selectAllTensesInMood(mood) {
      const tensesInMood = this.getTensesByMood(mood).map(t => t.value)
      tensesInMood.forEach((tense) => {
        if (!this.selectedTenses.includes(tense)) {
          this.selectedTenses.push(tense)
        }
      })
      this.syncSelectedMoodsFromTenses()
    },

    clearTensesInMood(mood) {
      const tenseSet = new Set(this.getTensesByMood(mood).map(t => t.value))
      this.selectedTenses = this.selectedTenses.filter(t => !tenseSet.has(t))
      this.syncSelectedMoodsFromTenses()
    },

    mapApiMoodToDisplayMood(mood) {
      if (mood === 'imperativo') return 'imperativo'
      if (mood === 'subjuntivo' || mood === 'subjuntivo_compuesto') return 'subjuntivo'
      if (mood === 'indicativo' || mood === 'indicativo_compuesto') return 'indicativo'
      if (mood === 'condicional') return 'condicional'
      return mood
    },

    getDisplayMoodsFromTenses(tenses = []) {
      const displayMoods = new Set()
      tenses.forEach((tense) => {
        const opt = this.tenseOptions.find(item => item.value === tense)
        if (opt) {
          displayMoods.add(opt.mood)
        }
      })
      return Array.from(displayMoods)
    },

    normalizeDisplayMoods(moods = [], tenses = []) {
      const fromTenses = this.getDisplayMoodsFromTenses(tenses)
      if (fromTenses.length > 0) return fromTenses
      const normalized = Array.from(new Set((moods || []).map(m => this.mapApiMoodToDisplayMood(m))))
      return normalized.filter(Boolean)
    },

    expandDisplayMoodsToApiMoods(displayMoods = []) {
      const apiMoods = new Set()
      displayMoods.forEach((mood) => {
        if (mood === 'indicativo' || mood === 'condicional') {
          apiMoods.add('indicativo')
          apiMoods.add('indicativo_compuesto')
        } else if (mood === 'subjuntivo') {
          apiMoods.add('subjuntivo')
          apiMoods.add('subjuntivo_compuesto')
        } else if (mood === 'imperativo') {
          apiMoods.add('imperativo')
        }
      })
      return Array.from(apiMoods)
    },

    // 加载全局人称设置
    loadPronounSettings() {
      const settings = getPronounSettings()
      this.includeVos = settings.includeVos
      this.includeVosotros = settings.includeVosotros
    },

    loadPracticeGenerationSettings() {
      const settings = getPracticeGenerationSettings()
      this.reduceRareTenseFrequency = settings.reduceRareTenseFrequency
    },
    
    // 切换专项练习折叠状态
    toggleThemeSettings() {
      this.themeSettingsExpanded = !this.themeSettingsExpanded
    },

    toggleConjugationFormSettings() {
      this.conjugationFormSettingsExpanded = !this.conjugationFormSettingsExpanded
    },

    toggleOtherSettings() {
      this.otherSettingsExpanded = !this.otherSettingsExpanded
    },
    
    toggleTense(tense) {
      const index = this.selectedTenses.indexOf(tense)
      if (index > -1) {
        this.selectedTenses.splice(index, 1)
      } else {
        this.selectedTenses.push(tense)
      }
      this.syncSelectedMoodsFromTenses()
    },
    
    onIncludeRegularChange(event) {
      if (this.isCourseMode) return
      this.includeRegular = event.detail.value
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
          if (lesson.tenses && lesson.tenses.length > 0) {
            this.selectedTenses = lesson.tenses
          }
          if (lesson.moods && lesson.moods.length > 0) {
            this.selectedMoods = this.normalizeDisplayMoods(lesson.moods, this.selectedTenses)
          } else {
            this.selectedMoods = this.getDisplayMoodsFromTenses(this.selectedTenses)
          }
          this.syncSelectedMoodsFromTenses()
          
          console.log('课程配置:', {
            moods: this.selectedMoods,
            tenses: this.selectedTenses
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
            if (vocabRes.config.tenses && vocabRes.config.tenses.length > 0) {
              this.selectedTenses = vocabRes.config.tenses
            }
            if (vocabRes.config.moods && vocabRes.config.moods.length > 0) {
              this.selectedMoods = this.normalizeDisplayMoods(vocabRes.config.moods, this.selectedTenses)
            } else {
              this.selectedMoods = this.getDisplayMoodsFromTenses(this.selectedTenses)
            }
            this.syncSelectedMoodsFromTenses()
            
            console.log('滚动复习配置（合并第1-' + this.lessonNumber + '课）:', {
              moods: this.selectedMoods,
              tenses: this.selectedTenses,
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

    // 获取当前练习允许的动词ID集合（课程/滚动复习/自定义）
    getAllowedVerbIdSet() {
      if (this.isCourseMode && Array.isArray(this.lessonVocabulary) && this.lessonVocabulary.length > 0) {
        return new Set(this.lessonVocabulary.map(v => v.id))
      }
      if (this.hasExplicitVerbIds && this.customVerbIds.length > 0) {
        return new Set(this.customVerbIds)
      }
      return null
    },

    scrollToTop(duration = 0) {
      this.$nextTick(() => {
        if (typeof uni !== 'undefined' && typeof uni.pageScrollTo === 'function') {
          uni.pageScrollTo({
            scrollTop: 0,
            duration
          })
          return
        }

        if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
          window.scrollTo({
            top: 0,
            left: 0,
            behavior: duration > 0 ? 'smooth' : 'auto'
          })
        }
      })
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
      
      // 非“带代词变位”模式下，验证是否至少选择了一个语气或时态
      if (this.showThemeTenseSelector && this.selectedMoods.length === 0 && this.selectedTenses.length === 0) {
        showToast('请至少选择一个语气或时态', 'none')
        return
      }

      // 带代词相关模式下，验证是否至少选择一个变位形式
      if (this.showConjugationFormSelector && this.selectedConjugationForms.length === 0) {
        showToast('请至少选择一个变位形式', 'none')
        return
      }
      
      if (this.isCourseMode) {
        const hasVocabulary = Array.isArray(this.lessonVocabulary) && this.lessonVocabulary.length > 0
        if (!hasVocabulary) {
          showToast('课程单词尚未加载，请稍后重试', 'none')
          return
        }
      }
      
      showLoading('正在生成练习...')

      try {
        // 构建请求参数
        const requestData = {
          exerciseType: this.exerciseType,
          count: this.exerciseCount,
          tenses: this.selectedTenses,  // 具体时态（可选）
          moods: this.expandDisplayMoodsToApiMoods(this.selectedMoods),     // 语气（前端分组映射到后端语气）
          includeRegular: this.includeRegular,
          includeVos: this.includeVos,  // 是否包含vos
          includeVosotros: this.includeVosotros,  // 是否包含vosotros
          reduceRareTenseFrequency: this.reduceRareTenseFrequency,
          practiceMode: this.practiceMode
        }

        if (this.exerciseType === 'sentence') {
          requestData.sentenceMode = this.selectedSentenceMode
          requestData.conjugationForms = this.selectedConjugationForms
        }

        // 如果是课程模式，传递课程单词ID列表
        if (this.isCourseMode && this.lessonVocabulary.length > 0) {
          requestData.verbIds = this.lessonVocabulary.map(v => v.id)
        } else if (this.hasExplicitVerbIds && this.customVerbIds.length > 0) {
          requestData.verbIds = this.customVerbIds
        }

        // 单动词练习使用常规题目生成，避免触发AI批量逻辑
        const res = this.isCustomPractice
          ? await api.getExercise(requestData)
          : await api.getBatchExercises(requestData)

        hideLoading()

        if (res.success) {
          // 初始化练习
          const allowList = this.getAllowedVerbIdSet()

          // 快变快填和组合填空：直接使用exercises
          if (this.exerciseType === 'quick-fill' || this.exerciseType === 'combo-fill') {
            let exercises = res.exercises || []
            if (allowList) {
              exercises = exercises.filter(ex => allowList.has(ex.verbId))
            }
            
            this.exercises = exercises
            this.questionStates = this.exercises.map(ex => this.createStateForExercise(ex))
            this.hasStarted = true
            this.scrollToTop()
            this.currentIndex = 0
            this.correctCount = 0
            
            console.log(`${this.exerciseType === 'quick-fill' ? '快变快填' : '组合填空'}题目接收完成:`, {
              题目数: this.exercises.length
            })
            
            if (this.exercises.length > 0) {
              this.goToExercise(0, true)
            } else {
              showToast('未能生成练习题，请重试')
              return
            }
          } else {
            // 例句填空：使用题目池模式
            this.exercises = []
            
            // 接收题目池并分离主题和备用题
            let rawPool = Array.isArray(res.questionPool) ? res.questionPool : []
            if (allowList) {
              rawPool = rawPool.filter(q => allowList.has(q.verbId))
            }
            
            this.mainQuestionPool = rawPool.filter(q => q._isMain)
            this.backupQuestionPool = rawPool.filter(q => q._isBackup)
            this.hasEnoughInBank = res.hasEnoughInBank || false
            
            console.log(`题目池接收完成:`, {
              主题池: this.mainQuestionPool.length,
              备用题池: this.backupQuestionPool.length,
              题库充足: this.hasEnoughInBank,
              需要AI: res.needAI || 0
            })
            
            this.usedQuestionIds = new Set()
            this.hasStarted = true
            this.scrollToTop()
            this.currentIndex = 0
            this.correctCount = 0
            this.questionStates = []

            // 从主题目池抽取题目
            this.fillFromMainPool()
          
            // 检查是否有足够的题目（仅例句填空需要）
            const aiPlans = this.isCustomPractice
              ? []
              : (
                Array.isArray(res.aiPlans)
                  ? res.aiPlans
                  : (res.needAI > 0 && res.aiOptions ? [{ count: res.needAI, aiOptions: res.aiOptions }] : [])
              )
            const hasEnoughQuestions = this.exercises.length > 0 || aiPlans.length > 0
            
            if (hasEnoughQuestions) {
              // 如果有题库题，检查第一题的收藏状态
              if (this.exercises.length > 0) {
                this.goToExercise(0, true)
              } else if (aiPlans.length > 0) {
                // 题库为空，等待AI生成
                console.log('题库为空，等待AI生成题目...')
                showToast('正在生成练习题，请稍候...', 'loading', 3000)
              }
            } else {
              showToast('未能生成练习题，请重试')
              return
            }
            
            // 异步生成AI题目（如果需要）
            if (!this.isCustomPractice && aiPlans.length > 0) {
              this.generationError = false
              console.log('开始异步生成AI题目计划:', aiPlans)
              this.generateAIPlansAsync(aiPlans)
            }
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
    
    // 从主题目池中抽取题目（用户开始练习时调用）
    fillFromMainPool() {
      if (this.mainQuestionPool.length === 0) {
        console.log('主题目池为空')
        return
      }
      
      // 打乱主题目池
      const shuffled = [...this.mainQuestionPool].sort(() => Math.random() - 0.5)
      
      // 添加所有主题到exercises
      for (const question of shuffled) {
        const uniqueKey = this.getQuestionUniqueKey(question)
        if (!uniqueKey || !this.usedQuestionIds.has(uniqueKey)) {
          this.exercises.push(question)
          this.questionStates.push(this.createStateForExercise(question))
          if (uniqueKey) this.usedQuestionIds.add(uniqueKey)
        }
      }
      
      console.log(`从主题目池抽取了 ${this.exercises.length} 个题目`)
    },
    
    // 从备用题目池填充（当用户做题速度快于AI生成速度时调用）
    fillBuffer() {
      if (this.backupQuestionPool.length === 0) {
        console.log('备用题目池为空，无法填充')
        return
      }
      
      // 计算还需要多少题目才能达到目标
      const remaining = this.exerciseCount - this.exercises.length
      if (remaining <= 0) {
        console.log('已达到目标题量，无需填充')
        return
      }
      
      // 从备用池中抽取未使用的题目
      let filled = 0
      for (const question of this.backupQuestionPool) {
        if (filled >= remaining) break
        
        const uniqueKey = this.getQuestionUniqueKey(question)
        if (!uniqueKey || !this.usedQuestionIds.has(uniqueKey)) {
          // 随机插入到未做题目的位置
          const insertStart = this.currentIndex + 1
          const insertEnd = this.exercises.length + 1
          const randomIndex = insertStart + Math.floor(Math.random() * (insertEnd - insertStart))
          
          this.exercises.splice(randomIndex, 0, question)
          this.questionStates.splice(randomIndex, 0, this.createStateForExercise(question))
          if (uniqueKey) this.usedQuestionIds.add(uniqueKey)
          filled++
          
          console.log(`从备用池填充题目到位置 ${randomIndex}`)
        }
      }
      
      console.log(`从备用题目池填充了 ${filled} 个题目，当前总题数: ${this.exercises.length}`)
    },
    
    async generateAIPlansAsync(aiPlans = []) {
      const plans = Array.isArray(aiPlans) ? aiPlans : []
      for (const plan of plans) {
        const count = Number(plan.count || 0)
        if (count <= 0 || !plan.aiOptions) continue
        await this.generateAIQuestionsAsync(count, plan.aiOptions)
      }
    },

    // 异步生成AI题目并随机插入
    async generateAIQuestionsAsync(count, aiOptions) {
      const isFirstBatch = this.exercises.length === 0  // 判断是否是第一批题目（题库为空）
      let successCount = 0  // 成功生成的题目数量
      let failCount = 0     // 失败次数
      const allowList = this.getAllowedVerbIdSet()
      
      console.log(`开始AI生成任务:`, {
        需要生成: count,
        当前题数: this.exercises.length,
        题库充足: this.hasEnoughInBank,
        isFirstBatch
      })
      
      for (let i = 0; i < count; i++) {
        try {
          console.log(`正在生成第 ${i + 1}/${count} 个AI题目`)
          
          // 显示生成进度
          this.generatingCount = count - i
          
          // 收集已使用的动词ID，避免重复
          const usedVerbIds = new Set(this.exercises.map(e => e.verbId).filter(id => id))
          
          const fallbackVerbIds = this.isCourseMode && Array.isArray(this.lessonVocabulary) && this.lessonVocabulary.length > 0
            ? this.lessonVocabulary.map(v => v.id)
            : null

          const res = await api.generateSingleAI({
            aiOptions: {
              ...aiOptions,
              excludeVerbIds: Array.from(usedVerbIds),
              verbIds: this.hasExplicitVerbIds && this.customVerbIds.length > 0
                ? this.customVerbIds
                : (aiOptions.verbIds && aiOptions.verbIds.length > 0 ? aiOptions.verbIds : fallbackVerbIds)
            }
          })
          
          if (res.success && res.exercise) {
            if (allowList && !allowList.has(res.exercise.verbId)) {
              failCount++
              this.generationError = true
              console.warn('AI题目动词不在允许范围内，已跳过')
              continue
            }

            successCount++
            
            // 记录已使用的题目ID
            const uniqueKey = this.getQuestionUniqueKey(res.exercise)
            if (uniqueKey) {
              this.usedQuestionIds.add(uniqueKey)
            }
            
            // 检查用户当前是否还需要这个题目
            const userNeedsMore = this.exercises.length < this.exerciseCount
            
            if (userNeedsMore) {
              // 用户还需要更多题目，插入到练习队列
              if (isFirstBatch && i === 0) {
                // 第一题直接添加
                this.exercises.push(res.exercise)
                this.questionStates.push(this.createStateForExercise(res.exercise))
                console.log(`第一个AI题目已生成，开始练习`)
                uni.hideToast()
                this.goToExercise(0, true)
              } else {
                // 随机插入到当前题目之后
                const insertStart = this.currentIndex + 1
                const insertEnd = this.exercises.length + 1
                const randomIndex = insertStart + Math.floor(Math.random() * (insertEnd - insertStart))

                this.exercises.splice(randomIndex, 0, res.exercise)
                this.questionStates.splice(randomIndex, 0, this.createStateForExercise(res.exercise))

                console.log(`AI题目已插入到位置 ${randomIndex}, 当前题目总数: ${this.exercises.length}`)
              }
            } else {
              // 用户不需要更多题目，AI生成的题目已经过审查（后端已加入题库），直接丢弃
              console.log(`AI题目 ${i + 1} 已生成但用户不需要，已由后端加入题库`)
            }
          } else {
            failCount++
            this.generationError = true
            console.error(`生成第 ${i + 1} 个AI题目失败: API返回无效数据`)
          }
        } catch (error) {
          failCount++
          this.generationError = true
          console.error(`生成第 ${i + 1} 个AI题目失败:`, error)
          
          // 如果是第一批题目且连续失败，提示用户
          if (isFirstBatch && i < 3 && failCount > i) {
            if (i === 2) {
              uni.hideToast()
              uni.showModal({
                title: 'AI生成失败',
                content: 'AI服务当前繁忙，无法生成题目。建议：\n1. 稍后再试\n2. 或先进行其他练习模式',
                showCancel: false
              })
              this.generatingCount = 0
              return
            }
          }
        }
      }
      
      this.generatingCount = 0
      console.log(`AI题目异步生成完成:`, {
        成功: successCount,
        失败: failCount,
        总计: count,
        当前题数: this.exercises.length,
        目标题数: this.exerciseCount
      })
      
      // 如果是第一批且全部失败，显示错误信息
      if (isFirstBatch && successCount === 0) {
        uni.showModal({
          title: '生成失败',
          content: '无法生成练习题，AI服务可能暂时不可用。',
          showCancel: false,
          success: () => {
            uni.navigateBack()
          }
        })
      }
    },
    
    // 从题目池中随机抽取题目
    
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
          this.saveCurrentState()
        }
      } catch (error) {
        console.error('评价题目失败:', error)
        showToast('评价失败', 'none')
      }
    },
    
    // 检查当前题目是否已收藏（仅例句填空）
    async checkQuestionFavoriteStatus() {
      const ex = this.currentExercise
      if (!ex || ex.exerciseType !== 'sentence') {
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
    
    // 切换题目收藏状态（仅例句填空）
    async toggleQuestionFavorite() {
      const ex = this.currentExercise
      if (!ex || ex.exerciseType !== 'sentence') {
        showToast('只支持收藏例句填空', 'none')
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
          } else if (this.isPublicQuestionSource(ex.questionSource) && ex.questionId) {
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
            person: ex.person,
            questionBank: ex.questionBank,
            hostForm: ex.hostForm,
            hostFormZh: ex.hostFormZh,
            pronounPattern: ex.pronounPattern,
            ioPronoun: ex.ioPronoun,
            doPronoun: ex.doPronoun
          }
          
          // 如果题目来自公共题库，传递questionId
          if (ex.questionId && this.isPublicQuestionSource(ex.questionSource)) {
            questionData.questionId = ex.questionId
            questionData.questionSource = ex.questionSource
            questionData.publicQuestionSource = ex.publicQuestionSource || ex.questionSource
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
      this.saveCurrentState()
    },

    // 切换提示显示
    toggleHint() {
      this.showHint = !this.showHint
      this.saveCurrentState()
    },

    // 切换翻译显示
    toggleTranslation() {
      this.showTranslation = !this.showTranslation
      this.saveCurrentState()
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

    skipCurrentExercise() {
      if (!this.currentExercise || this.showFeedback) return

      this.userAnswer = ''
      this.selectedAnswer = ''
      this.comboAnswers = this.currentExercise.comboItems ? new Array(this.currentExercise.comboItems.length).fill('') : []
      this.showExample = false
      this.showHint = false
      this.showTranslation = false
      this.showRatingButtons = false
      this.hasRated = false
      this.isCorrect = false
      this.showFeedback = false

      this.saveCurrentState('skipped')
      this.nextExercise()
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
            const userAnswer = this.comboAnswers[i] || ''
            
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
          this.showFeedback = true
          this.saveCurrentState('answered')
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

          // 如果是例句填空且是错题重做，显示评价按钮
          if (this.exerciseType === 'sentence' && this.currentExercise.isRetry) {
            // 只有AI生成的题目或题库题目才显示评价按钮
            if (this.currentExercise.aiGenerated || this.currentExercise.fromQuestionBank) {
              this.showRatingButtons = true
            }
          }

          this.showFeedback = true
          this.saveCurrentState('answered')
        }
      } catch (error) {
        showToast('提交失败')
      }
    },

    goToPreviousExercise() {
      if (!this.canGoPrevious) return
      this.goToExercise(this.currentIndex - 1)
    },

    async nextExercise() {
      this.saveCurrentState()

      // 检查是否完成所有初始题目（但还有错题需要重做）
      if (this.completedCount >= this.exerciseCount && this.wrongExercises.length > 0) {
        // 显示练习总结弹窗，让用户选择是否重做错题
        console.log('完成原有题目，有', this.wrongExercises.length, '道错题')
        this.showPracticeSummary()
        return
      }

      // 检查是否完成所有题目（包括错题重做）
      if (this.currentIndex + 1 >= this.exercises.length && this.wrongExercises.length === 0) {
        // 如果尚未达到目标题量，且还有AI生成在进行或题库可能还可填充，应该等待/尝试填充，而不是直接结束
        if (this.completedCount < this.exerciseCount) {
          // 如果正在生成AI题目，等待生成完成
          if (this.generatingCount > 0) {
            showLoading('正在生成下一题，请稍候...')
            const checkInterval = setInterval(() => {
              if (this.currentIndex + 1 < this.exercises.length) {
                clearInterval(checkInterval)
                hideLoading()
                this.goToExercise(this.currentIndex + 1, true)
                if (typeof this.fillBuffer === 'function') this.fillBuffer()
              } else if (this.generationError && this.generatingCount === 0) {
                clearInterval(checkInterval)
                hideLoading()
                showToast('生成题目失败，请重试', 'none')
                if (typeof this.fillBuffer === 'function') this.fillBuffer()
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

            return
          }

          // 如果没有正在生成，但仍未达到目标题量，尝试触发缓冲填充（如果实现了fillBuffer）
          if (typeof this.fillBuffer === 'function') {
            try {
              await this.fillBuffer()
            } catch (e) {
              console.error('fillBuffer 调用失败:', e)
            }

            // 填充后如果有下一题，直接跳转并继续填充
            if (this.currentIndex + 1 < this.exercises.length) {
              this.goToExercise(this.currentIndex + 1, true)
              if (typeof this.fillBuffer === 'function') this.fillBuffer()
              return
            }
          }
        }

        // 无需等待或已达到目标题量，显示结果
        this.showResult = true
        return
      }

      // 检查下一题是否已生成
      if (this.currentIndex + 1 < this.exercises.length) {
        // 下一题已准备好，直接跳转
        this.goToExercise(this.currentIndex + 1, true)
        // 继续填充缓冲区（只有在非错题重做阶段）
        if (this.completedCount < this.exerciseCount) {
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
              this.goToExercise(this.currentIndex + 1, true)
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
            this.goToExercise(this.currentIndex + 1, true)
            this.fillBuffer()
          }
        }
      }
    },
    // 显示练习总结弹窗
    showPracticeSummary() {
      const initialCorrect = this.correctCount
      const initialTotal = this.answeredCount
      const initialWrong = Math.max(initialTotal - initialCorrect, 0)
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
      this.wrongExercises.forEach(ex => {
        this.exercises.push(ex)
        this.questionStates.push(this.createStateForExercise(ex))
      })
      // 清空错题队列
      this.wrongExercises = []
      // 更新总题数
      this.setExerciseCount(this.exercises.length)
      // 继续下一题
      this.goToExercise(this.currentIndex + 1, true)
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

    // 聚焦填空输入框（例句填空 & 快变快填）
    focusAnswerInput() {
      if (this.exerciseType === 'sentence' || this.exerciseType === 'quick-fill') {
        this.answerInputFocus = false
        this.$nextTick(() => {
          setTimeout(() => {
            this.answerInputFocus = true
          }, 50)
        })
      } else {
        this.answerInputFocus = false
      }
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
      this.questionStates = []
      this.currentIndex = 0
      this.correctCount = 0
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
      this.generatingCount = 0
      this.generationError = false
      this.questionStates = this.exercises.map(ex => this.createStateForExercise(ex))
      if (this.exercises.length > 0) {
        this.goToExercise(0, true)
      }
    },
    
    // 切换问题类型选择
    toggleIssueType(issueValue) {
      const index = this.selectedIssueTypes.indexOf(issueValue)
      if (index > -1) {
        this.selectedIssueTypes.splice(index, 1)
      } else {
        this.selectedIssueTypes.push(issueValue)
      }
    },
    
    // 提交题目反馈
    async submitReport() {
      if (!this.currentExercise) {
        showToast('当前没有题目', 'none')
        return
      }
      
      // 验证必须选择至少一个问题类型
      if (this.selectedIssueTypes.length === 0) {
        showToast('请至少选择一个问题类型', 'none')
        return
      }
      
      // 如果选择了"其他问题"，必须填写描述
      if (this.selectedIssueTypes.includes('other') && !this.reportComment.trim()) {
        showToast('选择"其他问题"时，请填写问题描述', 'none')
        return
      }
      
      try {
        showLoading('提交中...')
        
        // 准备反馈数据
        const feedbackData = {
          exerciseType: this.exerciseType,
          verbId: this.currentExercise.verbId,
          infinitive: this.currentExercise.infinitive,
          questionSource: this.currentExercise.questionSource,
          issueTypes: this.selectedIssueTypes,  // 新增：问题类型数组
          feedbackText: this.reportComment.trim()
        }
        
        // 根据题型添加不同的字段
        if (this.exerciseType === 'combo-fill') {
          // 组合填空：提交6个答案，用英文逗号分割
          const answers = this.currentExercise.comboItems.map(item => item.correctAnswer)
          feedbackData.answers = answers.join(',')
        } else if (this.exerciseType === 'sentence') {
          // 例句填空：提交题目ID（如果有）
          if (this.currentExercise.questionId) {
            feedbackData.questionId = this.currentExercise.questionId
          } else {
            // 如果没有题目ID，提交答案
            feedbackData.answer = this.currentExercise.correctAnswer
          }
        } else {
          // 其他题型：提交答案
          feedbackData.answer = this.currentExercise.correctAnswer
        }
        
        // 如果有时态、语气、人称信息，也一并提交（用于组合填空外的题型）
        if (this.currentExercise.tense) {
          feedbackData.tense = this.currentExercise.tense
        }
        if (this.currentExercise.mood) {
          feedbackData.mood = this.currentExercise.mood
        }
        if (this.currentExercise.person) {
          feedbackData.person = this.currentExercise.person
        }
        
        const res = await api.submitQuestionFeedback(feedbackData)
        
        hideLoading()
        
        if (res.success) {
          showToast('感谢您的反馈！', 'success')
          this.showReportModal = false
          this.reportComment = ''
          this.selectedIssueTypes = []  // 清空选中的问题类型
        } else {
          showToast(res.message || '提交失败', 'none')
        }
      } catch (error) {
        hideLoading()
        console.error('提交反馈失败:', error)
        showToast('提交失败，请重试', 'none')
      }
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
  background: #8B0012;
}

.custom-message.error {
  background: #d32f2f;
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
  color: #8B0012;
  font-weight: bold;
  margin-right: 8rpx;
  line-height: 1;
}

.back-text {
  font-size: 32rpx;
  color: #8B0012;
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
  padding: 30rpx 20rpx 10rpx;
  background: #fff;
}

.progress-bar-wrapper {
  margin-bottom: 20rpx;
}

.progress-bar {
  height: 12rpx;
  background: #f0f0f0;
  border-radius: 4rpx;
  overflow: hidden;
  margin-bottom: 18rpx;
}

.progress-fill {
  height: 100%;
  background: #8B0012;
  transition: width 0.3s;
}

.progress-text {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #999;
}

.progress-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 4rpx;
}

.progress-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 0rpx 12rpx;
  font-size: 26rpx;
  border-radius: 8rpx;
  border: none;
  color: #5c6ac4;
  background: transparent;
}

.progress-btn::after {
  border: none;
}

.progress-btn:disabled {
  color: #b3b8d4;
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

.header-actions {
  display: flex;
  gap: 15rpx;
  align-items: center;
}

.favorite-action-card {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 14rpx;
  border: 1rpx solid #e2e6f2;
  border-radius: 999rpx;
  background: #f8f9ff;
  cursor: pointer;
}

.favorite-action-card.active {
  border-color: #ffd27d;
  background: #fff7e8;
}

.favorite-action-icon {
  font-size: 34rpx;
  color: #b7bccb;
  line-height: 1;
}

.favorite-action-card.active .favorite-action-icon {
  color: #f4b400;
}

.favorite-action-text {
  font-size: 22rpx;
  color: #6f7384;
  line-height: 1.2;
}

.favorite-action-card.active .favorite-action-text {
  color: #8B0012;
}

.verb-info {
  text-align: center;
  margin: 30rpx 0;
}

.pronoun-meta {
  margin: -10rpx 0 24rpx;
  display: flex;
  justify-content: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.pronoun-meta-item {
  font-size: 24rpx;
  color: #8B0012;
  background: #fff4f4;
  border: 1rpx solid #ffd1d6;
  border-radius: 20rpx;
  padding: 8rpx 18rpx;
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
  color: #8B0012;
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
  background: #f5f5f5;
  border: 2rpx solid #d1d9e6;
  border-radius: 50rpx;
  font-size: 26rpx;
  color: #555;
  transition: all 0.3s ease;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.helper-btn.active {
  background: #8B0012;
  border-color: #8B0012;
  color: #fff;
  box-shadow: 0 4rpx 12rpx rgba(139, 0, 18, 0.3);
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
  border-left: 4rpx solid #8B0012;
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
  white-space: pre-line;
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
  background: #f6ffed;
}

.inline-feedback.wrong {
  border-left: 6rpx solid #ff4d4f;
  background: #fff1f0;
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
  background: #52c41a;
  color: #fff;
  border: none;
}

.inline-feedback .rating-btn.good-btn:active {
  background: #389e0d;
  transform: scale(0.95);
}

.inline-feedback .rating-btn.bad-btn {
  background: #ff4d4f;
  color: #fff;
  border: none;
}

.inline-feedback .rating-btn.bad-btn:active {
  background: #cf1322;
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
  color: #8B0012;
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

/* 练习类型导航栏样式 */
.exercise-type-navbar {
  display: flex;
  background: #f8f9fa;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 40rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  gap: 8rpx;
}

.exercise-type-navbar.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.navbar-item {
  flex: 1;
  text-align: center;
  padding: 20rpx 15rpx;
  border-radius: 12rpx;
  background: transparent;
  transition: all 0.3s ease;
  cursor: pointer;
}

.navbar-item.active {
  background: #8B0012;
  box-shadow: 0 4rpx 12rpx rgba(139, 0, 18, 0.3);
}

.navbar-item:not(.active):active {
  background: rgba(139, 0, 18, 0.1);
}

.navbar-item-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #666;
  transition: all 0.3s ease;
}

.navbar-item.active .navbar-item-text {
  color: #fff;
}

.navbar-item.disabled {
  cursor: not-allowed;
  background: #eeeeee;
  box-shadow: none;
}

.navbar-item.disabled .navbar-item-text {
  color: #aaaaaa;
}

.navbar-item.disabled:active {
  background: #eeeeee;
  transform: none;
}

/* 大圆形开始按钮容器 */
.start-button-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 30rpx 0;
  margin-bottom: 30rpx;
  position: relative;
}

/* 大圆形按钮 */
.big-circle-button {
  width: 320rpx;
  height: 320rpx;
  border-radius: 50%;
  background: #8B0012;
  box-shadow: 0 8rpx 24rpx rgba(139, 0, 18, 0.4);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.big-circle-button::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  animation: rotate 10s linear infinite;
}

.big-circle-button:active {
  transform: scale(0.95);
  box-shadow: 0 4rpx 16rpx rgba(139, 0, 18, 0.3);
}

.button-type {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 12rpx;
  z-index: 1;
}

.button-action {
  font-size: 32rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  z-index: 1;
}

.mode-help-button {
  position: absolute;
  top: 20rpx;
  right: 0;
  width: 70rpx;
  height: 70rpx;
  border-radius: 50%;
  border: 2rpx solid #8B0012;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 14rpx rgba(139, 0, 18, 0.2);
}

.mode-help-button:active {
  transform: scale(0.95);
}

.mode-help-button-text {
  font-size: 38rpx;
  font-weight: 700;
  color: #8B0012;
}

.sentence-mode-practice-item {
  padding-bottom: 18rpx;
}

.sentence-mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
  padding-bottom: 14rpx;
  border-bottom: 2rpx solid #e0e7ff;
}

.sentence-mode-header-left {
  display: flex;
  align-items: center;
  flex: 1;
}

.sentence-mode-title {
  margin-bottom: 0;
}

.mode-info-button {
  width: 38rpx;
  height: 38rpx;
  border-radius: 50%;
  border: 2rpx solid #8B0012;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 10rpx;
  background: #fff;
}

.mode-info-button-text {
  font-size: 24rpx;
  line-height: 1;
  color: #8B0012;
  font-weight: 600;
}

.sentence-mode-navbar {
  margin-bottom: 0;
}

.sentence-mode-navbar-item {
  padding: 18rpx 8rpx;
}

.sentence-mode-navbar-item-text {
  font-size: 24rpx;
}

.sentence-mode-locked {
  flex-shrink: 0;
  margin-left: 12rpx;
}

.exercise-mode-modal {
  width: 72%;
  max-width: 560rpx;
  padding: 46rpx 32rpx;
}

.exercise-mode-modal-title {
  display: block;
  font-size: 38rpx;
  font-weight: 700;
  color: #8B0012;
  margin-bottom: 28rpx;
  text-align: center;
}

.exercise-mode-list {
  max-height: 56vh;
  overflow-y: auto;
}

.exercise-mode-item {
  background: #fff8f8;
  border: 2rpx solid #f0d0d0;
  border-radius: 14rpx;
  padding: 20rpx 18rpx;
  margin-bottom: 14rpx;
}

.exercise-mode-item:last-child {
  margin-bottom: 0;
}

.exercise-mode-item-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #8B0012;
  margin-bottom: 10rpx;
}

.exercise-mode-item-desc {
  display: block;
  font-size: 29rpx;
  color: #555;
  line-height: 1.9;
}

/* 课程模式提示 */
.course-mode-tip {
  background: #fff8f8;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 30rpx;
  display: flex;
  align-items: flex-start;
  border: 2rpx solid #8B0012;
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
  color: #8B0012;
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
  background: #fff8f3;
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
  border-color: #8B0012;
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

.count-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  margin-top: 10rpx;
}

.count-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding-bottom: 15rpx;
  border-bottom: 2rpx solid #e0e7ff;
}

.count-btn {
  width: 80rpx;
  height: 80rpx;
  border-radius: 16rpx;
  background: #8B0012;
  color: #fff;
  font-size: 40rpx;
  font-weight: bold;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6rpx 16rpx rgba(139, 0, 18, 0.25);
}

.count-btn::after {
  border: none;
}

.count-btn:disabled {
  background: #e8e8e8;
  color: #b0b0b0;
  box-shadow: none;
}

.count-display {
  min-width: 140rpx;
  height: 80rpx;
  border-radius: 16rpx;
  border: 2rpx solid #e0e7ff;
  background: #f8f9ff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2rpx 6rpx rgba(0, 0, 0, 0.04);
}

.count-value {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.count-selector.disabled .count-display {
  background: #f5f5f5;
  border-color: #ebebeb;
  color: #b0b0b0;
  box-shadow: none;
}

/* 专项练习样式 */
.theme-practice-item {
  background: #fff8f8;
  border: 2rpx solid #f0d0d0;
  border-radius: 16rpx;
  padding: 25rpx;
  margin-bottom: 35rpx;
  box-shadow: 0 4rpx 12rpx rgba(139, 0, 18, 0.08);
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
  color: #8B0012;
  font-weight: bold;
  transition: transform 0.3s ease;
}

.theme-label {
  margin-bottom: 0;
  font-size: 30rpx;
  font-weight: 600;
  color: #8B0012;
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

.theme-section:last-child {
  margin-bottom: 0;
}

.mood-accordion {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.mood-panel {
  border: 2rpx solid #e9ecef;
  border-radius: 10rpx;
  background: #fff;
}

.mood-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 18rpx;
  min-height: 78rpx;
}

.mood-panel-left {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.mood-panel-title {
  font-size: 24rpx;
  color: #333;
  font-weight: 600;
}

.mood-panel-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 20rpx;
  margin-left: auto;
}

.mood-panel-count {
  font-size: 22rpx;
  color: #8B0012;
  text-align: right;
}

.mood-panel-body {
  border-top: 2rpx solid #f2f2f2;
  padding: 12rpx;
}

.mood-actions {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 12rpx;
}

.mood-actions .quick-btn {
  margin-right: 0;
  min-width: 110rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.mood-actions button {
  margin-left: 0 !important;
  margin-right: 0 !important;
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
  background: #fff8f8;
  border-color: #8B0012;
}

.checkbox-icon {
  font-size: 28rpx;
  margin-right: 8rpx;
  color: #999;
}

.checkbox-item.checked .checkbox-icon {
  color: #8B0012;
}

.checkbox-label {
  font-size: 24rpx;
  color: #333;
}

.checkbox-label-dimmed {
  color: #9aa0a6;
}

.quick-btn {
  padding: 8rpx 20rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  background: #8B0012;
  color: #fff;
  border: none;
  margin-right: 10rpx;
  min-width: auto;
  line-height: 1.4;
}

.quick-btn.secondary {
  background: #fff;
  color: #8B0012;
  border: 2rpx solid #8B0012;
}

.quick-btn::after {
  border: none;
}

.other-option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 8rpx 4rpx;
}

.other-option-info {
  flex: 1;
}

.other-option-title {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 6rpx;
}

.other-option-desc {
  display: block;
  font-size: 22rpx;
  color: #8c8c8c;
}

/* AI 开关样式优化 */
.ai-switch-item {
  background: #fff8f8;
  border: 2rpx solid #f0d0d0;
  border-radius: 16rpx;
  padding: 25rpx;
  margin-bottom: 35rpx;
  box-shadow: 0 4rpx 12rpx rgba(139, 0, 18, 0.08);
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
  background: radial-gradient(circle, rgba(139, 0, 18, 0.03) 0%, transparent 70%);
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
  color: #8B0012;
}

.ai-description-box {
  background: rgba(139, 0, 18, 0.05);
  padding: 15rpx 20rpx;
  border-radius: 12rpx;
  border-left: 4rpx solid #8B0012;
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
  background: #fff8f8;
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
  color: #8B0012;
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
  background: #8B0012;
  color: #fff;
  padding: 20rpx;
  border-radius: 12rpx;
  margin: 15rpx 0;
  font-size: 26rpx;
  line-height: 1.6;
}

.ai-translation {
  background: #fff8f8;
  color: #8B0012;
  padding: 15rpx 20rpx;
  border-radius: 10rpx;
  margin-top: 15rpx;
  font-size: 24rpx;
  border-left: 4rpx solid #8B0012;
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
  background: #ff4d4f;
  color: #fff;
  padding: 8rpx 20rpx;
  border-radius: 30rpx;
  font-size: 22rpx;
  box-shadow: 0 4rpx 12rpx rgba(255, 77, 79, 0.3);
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
  background: #52c41a;
  color: #fff;
}

.good-btn:active {
  background: #389e0d;
  transform: scale(0.95);
}

.bad-btn {
  background: #ff4d4f;
  color: #fff;
}

.bad-btn:active {
  background: #cf1322;
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
  color: #8B0012;
  font-weight: bold;
}

.summary-divider {
  height: 2rpx;
  background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
  margin: 30rpx 0;
}

.summary-question {
  background: #fff8f3;
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
  background: #e3f2fd;
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
  border-color: #8B0012;
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
  color: #8B0012;
  background: rgba(139, 0, 18, 0.1);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.requirement-tense {
  font-size: 24rpx;
  color: #B8001F;
  background: rgba(184, 0, 31, 0.1);
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
  border-color: #8B0012;
  box-shadow: 0 0 0 4rpx rgba(139, 0, 18, 0.1);
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

/* 导航栏右侧按钮 */
.navbar-right {
  display: flex;
  align-items: center;
  min-width: 120rpx;
  justify-content: flex-end;
}

.report-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 16rpx;
  background: #ff9800;
  border-radius: 20rpx;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2rpx 8rpx rgba(255, 152, 0, 0.3);
}

.report-btn:active {
  transform: scale(0.95);
  box-shadow: 0 1rpx 4rpx rgba(255, 152, 0, 0.3);
}

.report-icon {
  font-size: 24rpx;
  line-height: 1;
}

.report-text {
  font-size: 22rpx;
  color: #fff;
  font-weight: 600;
  line-height: 1;
}

/* 题目反馈弹窗样式 */
.modal-content.report-modal {
  max-width: 650rpx;
  padding: 50rpx 40rpx;
}

.report-title {
  display: block;
  text-align: center;
  font-size: 38rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 12rpx;
}

.report-subtitle {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #999;
  margin-bottom: 35rpx;
}

.report-info {
  background: #fff8f8;
  border: 2rpx solid #f0d0d0;
  border-radius: 12rpx;
  padding: 20rpx 25rpx;
  margin-bottom: 30rpx;
}

.info-row {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.05);
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 26rpx;
  color: #666;
  min-width: 100rpx;
  font-weight: 500;
}

.info-value {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
  flex: 1;
}

.report-input-section {
  margin-bottom: 30rpx;
}

.input-label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
  font-weight: 500;
}

.report-textarea {
  width: 100%;
  min-height: 200rpx;
  background: #f8f9fa;
  border: 2rpx solid #e9ecef;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
  box-sizing: border-box;
  transition: all 0.3s ease;
}

.report-textarea:focus {
  border-color: #8B0012;
  background: #fff;
  box-shadow: 0 0 0 4rpx rgba(139, 0, 18, 0.1);
}

.char-count {
  display: block;
  text-align: right;
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
}

.report-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 10rpx;
}

.report-actions button {
  flex: 1;
  padding: 25rpx;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: 600;
  border: none;
  transition: all 0.3s ease;
}

.report-actions .btn-secondary {
  background: #f5f5f5;
  color: #666;
}

.report-actions .btn-secondary:active {
  background: #e0e0e0;
}

.report-actions .btn-primary {
  background: #8B0012;
  color: #fff;
  box-shadow: 0 4rpx 12rpx rgba(139, 0, 18, 0.3);
}

.report-actions .btn-primary:active {
  transform: translateY(2rpx);
  box-shadow: 0 2rpx 8rpx rgba(139, 0, 18, 0.3);
}

/* 问题类型选择区域 */
.issue-types-section {
  margin-bottom: 30rpx;
}

.section-label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 15rpx;
  font-weight: 500;
}

.issue-types-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15rpx;
}

.issue-type-item {
  background: #f8f9fa;
  border: 2rpx solid #e9ecef;
  border-radius: 12rpx;
  padding: 20rpx 15rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  cursor: pointer;
  transition: all 0.3s ease;
}

.issue-type-item:active {
  transform: scale(0.98);
}

.issue-type-item.selected {
  background: #fff8f8;
  border-color: #8B0012;
  box-shadow: 0 2rpx 8rpx rgba(139, 0, 18, 0.15);
}

.issue-checkbox {
  font-size: 32rpx;
  color: #999;
  transition: all 0.3s ease;
}

.issue-type-item.selected .issue-checkbox {
  color: #8B0012;
}

.issue-label {
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
  flex: 1;
}

.issue-type-item.selected .issue-label {
  color: #8B0012;
}
</style>
