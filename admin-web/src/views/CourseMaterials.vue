<template>
  <section class="card management-page course-materials-page">
    <div class="management-header">
      <div>
        <div class="header-title-row">
          <h2 v-if="!activeTextbook">教材管理</h2>
          <h2 v-else>当前教材：{{ activeTextbook.name }}</h2>
          <span v-if="!activeTextbook" class="header-note">仅可修改自己上传的教材</span>
        </div>
      </div>
      <div class="toolbar management-toolbar">
        <div class="toolbar-left">
          <button v-if="activeTextbook" class="ghost" @click="backToTextbookList">返回教材列表</button>
          <span v-else class="toolbar-count">共 {{ textbooks.length }} 本</span>
          <button v-else class="ghost" @click="openCreateTextbookDialog">添加教材</button>
        </div>
        <div class="management-actions">
          <button
            v-if="!activeTextbook"
            class="danger"
            @click="refreshTextbooks()"
            :disabled="loadingCurrentView"
          >
            刷新
          </button>
          <button
            v-if="activeTextbook"
            class="ghost"
            @click="addLesson"
            :disabled="addingLesson || loadingLessons || !canManageActiveTextbook"
            :title="canManageActiveTextbook ? '' : TEXTBOOK_MANAGE_LOCK_HINT"
          >
            {{ addingLesson ? '添加中...' : '添加课程' }}
          </button>
          <button
            v-if="activeTextbook"
            class="danger"
            @click="loadLessons"
            :disabled="loadingLessons || addingLesson"
          >
            {{ loadingLessons ? '刷新中...' : '刷新' }}
          </button>
        </div>
      </div>
    </div>

    <div class="management-page-body">
      <div v-if="pageError" class="error-block">
        <p class="error">{{ pageError }}</p>
        <button class="ghost" @click="activeTextbook ? loadLessons() : refreshTextbooks()">重试</button>
      </div>

      <div v-else-if="loadingCurrentView" class="loading">加载中...</div>

      <div v-else-if="!activeTextbook" class="management-table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>教材名</th>
              <th>上传者</th>
              <th>课程数</th>
              <th>发布状态</th>
              <th>最近修改时间</th>
              <th class="col-actions"><span class="col-actions-label">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in textbooks" :key="item.id">
              <td>{{ item.name }}</td>
              <td>{{ displayUploader(item) }}</td>
              <td>{{ item.lesson_count || 0 }}</td>
              <td>
                <div class="status-cell">
                  <span class="tag" :class="item.is_published ? 'success' : 'warning'">
                    {{ item.is_published ? '已发布' : '草稿' }}
                  </span>
                  <button
                    class="ghost publish-btn"
                    :disabled="publishLoading[item.id] || !canManageTextbook(item)"
                    :title="canManageTextbook(item) ? '' : TEXTBOOK_MANAGE_LOCK_HINT"
                    @click="togglePublished(item)"
                  >
                    {{ publishLoading[item.id] ? '处理中...' : (item.is_published ? '取消发布' : '发布教材') }}
                  </button>
                </div>
              </td>
              <td>{{ formatDateTime(item.updated_at || item.created_at) }}</td>
              <td class="actions textbook-actions">
                <button
                  class="ghost"
                  @click="enterTextbook(item)"
                >
                  {{ canManageTextbook(item) ? '设置课程' : '查看教材' }}
                </button>
                <button
                  class="danger"
                  :disabled="deleteLoading[item.id] || !canManageTextbook(item)"
                  :title="canManageTextbook(item) ? '' : TEXTBOOK_MANAGE_LOCK_HINT"
                  @click="confirmDeleteTextbook(item)"
                >
                  删除
                </button>
              </td>
            </tr>
            <tr v-if="!textbooks.length">
              <td colspan="6" class="empty">暂无教材，请先新增教材</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="management-table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th>课程名</th>
              <th>本课单词数</th>
              <th>本课时态数</th>
              <th class="lesson-col-actions"><span class="lesson-col-actions-label">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="lesson in lessons" :key="lesson.id">
              <td>
                <div class="lesson-title-cell">
                  <input
                    v-model.trim="lesson.titleDraft"
                    class="lesson-title-input"
                    placeholder="课程名称"
                    :disabled="!canManageActiveTextbook"
                    @input="queueLessonTitleSave(lesson)"
                    @blur="flushLessonTitleSave(lesson, true)"
                    @keydown.enter.prevent="handleLessonTitleEnter"
                  />
                </div>
              </td>
              <td>{{ lesson.vocabulary_count || 0 }}</td>
              <td>{{ lesson.tense_count || 0 }}</td>
              <td class="actions lesson-actions">
                <button
                  class="ghost"
                  :disabled="!canManageActiveTextbook"
                  :title="canManageActiveTextbook ? '' : TEXTBOOK_MANAGE_LOCK_HINT"
                  @click="openWordDialog(lesson)"
                >
                  设置单词
                </button>
                <button
                  class="ghost"
                  :disabled="!canManageActiveTextbook"
                  :title="canManageActiveTextbook ? '' : TEXTBOOK_MANAGE_LOCK_HINT"
                  @click="openTenseDialog(lesson)"
                >
                  设置时态
                </button>
                <button
                  class="danger"
                  :disabled="deleteLoading[lesson.id] || !canManageActiveTextbook"
                  :title="canManageActiveTextbook ? '' : TEXTBOOK_MANAGE_LOCK_HINT"
                  @click="confirmDeleteLesson(lesson)"
                >
                  删除
                </button>
              </td>
            </tr>
            <tr v-if="!lessons.length">
              <td colspan="4" class="empty">当前教材还没有课程，点击右上角“添加课程”开始设置</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="createTextbookDialogOpen" class="overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>添加教材</h3>
          <button class="ghost" @click="closeCreateTextbookDialog">关闭</button>
        </div>
        <label>
          教材名
          <input v-model.trim="createTextbookForm.name" placeholder="请输入教材名称" />
          <span v-if="createTextbookFormError" class="field-error">{{ createTextbookFormError }}</span>
        </label>
        <div class="modal-actions">
          <button class="ghost" @click="closeCreateTextbookDialog">取消</button>
          <button :disabled="creatingTextbook" @click="submitCreateTextbook">
            {{ creatingTextbook ? '创建中...' : '确认添加' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="wordDialogOpen" class="overlay">
      <div class="drawer course-drawer word-drawer">
        <header>
          <h3>设置单词 - {{ activeTextbook?.name || '-' }} - {{ wordDialogLesson?.title || '-' }}</h3>
          <button class="ghost" @click="closeWordDialog">关闭</button>
        </header>

        <div class="word-toolbar">
          <div class="word-search-input-wrap">
            <input
              v-model.trim="wordSearchKeyword"
              placeholder="搜索词库（原形/释义）"
              @keydown.enter.prevent="fetchWordSearchRows"
            />
            <button
              v-if="wordSearchKeyword"
              type="button"
              class="word-search-clear"
              :disabled="wordSearchLoading"
              @click="clearWordSearch"
            >
              ×
            </button>
          </div>
          <button class="word-search-button" :disabled="wordSearchLoading" @click="fetchWordSearchRows">
            {{ wordSearchLoading ? '搜索中...' : '搜索' }}
          </button>
        </div>

        <div class="word-dialog-body">
          <section class="word-panel">
            <h4>词库搜索结果</h4>
            <div v-if="wordSearchLoading" class="loading">搜索中...</div>
            <div v-else-if="wordSearchRows.length" class="word-list">
              <article v-for="item in wordSearchRows" :key="`search-${item.id}`" class="word-item">
                <div>
                  <div class="word-main">{{ item.infinitive }}</div>
                  <div class="muted">{{ item.meaning || '-' }}</div>
                </div>
                <button
                  class="ghost"
                  :class="{ active: isWordSelected(item.id) }"
                  @click="toggleSelectedWord(item)"
                >
                  {{ isWordSelected(item.id) ? '已添加' : '添加' }}
                </button>
              </article>
            </div>
            <p v-else class="empty">没有匹配词条</p>
          </section>

          <section class="word-panel">
            <h4>课程单词（{{ wordSelectedRows.length }}）</h4>
            <div v-if="wordDialogLoading" class="loading">加载中...</div>
            <div v-else-if="wordSelectedRows.length" class="word-list">
              <article v-for="item in wordSelectedRows" :key="`selected-${item.id}`" class="word-item selected">
                <div>
                  <div class="word-main">{{ item.infinitive }}</div>
                  <div class="muted">{{ item.meaning || '-' }}</div>
                </div>
                <button class="ghost" @click="removeSelectedWord(item.id)">移除</button>
              </article>
            </div>
            <p v-else class="empty">当前课程暂无单词</p>
          </section>
        </div>

        <div class="modal-actions">
          <button class="ghost" @click="closeWordDialog">不保存</button>
          <button :disabled="wordDialogSaving || !canManageActiveTextbook" @click="saveLessonWords">
            {{ wordDialogSaving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="tenseDialogOpen" class="overlay">
      <div class="drawer course-drawer tense-drawer">
        <header class="tense-drawer-header">
          <div class="tense-header-main">
            <h3>设置时态 - {{ activeTextbook?.name || '-' }} - {{ tenseDialogLesson?.title || '-' }}</h3>
            <div class="tense-header-actions">
              <span class="muted">已选 {{ selectedTenses.length }} 项</span>
              <button class="ghost tense-header-btn" @click="selectAllTenses">全选</button>
              <button class="ghost tense-header-btn" @click="clearAllTenses">清除</button>
            </div>
          </div>
          <button class="ghost" @click="closeTenseDialog">关闭</button>
        </header>

        <div class="mood-grid">
          <section v-for="mood in moodOptions" :key="mood.value" class="mood-column">
            <div class="mood-column-header">
              <div class="mood-column-head-main">
                <span class="mood-column-title">{{ mood.label }}</span>
                <span class="mood-column-count">已选 {{ getSelectedTenseCountByMood(mood.value) }} 项</span>
              </div>
              <div class="mood-actions mood-actions-mini">
                <button class="ghost mood-mini-btn" @click="selectAllTensesInMood(mood.value)">全选</button>
                <button class="ghost mood-mini-btn" @click="clearTensesInMood(mood.value)">清除</button>
              </div>
            </div>

            <div class="tense-list">
              <button
                v-for="tense in getTensesByMood(mood.value)"
                :key="tense.value"
                class="tense-row"
                :class="{ checked: selectedTenses.includes(tense.value) }"
                @click.prevent="toggleTense(tense.value)"
              >
                <span class="checkbox-icon">{{ selectedTenses.includes(tense.value) ? '☑' : '☐' }}</span>
                <span class="checkbox-label">
                  <span class="tense-label-es">{{ tense.labelEs }}</span>
                  <span v-if="tense.labelZh" class="tense-label-zh">{{ tense.labelZh }}</span>
                </span>
              </button>
            </div>
          </section>
        </div>

        <div class="modal-actions tense-footer">
          <p class="tense-footer-note">默认勾选了9种常见时态，请根据需要进行调整。</p>
          <div class="tense-footer-actions">
            <button class="ghost" @click="closeTenseDialog">不保存</button>
            <button :disabled="tenseDialogSaving || !canManageActiveTextbook" @click="saveLessonTenses">
              {{ tenseDialogSaving ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="confirmDialog.open" class="overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ confirmDialog.title }}</h3>
        </div>
        <p v-if="confirmDialog.message">{{ confirmDialog.message }}</p>
        <p v-if="confirmDialog.hint" class="muted">{{ confirmDialog.hint }}</p>
        <div class="modal-actions">
          <button class="ghost" @click="closeConfirmDialog">取消</button>
          <button class="danger" :disabled="confirmDialog.submitting" @click="submitConfirmDialog">
            {{ confirmDialog.submitting ? '处理中...' : confirmDialog.confirmText }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="toast.visible" class="toast" :class="toast.type">{{ toast.message }}</div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { ApiError, apiRequest } from '../utils/apiClient'

const DEFAULT_MOOD_OPTIONS = [
  { value: 'indicativo', label: 'Indicativo 陈述式' },
  { value: 'subjuntivo', label: 'Subjuntivo 虚拟式' },
  { value: 'condicional', label: 'Condicional 条件式' },
  { value: 'imperativo', label: 'Imperativo 命令式' }
]
const DEFAULT_TENSE_OPTIONS = [
  { value: 'presente', label: 'Presente（陈述式 一般现在时）', mood: 'indicativo' },
  { value: 'perfecto', label: 'Pretérito Perfecto（陈述式 现在完成时）', mood: 'indicativo' },
  { value: 'imperfecto', label: 'Pretérito Imperfecto（陈述式 过去未完成时）', mood: 'indicativo' },
  { value: 'preterito', label: 'Pretérito Indefinido（陈述式 简单过去时）', mood: 'indicativo' },
  { value: 'futuro', label: 'Futuro Imperfecto（陈述式 将来未完成时）', mood: 'indicativo' },
  { value: 'pluscuamperfecto', label: 'Pretérito Pluscuamperfecto（陈述式 过去完成时）', mood: 'indicativo' },
  { value: 'futuro_perfecto', label: 'Futuro Perfecto（陈述式 将来完成时）', mood: 'indicativo' },
  { value: 'preterito_anterior', label: 'Pretérito Anterior（陈述式 前过去时）', mood: 'indicativo' },
  { value: 'subjuntivo_presente', label: 'Presente（虚拟式 现在时）', mood: 'subjuntivo' },
  { value: 'subjuntivo_imperfecto', label: 'Pretérito Imperfecto（虚拟式 过去未完成时）', mood: 'subjuntivo' },
  { value: 'subjuntivo_perfecto', label: 'Pretérito Perfecto（虚拟式 现在完成时）', mood: 'subjuntivo' },
  { value: 'subjuntivo_pluscuamperfecto', label: 'Pretérito Pluscuamperfecto（虚拟式 过去完成时）', mood: 'subjuntivo' },
  { value: 'subjuntivo_futuro', label: 'Futuro（虚拟式 将来未完成时）', mood: 'subjuntivo' },
  { value: 'subjuntivo_futuro_perfecto', label: 'Futuro Perfecto（虚拟式 将来完成时）', mood: 'subjuntivo' },
  { value: 'condicional', label: 'Condicional Simple（简单条件式）', mood: 'condicional' },
  { value: 'condicional_perfecto', label: 'Condicional Compuesto（复合条件式）', mood: 'condicional' },
  { value: 'imperativo_afirmativo', label: 'Imperativo（命令式）', mood: 'imperativo' },
  { value: 'imperativo_negativo', label: 'Imperativo Negativo（否定命令式）', mood: 'imperativo' }
]
const router = useRouter()
const { logout, state, isDev } = useAuth()
const TEXTBOOK_MANAGE_LOCK_HINT = '仅可管理自己上传的教材'

const textbooks = ref([])
const lessons = ref([])
const activeTextbook = ref(null)
const pageError = ref('')
const loadingTextbooks = ref(false)
const loadingLessons = ref(false)
const addingLesson = ref(false)
const creatingTextbook = ref(false)

const publishLoading = reactive({})
const deleteLoading = reactive({})
const saveLessonTitleLoading = reactive({})
const lessonTitleSaveTimers = new Map()
const uploaderNameMap = reactive({})

const createTextbookDialogOpen = ref(false)
const createTextbookForm = reactive({ name: '' })
const createTextbookFormError = ref('')

const wordDialogOpen = ref(false)
const wordDialogLesson = ref(null)
const wordDialogLoading = ref(false)
const wordDialogSaving = ref(false)
const wordSearchLoading = ref(false)
const wordSearchKeyword = ref('')
const wordSearchRows = ref([])
const wordSelectedRows = ref([])

const tenseDialogOpen = ref(false)
const tenseDialogLesson = ref(null)
const tenseDialogSaving = ref(false)
const moodOptions = ref([...DEFAULT_MOOD_OPTIONS])
const tenseOptions = ref([...DEFAULT_TENSE_OPTIONS])
const selectedTenses = ref([])

const confirmDialog = reactive({
  open: false,
  title: '',
  message: '',
  hint: '',
  confirmText: '确认',
  submitting: false
})
let confirmHandler = null

const toast = reactive({
  visible: false,
  message: '',
  type: 'info'
})
let toastTimer = null
let wordSearchTimer = null
const LESSON_TITLE_AUTO_SAVE_DEBOUNCE_MS = 450

const loadingCurrentView = computed(() => (activeTextbook.value ? loadingLessons.value : loadingTextbooks.value))
const currentAdminId = computed(() => Number(state.user?.id || 0))
const canManageActiveTextbook = computed(() => canManageTextbook(activeTextbook.value))

const selectedWordIdSet = computed(() => {
  const set = new Set()
  wordSelectedRows.value.forEach((item) => {
    set.add(Number(item.id))
  })
  return set
})

function showToast(message, type = 'info') {
  toast.message = message
  toast.type = type
  toast.visible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.visible = false
  }, 3200)
}

function handleApiError(error, fallbackMessage = '操作失败') {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      showToast('登录已过期', 'error')
      logout()
      router.push({ name: 'Login', query: { error: 'expired' } })
      return
    }
    if (error.status === 403) {
      showToast(error.message || '无权限执行该操作', 'error')
      return
    }
    if (error.isNetworkError) {
      showToast('网络异常：无法连接到服务器（检查 API_BASE_URL/代理/CORS）', 'error')
      return
    }
    showToast(error.message || fallbackMessage, 'error')
    return
  }
  showToast(fallbackMessage, 'error')
}

function normalizeTextbookRow(item) {
  const rawUploaderId = item?.uploader_id
  const normalizedUploaderId = rawUploaderId === null || rawUploaderId === undefined || rawUploaderId === ''
    ? null
    : Number(rawUploaderId)
  return {
    ...item,
    lesson_count: Number(item.lesson_count || 0),
    is_published: item.is_published === true || Number(item.is_published) === 1,
    uploader_id: Number.isFinite(normalizedUploaderId) ? normalizedUploaderId : null
  }
}

function canManageTextbook(textbook) {
  if (!textbook) return false
  if (isDev.value) return true
  const uploaderId = Number(textbook.uploader_id || 0)
  const actorId = Number(currentAdminId.value || 0)
  return uploaderId > 0 && actorId > 0 && uploaderId === actorId
}

function showTextbookManageForbiddenToast() {
  showToast(TEXTBOOK_MANAGE_LOCK_HINT, 'error')
}

function displayUploader(textbook) {
  const uploaderId = Number(textbook?.uploader_id || 0)
  if (!uploaderId) return '-'
  const username = String(uploaderNameMap[uploaderId] || '').trim()
  return username || `ID ${uploaderId}`
}

async function ensureUploaderNames(rows = []) {
  const missingIds = Array.from(
    new Set(
      (Array.isArray(rows) ? rows : [])
        .map((item) => Number(item?.uploader_id || 0))
        .filter((id) => id > 0 && !uploaderNameMap[id])
    )
  )
  if (!missingIds.length) return

  await Promise.allSettled(
    missingIds.map(async (id) => {
      try {
        const user = await apiRequest(`/users/${id}`)
        const username = String(user?.username || '').trim()
        uploaderNameMap[id] = username || `ID ${id}`
      } catch (error) {
        uploaderNameMap[id] = `ID ${id}`
      }
    })
  )
}

function normalizeLessonRow(item) {
  return {
    ...item,
    vocabulary_count: Number(item.vocabulary_count || 0),
    tense_count: Number(item.tense_count || 0),
    tenses: Array.isArray(item.tenses) ? item.tenses : [],
    titleDraft: item.title || ''
  }
}

function clearAllLessonTitleSaveTimers() {
  lessonTitleSaveTimers.forEach((timer) => {
    clearTimeout(timer)
  })
  lessonTitleSaveTimers.clear()
}

function clearLessonTitleSaveTimerById(lessonId) {
  const targetId = Number(lessonId)
  if (!targetId) return
  const timer = lessonTitleSaveTimers.get(targetId)
  if (timer) {
    clearTimeout(timer)
    lessonTitleSaveTimers.delete(targetId)
  }
}

function getLessonById(lessonId) {
  const targetId = Number(lessonId)
  if (!targetId) return null
  return lessons.value.find((item) => Number(item.id) === targetId) || null
}

function formatDateTime(value) {
  if (!value) return '-'
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    hour12: false
  })
}

async function loadCourseMaterialOptions() {
  try {
    const data = await apiRequest('/course-materials/options')
    if (Array.isArray(data?.moods) && data.moods.length > 0) {
      moodOptions.value = data.moods
    }
    if (Array.isArray(data?.tenses) && data.tenses.length > 0) {
      tenseOptions.value = data.tenses
    }
  } catch (error) {
    handleApiError(error, '加载时态选项失败，已使用默认配置')
  }
}

async function refreshTextbooks() {
  loadingTextbooks.value = true
  pageError.value = ''
  try {
    const data = await apiRequest('/course-materials/textbooks')
    textbooks.value = Array.isArray(data?.rows)
      ? data.rows.map((item) => normalizeTextbookRow(item))
      : []
    if (activeTextbook.value) {
      const latest = textbooks.value.find((item) => item.id === activeTextbook.value.id)
      if (latest) {
        activeTextbook.value = latest
      }
    }
    ensureUploaderNames(textbooks.value)
  } catch (error) {
    pageError.value = error instanceof ApiError ? error.message : '加载教材失败'
    handleApiError(error, '加载教材失败')
  } finally {
    loadingTextbooks.value = false
  }
}

async function loadLessons() {
  if (!activeTextbook.value?.id) return
  clearAllLessonTitleSaveTimers()
  loadingLessons.value = true
  pageError.value = ''
  try {
    const data = await apiRequest(`/course-materials/textbooks/${activeTextbook.value.id}/lessons`)
    if (data?.textbook) {
      activeTextbook.value = normalizeTextbookRow({
        ...activeTextbook.value,
        ...data.textbook
      })
    }
    lessons.value = Array.isArray(data?.rows)
      ? data.rows.map((item) => normalizeLessonRow(item))
      : []
  } catch (error) {
    pageError.value = error instanceof ApiError ? error.message : '加载课程失败'
    handleApiError(error, '加载课程失败')
  } finally {
    loadingLessons.value = false
  }
}

function enterTextbook(textbook) {
  clearAllLessonTitleSaveTimers()
  activeTextbook.value = normalizeTextbookRow(textbook)
  lessons.value = []
  loadLessons()
}

function backToTextbookList() {
  clearAllLessonTitleSaveTimers()
  activeTextbook.value = null
  lessons.value = []
  pageError.value = ''
}

function openCreateTextbookDialog() {
  createTextbookForm.name = ''
  createTextbookFormError.value = ''
  createTextbookDialogOpen.value = true
}

function closeCreateTextbookDialog() {
  createTextbookDialogOpen.value = false
}

async function submitCreateTextbook() {
  const name = String(createTextbookForm.name || '').trim()
  if (!name) {
    createTextbookFormError.value = '教材名不能为空'
    return
  }
  creatingTextbook.value = true
  createTextbookFormError.value = ''
  try {
    await apiRequest('/course-materials/textbooks', {
      method: 'POST',
      body: { name }
    })
    createTextbookDialogOpen.value = false
    showToast('教材已添加（草稿）', 'success')
    await refreshTextbooks()
  } catch (error) {
    handleApiError(error, '添加教材失败')
  } finally {
    creatingTextbook.value = false
  }
}

async function togglePublished(item) {
  if (!canManageTextbook(item)) {
    showTextbookManageForbiddenToast()
    return
  }
  const isCancelPublish = Boolean(item.is_published)
  openConfirmDialog({
    title: isCancelPublish ? '确认取消发布' : '确认发布教材',
    message: isCancelPublish
      ? '取消后用户将无法将该教材添加至课程练习。已设置的课程内容不会删除。'
      : '请确保课程练习内容完整。发布后仍可以对课程内容进行修改。',
    hint: '',
    confirmText: '确定',
    onConfirm: async () => {
      publishLoading[item.id] = true
      try {
        const data = await apiRequest(`/course-materials/textbooks/${item.id}/publish`, {
          method: 'PUT',
          body: { isPublished: !item.is_published }
        })
        const updated = normalizeTextbookRow({
          ...item,
          ...(data?.row || {}),
          is_published: data?.row?.is_published ?? !item.is_published
        })
        const index = textbooks.value.findIndex((row) => row.id === item.id)
        if (index > -1) {
          textbooks.value[index] = { ...textbooks.value[index], ...updated }
        }
        if (activeTextbook.value?.id === item.id) {
          activeTextbook.value = { ...activeTextbook.value, ...updated }
        }
        showToast(updated.is_published ? '教材已发布' : '教材已改为草稿', 'success')
      } finally {
        publishLoading[item.id] = false
      }
    }
  })
}

function openConfirmDialog({ title, message, hint = '', confirmText = '确认', onConfirm }) {
  confirmDialog.title = title
  confirmDialog.message = message
  confirmDialog.hint = hint
  confirmDialog.confirmText = confirmText
  confirmDialog.submitting = false
  confirmDialog.open = true
  confirmHandler = onConfirm
}

function closeConfirmDialog() {
  if (confirmDialog.submitting) return
  confirmDialog.open = false
  confirmHandler = null
}

async function submitConfirmDialog() {
  if (!confirmHandler) return
  confirmDialog.submitting = true
  try {
    await confirmHandler()
    confirmDialog.open = false
    confirmHandler = null
  } catch (error) {
    handleApiError(error, '操作失败')
  } finally {
    confirmDialog.submitting = false
  }
}

function confirmDeleteTextbook(item) {
  if (!canManageTextbook(item)) {
    showTextbookManageForbiddenToast()
    return
  }
  openConfirmDialog({
    title: '确认删除教材',
    message: `即将删除教材「${item.name}」。`,
    hint: '这将删除教材中的全部课程，删除后不可恢复。',
    confirmText: '确认删除',
    onConfirm: async () => {
      deleteLoading[item.id] = true
      try {
        await apiRequest(`/course-materials/textbooks/${item.id}`, { method: 'DELETE' })
        showToast('教材已删除', 'success')
        if (activeTextbook.value?.id === item.id) {
          backToTextbookList()
        }
        await refreshTextbooks()
      } finally {
        deleteLoading[item.id] = false
      }
    }
  })
}

async function addLesson() {
  if (!activeTextbook.value?.id) return
  if (!canManageActiveTextbook.value) {
    showTextbookManageForbiddenToast()
    return
  }
  addingLesson.value = true
  try {
    await apiRequest(`/course-materials/textbooks/${activeTextbook.value.id}/lessons`, {
      method: 'POST'
    })
    showToast('课程已添加', 'success')
    await Promise.all([loadLessons(), refreshTextbooks()])
  } catch (error) {
    handleApiError(error, '添加课程失败')
  } finally {
    addingLesson.value = false
  }
}

function handleLessonTitleEnter(event) {
  if (event?.target && typeof event.target.blur === 'function') {
    event.target.blur()
  }
}

function queueLessonTitleSave(lesson) {
  if (!canManageActiveTextbook.value) return
  const lessonId = Number(lesson?.id)
  if (!lessonId) return
  clearLessonTitleSaveTimerById(lessonId)
  const timer = setTimeout(() => {
    lessonTitleSaveTimers.delete(lessonId)
    const current = getLessonById(lessonId)
    if (!current) return
    saveLessonTitle(current, { revertOnEmpty: false, silentSuccess: true })
  }, LESSON_TITLE_AUTO_SAVE_DEBOUNCE_MS)
  lessonTitleSaveTimers.set(lessonId, timer)
}

function flushLessonTitleSave(lesson, revertOnEmpty = false) {
  if (!canManageActiveTextbook.value) return
  const lessonId = Number(lesson?.id)
  if (!lessonId) return
  clearLessonTitleSaveTimerById(lessonId)
  const current = getLessonById(lessonId)
  if (!current) return
  saveLessonTitle(current, { revertOnEmpty, silentSuccess: true })
}

async function saveLessonTitle(lesson, options = {}) {
  if (!canManageActiveTextbook.value) return
  const { revertOnEmpty = false, silentSuccess = true } = options
  const lessonId = Number(lesson?.id)
  if (!lessonId) return
  const nextTitle = String(lesson.titleDraft || '').trim()
  if (!nextTitle) {
    if (revertOnEmpty) {
      lesson.titleDraft = lesson.title || ''
      showToast('课程名称不能为空', 'error')
    }
    return
  }
  if (nextTitle === lesson.title) return
  if (saveLessonTitleLoading[lessonId]) {
    queueLessonTitleSave(lesson)
    return
  }
  saveLessonTitleLoading[lessonId] = true
  try {
    const data = await apiRequest(`/course-materials/lessons/${lessonId}`, {
      method: 'PUT',
      body: { title: nextTitle }
    })
    const updated = normalizeLessonRow(data?.row || lesson)
    const index = lessons.value.findIndex((item) => Number(item.id) === lessonId)
    if (index > -1) {
      lessons.value[index] = {
        ...lessons.value[index],
        ...updated,
        titleDraft: updated.title
      }
    }
    if (!silentSuccess) {
      showToast('课程名称已更新', 'success')
    }
    await refreshTextbooks()
  } catch (error) {
    lesson.titleDraft = lesson.title
    handleApiError(error, '更新课程名称失败')
  } finally {
    saveLessonTitleLoading[lessonId] = false
  }
}

function confirmDeleteLesson(lesson) {
  if (!canManageActiveTextbook.value) {
    showTextbookManageForbiddenToast()
    return
  }
  openConfirmDialog({
    title: '确认删除课程',
    message: `即将删除课程「${lesson.title}」。`,
    hint: '删除后不可恢复。',
    confirmText: '确认删除',
    onConfirm: async () => {
      clearLessonTitleSaveTimerById(lesson.id)
      deleteLoading[lesson.id] = true
      try {
        await apiRequest(`/course-materials/lessons/${lesson.id}`, { method: 'DELETE' })
        showToast('课程已删除', 'success')
        await Promise.all([loadLessons(), refreshTextbooks()])
      } finally {
        deleteLoading[lesson.id] = false
      }
    }
  })
}

async function openWordDialog(lesson) {
  if (!canManageActiveTextbook.value) {
    showTextbookManageForbiddenToast()
    return
  }
  wordDialogLesson.value = lesson
  wordDialogOpen.value = true
  wordDialogLoading.value = true
  wordDialogSaving.value = false
  wordSearchKeyword.value = ''
  wordSelectedRows.value = []
  wordSearchRows.value = []
  try {
    const data = await apiRequest(`/course-materials/lessons/${lesson.id}/verbs`)
    wordSelectedRows.value = Array.isArray(data?.rows)
      ? data.rows.map((item) => ({
        id: Number(item.id),
        infinitive: item.infinitive || '',
        meaning: item.meaning || ''
      }))
      : []
  } catch (error) {
    handleApiError(error, '加载课程单词失败')
  } finally {
    wordDialogLoading.value = false
  }
  fetchWordSearchRows()
}

function closeWordDialog() {
  wordDialogOpen.value = false
  wordDialogLesson.value = null
  wordDialogLoading.value = false
  wordDialogSaving.value = false
  wordSearchKeyword.value = ''
  wordSearchRows.value = []
  wordSelectedRows.value = []
}

function clearWordSearch() {
  if (!wordDialogOpen.value) return
  wordSearchKeyword.value = ''
  if (wordSearchTimer) clearTimeout(wordSearchTimer)
  fetchWordSearchRows()
}

async function fetchWordSearchRows() {
  if (!wordDialogOpen.value) return
  wordSearchLoading.value = true
  try {
    const data = await apiRequest('/verbs', {
      params: {
        q: wordSearchKeyword.value || undefined,
        limit: 60,
        offset: 0,
        id_order: 'asc'
      }
    })
    wordSearchRows.value = Array.isArray(data?.rows)
      ? data.rows.map((item) => ({
        id: Number(item.id),
        infinitive: item.infinitive || '',
        meaning: item.meaning || ''
      }))
      : []
  } catch (error) {
    handleApiError(error, '搜索词库失败')
  } finally {
    wordSearchLoading.value = false
  }
}

function isWordSelected(verbId) {
  return selectedWordIdSet.value.has(Number(verbId))
}

function toggleSelectedWord(item) {
  const verbId = Number(item.id)
  if (isWordSelected(verbId)) {
    removeSelectedWord(verbId)
  } else {
    wordSelectedRows.value.push({
      id: verbId,
      infinitive: item.infinitive,
      meaning: item.meaning || ''
    })
  }
}

function removeSelectedWord(verbId) {
  const targetId = Number(verbId)
  wordSelectedRows.value = wordSelectedRows.value.filter((item) => Number(item.id) !== targetId)
}

async function saveLessonWords() {
  if (!wordDialogLesson.value?.id) return
  if (!canManageActiveTextbook.value) {
    showTextbookManageForbiddenToast()
    return
  }
  wordDialogSaving.value = true
  try {
    await apiRequest(`/course-materials/lessons/${wordDialogLesson.value.id}/verbs`, {
      method: 'PUT',
      body: {
        verbIds: wordSelectedRows.value.map((item) => Number(item.id))
      }
    })
    showToast('课程单词已保存', 'success')
    closeWordDialog()
    await Promise.all([loadLessons(), refreshTextbooks()])
  } catch (error) {
    handleApiError(error, '保存课程单词失败')
  } finally {
    wordDialogSaving.value = false
  }
}

function openTenseDialog(lesson) {
  if (!canManageActiveTextbook.value) {
    showTextbookManageForbiddenToast()
    return
  }
  tenseDialogLesson.value = lesson
  selectedTenses.value = Array.isArray(lesson.tenses) ? [...lesson.tenses] : []
  tenseDialogOpen.value = true
}

function closeTenseDialog() {
  tenseDialogOpen.value = false
  tenseDialogLesson.value = null
  tenseDialogSaving.value = false
  selectedTenses.value = []
}

function splitTenseLabel(label) {
  const raw = String(label || '').trim()
  const match = raw.match(/^(.+?)\s*[（(]\s*(.+?)\s*[）)]\s*$/)
  if (!match) {
    return { es: raw, zh: '' }
  }
  return {
    es: String(match[1] || '').trim(),
    zh: String(match[2] || '').trim()
  }
}

function getTensesByMood(moodValue) {
  return tenseOptions.value
    .filter((item) => item.mood === moodValue)
    .map((item) => {
      const parts = splitTenseLabel(item.label)
      return {
        ...item,
        labelEs: parts.es,
        labelZh: parts.zh
      }
    })
}

function getSelectedTenseCountByMood(moodValue) {
  const inMood = getTensesByMood(moodValue).map((item) => item.value)
  return inMood.filter((value) => selectedTenses.value.includes(value)).length
}

function toggleTense(tenseValue) {
  const index = selectedTenses.value.indexOf(tenseValue)
  if (index > -1) {
    selectedTenses.value.splice(index, 1)
  } else {
    selectedTenses.value.push(tenseValue)
  }
}

function selectAllTensesInMood(moodValue) {
  const next = new Set(selectedTenses.value)
  getTensesByMood(moodValue).forEach((item) => {
    next.add(item.value)
  })
  selectedTenses.value = Array.from(next)
}

function clearTensesInMood(moodValue) {
  const removeSet = new Set(getTensesByMood(moodValue).map((item) => item.value))
  selectedTenses.value = selectedTenses.value.filter((value) => !removeSet.has(value))
}

function selectAllTenses() {
  selectedTenses.value = tenseOptions.value.map((item) => item.value)
}

function clearAllTenses() {
  selectedTenses.value = []
}

async function saveLessonTenses() {
  if (!tenseDialogLesson.value?.id) return
  if (!canManageActiveTextbook.value) {
    showTextbookManageForbiddenToast()
    return
  }
  tenseDialogSaving.value = true
  try {
    const data = await apiRequest(`/course-materials/lessons/${tenseDialogLesson.value.id}`, {
      method: 'PUT',
      body: {
        tenses: [...selectedTenses.value]
      }
    })
    const updated = normalizeLessonRow(data?.row || {})
    const index = lessons.value.findIndex((item) => item.id === tenseDialogLesson.value.id)
    if (index > -1) {
      lessons.value[index] = {
        ...lessons.value[index],
        ...updated,
        titleDraft: updated.title || lessons.value[index].titleDraft
      }
    }
    showToast('课程时态已保存', 'success')
    closeTenseDialog()
    await refreshTextbooks()
  } catch (error) {
    handleApiError(error, '保存课程时态失败')
  } finally {
    tenseDialogSaving.value = false
  }
}

watch(wordSearchKeyword, () => {
  if (!wordDialogOpen.value) return
  if (wordSearchTimer) clearTimeout(wordSearchTimer)
  wordSearchTimer = setTimeout(() => {
    fetchWordSearchRows()
  }, 240)
})

onMounted(async () => {
  await Promise.all([
    loadCourseMaterialOptions(),
    refreshTextbooks()
  ])
})

onBeforeUnmount(() => {
  clearAllLessonTitleSaveTimers()
})
</script>

<style scoped>
.course-materials-page {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.header-title-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
  flex-wrap: wrap;
}

.header-note {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.2;
  white-space: nowrap;
}

.toolbar-count {
  color: var(--muted);
  font-size: 14px;
  white-space: nowrap;
}

.course-materials-page :deep(td.actions) {
  justify-content: flex-end;
}

.course-materials-page :deep(th.col-actions) {
  text-align: right;
}

.course-materials-page :deep(th.col-actions .col-actions-label) {
  display: inline-block;
  min-width: 145px;
  text-align: left;
}

.course-materials-page :deep(th.lesson-col-actions) {
  text-align: right;
}

.course-materials-page :deep(th.lesson-col-actions .lesson-col-actions-label) {
  display: inline-block;
  min-width: 240px;
  text-align: left;
}

.course-materials-page :deep(.management-toolbar) {
  margin-right: 10px;
}

.status-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tag.warning {
  background: rgba(133, 94, 44, 0.15);
  color: #835322;
  border-color: rgba(133, 94, 44, 0.2);
}

.publish-btn {
  padding: 6px 10px;
}

.lesson-title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lesson-title-input {
  min-width: 180px;
  max-width: 320px;
}

.course-drawer {
  width: min(980px, 98vw);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
}

.word-drawer,
.tense-drawer {
  gap: 12px;
}

.word-drawer {
  height: 88vh;
  max-height: 88vh;
}

.tense-drawer {
  height: 88vh;
  max-height: 88vh;
}

.word-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.tense-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.tense-header-main {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tense-header-main h3 {
  margin: 0;
  flex-shrink: 0;
}

.tense-header-actions {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tense-header-actions .muted {
  white-space: nowrap;
  font-size: 12px;
}

.tense-header-btn {
  padding: 4px 10px;
  font-size: 12px;
  line-height: 1.1;
  border-radius: 8px;
}

.word-search-input-wrap {
  min-width: 220px;
  flex: 1;
  position: relative;
}

.word-search-input-wrap input {
  width: 100%;
  padding-right: 34px;
}

.word-search-button {
  min-width: 144px;
}

.word-search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  min-width: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  box-shadow: none;
  line-height: 1;
}

.word-search-clear:hover {
  transform: translateY(-50%);
  background: rgba(139, 0, 18, 0.08);
  color: var(--theme-red-dark);
  box-shadow: none;
}

.word-search-clear:disabled {
  transform: translateY(-50%);
}

.word-dialog-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.word-panel {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px;
  background: #fff;
  min-height: 260px;
  display: flex;
  flex-direction: column;
}

.word-panel h4 {
  margin: 0 0 10px;
  color: var(--theme-red-dark);
}

.word-list {
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  padding-right: 4px;
}

.word-item {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #fffdf9;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.word-item.selected {
  border-color: rgba(139, 0, 18, 0.28);
  background: rgba(139, 0, 18, 0.06);
}

.word-main {
  font-weight: 700;
}

.word-item .muted {
  font-size: 10px;
  line-height: 1.15;
}

.ghost.active {
  border-color: rgba(139, 0, 18, 0.26);
  background: rgba(139, 0, 18, 0.08);
  color: var(--theme-red-dark);
}

.mood-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.mood-column {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #ffffff;
  padding: 8px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 8px;
}

.mood-column-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
}

.mood-column-head-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.mood-column-title {
  font-weight: 700;
  color: var(--theme-red-dark);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.mood-column-count {
  color: var(--muted);
  font-size: 12px;
}

.mood-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mood-actions-mini {
  gap: 4px;
  flex-shrink: 0;
}

.mood-mini-btn {
  padding: 2px 7px;
  font-size: 11px;
  line-height: 1.1;
  border-radius: 8px;
}

.tense-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 2px;
}

.tense-row {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 5px 7px;
  display: flex;
  align-items: center;
  gap: 5px;
  justify-content: flex-start;
  background: #fffdf9;
  box-shadow: none;
  color: var(--text);
  text-align: left;
}

.tense-row:hover {
  transform: none;
  box-shadow: none;
}

.tense-row.checked {
  border-color: rgba(139, 0, 18, 0.28);
  background: rgba(139, 0, 18, 0.08);
}

.checkbox-label {
  flex: 1;
  font-size: 12px;
  line-height: 1.25;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.tense-label-es {
  font-weight: 700;
}

.tense-label-zh {
  color: var(--muted);
  font-size: 11px;
}

.tense-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tense-footer-note {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.3;
}

.tense-footer-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

@media (max-width: 960px) {
  .lesson-title-cell {
    flex-direction: column;
    align-items: flex-start;
  }

  .lesson-title-input {
    width: 100%;
    max-width: none;
  }

  .word-dialog-body {
    grid-template-columns: 1fr;
  }

}
</style>
