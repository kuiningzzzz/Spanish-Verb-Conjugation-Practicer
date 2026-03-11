<template>
  <Teleport v-if="isDev" to=".topbar-left-actions">
    <button
      class="ghost question-bank-download-button"
      :disabled="downloadingAll"
      @click="downloadAllQuestionsJson"
    >
      下载题库JSON
    </button>
  </Teleport>

  <section class="card question-bank-page management-page">
    <div class="management-header">
      <div>
        <h2>题库管理</h2>
      </div>
      <div class="toolbar management-toolbar">
        <div class="toolbar-left">
          <input
            v-model.trim="keyword"
            class="question-search-input"
            placeholder="搜索题干/动词原形/时态"
            @keydown.enter="triggerSearch"
          />
          <button class="ghost" :disabled="!keyword" @click="clearSearch">清空</button>
          <button class="ghost" :disabled="loading" @click="refresh">刷新</button>
        </div>
        <div class="management-actions">
          <select v-model="questionBankFilter" class="question-bank-mode-select">
            <option value="traditional">传统变位</option>
            <option value="pronoun">带代词变位</option>
          </select>
          <div class="pagination inline-pagination management-inline-pagination">
            <span class="muted management-pagination-total">共 {{ total }} 条</span>
            <template v-if="total > pageSize">
              <button class="ghost" :disabled="page === 1 || loading" @click="changePage(page - 1)">上一页</button>
              <label class="management-pagination-jump" for="questions-page-jump">
                第
                <input
                  id="questions-page-jump"
                  v-model.number="pageJump"
                  class="page-jump-input management-page-number-input"
                  type="number"
                  min="1"
                  :max="totalPages"
                  @keydown.enter.prevent="jumpToPage"
                  @blur="jumpToPage"
                />
                / {{ totalPages }} 页
              </label>
              <button
                class="ghost"
                :disabled="page === totalPages || loading"
                @click="changePage(page + 1)"
              >
                下一页
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div class="management-page-body">
      <div v-if="error" class="error-block">
        <p class="error">{{ error }}</p>
        <button class="ghost" @click="refresh">重试</button>
      </div>
      <div v-else-if="loading" class="loading">加载中...</div>
      <div v-else class="management-table-scroll">
        <table class="table">
          <thead>
            <tr>
              <th class="col-id sortable" @click="toggleSort('id')">
                ID <span class="sort-indicator">{{ sortIndicator('id') }}</span>
              </th>
              <th class="col-verb sortable" @click="toggleSort('infinitive')">
                动词原形 <span class="sort-indicator">{{ sortIndicator('infinitive') }}</span>
              </th>
              <th class="col-question sortable" @click="toggleSort('question_text')">
                题干 <span class="sort-indicator">{{ sortIndicator('question_text') }}</span>
              </th>
              <template v-if="isPronounBank">
                <th class="col-host-form sortable" @click="toggleSort('host_form')">
                  变位形式 <span class="sort-indicator">{{ sortIndicator('host_form') }}</span>
                </th>
                <th class="col-pronoun-mode sortable" @click="toggleSort('pronoun_pattern')">
                  代词模式 <span class="sort-indicator">{{ sortIndicator('pronoun_pattern') }}</span>
                </th>
              </template>
              <template v-else>
                <th class="col-mood sortable" @click="toggleSort('mood')">
                  语气 <span class="sort-indicator">{{ sortIndicator('mood') }}</span>
                </th>
                <th class="col-tense sortable" @click="toggleSort('tense')">
                  时态 <span class="sort-indicator">{{ sortIndicator('tense') }}</span>
                </th>
                <th class="col-person sortable" @click="toggleSort('person')">
                  人称 <span class="sort-indicator">{{ sortIndicator('person') }}</span>
                </th>
              </template>
              <th v-if="isPowerAdmin" class="col-confidence sortable" @click="toggleSort('confidence_score')">
                置信度 <span class="sort-indicator">{{ sortIndicator('confidence_score') }}</span>
              </th>
              <th v-if="isPowerAdmin" class="col-created sortable" @click="toggleSort('created_at')">
                创建时间 <span class="sort-indicator">{{ sortIndicator('created_at') }}</span>
              </th>
              <th class="col-actions"><span class="col-actions-label">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="question in questions" :key="question.id">
              <td class="col-id">{{ question.id }}</td>
              <td class="col-verb">{{ question.infinitive || '-' }}</td>
              <td class="col-question">
                <span class="ellipsis question-ellipsis" :title="question.question_text">
                  {{ formatText(question.question_text) }}
                </span>
              </td>
              <template v-if="isPronounBank">
                <td class="col-host-form">{{ formatHostForm(question) }}</td>
                <td class="col-pronoun-mode">{{ formatPronounPattern(question) }}</td>
              </template>
              <template v-else>
                <td class="col-mood">{{ formatTableMoodLabel(question.mood) }}</td>
                <td class="col-tense">{{ formatTableTenseLabel(question.tense) }}</td>
                <td class="col-person">{{ question.person }}</td>
              </template>
              <td v-if="isPowerAdmin" class="col-confidence">{{ question.confidence_score ?? '-' }}</td>
              <td v-if="isPowerAdmin" class="col-created">{{ formatDate(question.created_at) }}</td>
              <td class="actions col-actions">
                <div class="actions-group">
                  <button class="ghost" @click="openEdit(question)">编辑</button>
                  <button v-if="isPowerAdmin" class="danger" @click="confirmDelete(question)">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="!questions.length">
              <td :colspan="emptyColspan" class="empty">{{ emptyText }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="drawerOpen" class="overlay">
      <div class="drawer">
        <header>
          <h3>编辑题目</h3>
          <button class="ghost" @click="closeDrawer">关闭</button>
        </header>
        <form @submit.prevent="submitEdit">
          <div class="inline-fields">
            <label>
              动词ID
              <input v-model.trim="form.verb_id" inputmode="numeric" pattern="[0-9]*" />
              <span v-if="formErrors.verb_id" class="field-error">{{ formErrors.verb_id }}</span>
            </label>
            <label>
              动词原形
              <input v-model="form.verb_infinitive" readonly />
            </label>
          </div>
          <label>
            题干
            <textarea v-model="form.question_text" rows="4"></textarea>
            <span v-if="formErrors.question_text" class="field-error">{{ formErrors.question_text }}</span>
          </label>
          <label>
            翻译（可选）
            <textarea v-model="form.translation" rows="3"></textarea>
          </label>
          <label>
            提示（可选）
            <input v-model="form.hint" />
          </label>
          <div v-if="isEditingPronounQuestion" class="inline-fields">
            <label>
              变位类型
              <select v-model="form.host_form">
                <option value="" disabled>请选择变位类型</option>
                <option
                  v-for="hostForm in resolvedHostFormOptions"
                  :key="hostForm"
                  :value="hostForm"
                >
                  {{ formatHostFormOptionLabel(hostForm) }}
                </option>
              </select>
              <span v-if="formErrors.host_form" class="field-error">{{ formErrors.host_form }}</span>
            </label>
            <label>
              代词模式
              <select v-model="form.pronoun_pattern" :disabled="isPrnlHostForm(form.host_form)">
                <option v-if="isPrnlHostForm(form.host_form)" value="">不适用</option>
                <option v-else value="" disabled>请选择代词模式</option>
                <option
                  v-for="pattern in resolvedPronounPatternOptions"
                  :key="pattern"
                  :value="pattern"
                >
                  {{ formatPronounPatternOptionLabel(pattern) }}
                </option>
              </select>
              <span v-if="formErrors.pronoun_pattern" class="field-error">{{ formErrors.pronoun_pattern }}</span>
            </label>
          </div>
          <div v-else class="inline-fields">
            <label>
              时态
              <select v-model="form.tense">
                <option value="" disabled>请选择时态</option>
                <option v-for="tense in resolvedTenseOptions" :key="tense" :value="tense">
                  {{ formatTenseOptionLabel(tense) }}
                </option>
              </select>
              <span v-if="formErrors.tense" class="field-error">{{ formErrors.tense }}</span>
            </label>
            <label>
              语气
              <input v-model="form.mood" readonly />
              <span v-if="formErrors.mood" class="field-error">{{ formErrors.mood }}</span>
            </label>
            <label>
              人称
              <select v-model="form.person">
                <option value="" disabled>请选择人称</option>
                <option v-for="person in resolvedPersonOptions" :key="person" :value="person">
                  {{ person }}
                </option>
              </select>
              <span v-if="formErrors.person" class="field-error">{{ formErrors.person }}</span>
            </label>
          </div>
          <label v-if="isPowerAdmin">
            置信度（0-100）
            <input v-model.number="form.confidence_score" type="number" min="0" max="100" />
            <span v-if="formErrors.confidence_score" class="field-error">{{ formErrors.confidence_score }}</span>
          </label>
          <div class="edit-drawer-actions">
            <button type="button" class="ghost" :disabled="saving" @click="closeDrawer">不保存</button>
            <button type="submit" :disabled="saving">保存</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="deleteDialog && isPowerAdmin" class="overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>确认删除</h3>
          <button class="ghost" @click="closeDelete">关闭</button>
        </div>
        <p>
          即将删除题目：<strong>{{ briefQuestion(deleteDialog.question_text) }}</strong>（ID: {{ deleteDialog.id }}）
        </p>
        <p class="muted">请确认题干无误，删除后不可恢复。</p>
        <div class="modal-actions">
          <button class="ghost" @click="closeDelete">取消</button>
          <button class="danger" :disabled="deleting" @click="submitDelete">确认删除</button>
        </div>
      </div>
    </div>

    <div v-if="toast.visible" class="toast" :class="toast.type">{{ toast.message }}</div>
  </section>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { apiRequest, ApiError } from '../utils/apiClient';
import { useAuth } from '../composables/useAuth';

const { logout, isDev, isPowerAdmin } = useAuth();
const router = useRouter();

const questions = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const pageJump = ref(1);
const questionBankFilter = ref('traditional');
const keyword = ref('');
const debouncedKeyword = ref('');
const loading = ref(false);
const error = ref('');
const sortKey = ref('created_at');
const sortOrder = ref('desc');
const tenseOptions = ref([]);
const personOptions = ref([]);
const tenseMoodMap = ref({});

const TENSE_LABELS = {
  '现在时': '陈述式 一般现在时',
  presente: '陈述式 一般现在时',
  '现在完成时': '陈述式 现在完成时',
  perfecto: '陈述式 现在完成时',
  '未完成过去时': '陈述式 过去未完成时',
  '过去未完成时': '陈述式 过去未完成时',
  imperfecto: '陈述式 过去未完成时',
  '简单过去时': '陈述式 简单过去时',
  preterito: '陈述式 简单过去时',
  pretérito: '陈述式 简单过去时',
  '将来时': '陈述式 将来未完成时',
  futuro: '陈述式 将来未完成时',
  '过去完成时': '陈述式 过去完成时',
  pluscuamperfecto: '陈述式 过去完成时',
  '将来完成时': '陈述式 将来完成时',
  futuro_perfecto: '陈述式 将来完成时',
  '前过去时': '陈述式 前过去时',
  '先过去时': '陈述式 前过去时',
  preterito_anterior: '陈述式 前过去时',
  pretérito_anterior: '陈述式 前过去时',
  '虚拟现在时': '虚拟式 现在时',
  subjuntivo_presente: '虚拟式 现在时',
  '虚拟过去时': '虚拟式 过去未完成时',
  subjuntivo_imperfecto: '虚拟式 过去未完成时',
  '虚拟现在完成时': '虚拟式 现在完成时',
  subjuntivo_perfecto: '虚拟式 现在完成时',
  '虚拟过去完成时': '虚拟式 过去完成时',
  subjuntivo_pluscuamperfecto: '虚拟式 过去完成时',
  '虚拟将来未完成时': '虚拟式 将来未完成时',
  '虚拟将来时': '虚拟式 将来未完成时',
  subjuntivo_futuro: '虚拟式 将来未完成时',
  '虚拟将来完成时': '虚拟式 将来完成时',
  subjuntivo_futuro_perfecto: '虚拟式 将来完成时',
  '条件式': '简单条件式',
  condicional: '简单条件式',
  '条件完成时': '复合条件式',
  condicional_perfecto: '复合条件式',
  '肯定命令式': '命令式',
  imperativo_afirmativo: '命令式',
  '否定命令式': '否定命令式',
  imperativo_negativo: '否定命令式'
};

const HOST_FORM_LABELS = {
  finite: '陈述式/时态变位',
  imperative: '命令式',
  infinitive: '不定式',
  gerund: '副动词',
  prnl: '自反形式'
};

const PRONOUN_PATTERN_LABELS = {
  DO: 'DO',
  IO: 'IO',
  DO_IO: 'DO+IO'
};

const TABLE_MOOD_LABELS = {
  '陈述式': '陈述式',
  indicativo: '陈述式',
  '复合陈述式': '陈述式',
  indicativo_compuesto: '陈述式',
  '虚拟式': '虚拟式',
  subjuntivo: '虚拟式',
  '复合虚拟式': '虚拟式',
  subjuntivo_compuesto: '虚拟式',
  '命令式': '命令式',
  imperativo: '命令式',
  '条件式': '条件式',
  condicional: '条件式',
  '不定式': '不定式',
  infinitivo: '不定式',
  '副动词': '副动词',
  gerundio: '副动词',
  '自反动词': '自反动词',
  pronominal: '自反动词',
  '不适用': '不适用',
  'no aplica': '不适用'
};

const drawerOpen = ref(false);
const saving = ref(false);
const deleting = ref(false);
const downloadingAll = ref(false);
const deleteDialog = ref(null);
const activeQuestion = ref(null);

const form = reactive({
  id: null,
  verb_id: '',
  verb_infinitive: '',
  question_type: 'fill',
  question_text: '',
  correct_answer: '',
  example_sentence: '',
  translation: '',
  hint: '',
  tense: '',
  mood: '',
  person: '',
  host_form: '',
  host_form_zh: '',
  pronoun_pattern: '',
  confidence_score: 50
});

const formErrors = reactive({});

const toast = reactive({
  visible: false,
  message: '',
  type: 'info'
});

const isPronounBank = computed(() => questionBankFilter.value === 'pronoun');
const isEditingPronounQuestion = computed(() => {
  if (!activeQuestion.value) return false;
  return activeQuestion.value.question_bank === 'pronoun'
    || activeQuestion.value.public_question_source === 'public_pronoun'
    || !!activeQuestion.value.host_form;
});
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const emptyColspan = computed(() => {
  const baseColumns = isPronounBank.value ? 6 : 7;
  return isPowerAdmin.value ? baseColumns + 2 : baseColumns;
});
const resolvedTenseOptions = computed(() => mergeOptions(tenseOptions.value, form.tense));
const resolvedPersonOptions = computed(() => mergeOptions(personOptions.value, form.person));
const resolvedHostFormOptions = computed(() => mergeOptions(Object.keys(HOST_FORM_LABELS), form.host_form));
const resolvedPronounPatternOptions = computed(() => {
  if (isPrnlHostForm(form.host_form)) return [];
  return mergeOptions(Object.keys(PRONOUN_PATTERN_LABELS), form.pronoun_pattern);
});

const emptyText = computed(() => {
  if (keyword.value.trim()) return '未找到匹配题目';
  return '暂无题目数据';
});

let searchTimer = null;
let verbLookupTimer = null;
let verbLookupToken = 0;

watch(keyword, (value) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    debouncedKeyword.value = value.trim();
    page.value = 1;
  }, 400);
});

watch([page, pageSize, debouncedKeyword, sortKey, sortOrder], () => {
  fetchQuestions();
});

watch(questionBankFilter, () => {
  if (page.value !== 1) {
    page.value = 1;
    return;
  }
  fetchQuestions();
});

watch(page, (value) => {
  pageJump.value = value;
}, { immediate: true });

watch(
  () => form.verb_id,
  (value) => {
    if (!drawerOpen.value) return;
    if (verbLookupTimer) clearTimeout(verbLookupTimer);
    formErrors.verb_id = '';

    const trimmed = String(value ?? '').trim();
    if (!trimmed) {
      form.verb_infinitive = '';
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      form.verb_infinitive = '';
      formErrors.verb_id = '动词ID需为数字';
      return;
    }

    verbLookupTimer = setTimeout(() => {
      fetchVerbInfinitive(Number(trimmed));
    }, 300);
  }
);

watch(
  () => form.tense,
  () => {
    if (!drawerOpen.value) return;
    syncMoodFromTense({ force: true });
  }
);

watch(
  () => form.host_form,
  (value) => {
    if (!drawerOpen.value || !isEditingPronounQuestion.value) return;
    if (isPrnlHostForm(value)) {
      form.pronoun_pattern = '';
      formErrors.pronoun_pattern = '';
    }
  }
);

function showToast(message, type = 'info') {
  toast.message = message;
  toast.type = type;
  toast.visible = true;
  setTimeout(() => {
    toast.visible = false;
  }, 3000);
}

function mergeOptions(options, currentValue) {
  if (!currentValue) return options;
  if (options.includes(currentValue)) return options;
  return [currentValue, ...options];
}

function syncMoodFromTense({ force = false } = {}) {
  if (!form.tense) {
    form.mood = '';
    formErrors.mood = '';
    return;
  }

  const hasOptions = tenseMoodMap.value && Object.keys(tenseMoodMap.value).length > 0;
  const mood = hasOptions ? tenseMoodMap.value[form.tense] : '';

  if (mood) {
    form.mood = mood;
    formErrors.mood = '';
    return;
  }

  if (form.mood && !force) {
    formErrors.mood = '';
    return;
  }

  form.mood = '';
  formErrors.mood = '该时态未匹配到语气';
}

function resetErrors(target) {
  Object.keys(target).forEach((key) => {
    target[key] = '';
  });
}

function setFieldErrors(target, fieldErrors) {
  if (!fieldErrors) return;
  Object.entries(fieldErrors).forEach(([field, message]) => {
    target[field] = message;
  });
}

function handleApiError(err, targetErrors) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      showToast('登录已过期', 'error');
      logout();
      router.push({ name: 'Login', query: { error: 'expired' } });
      return;
    }
    if ([400, 422].includes(err.status)) {
      resetErrors(targetErrors);
      setFieldErrors(targetErrors, err.fieldErrors);
      showToast(err.message || '请检查表单字段', 'error');
      return;
    }
    if (err.status === 403) {
      showToast(err.message || '无权限执行该操作', 'error');
      return;
    }
    if (err.isNetworkError) {
      showToast('网络异常：无法连接到服务器（检查 API_BASE_URL/代理/CORS）', 'error');
      return;
    }
    showToast(err.message || '操作失败', 'error');
    return;
  }
  showToast('网络异常：无法连接到服务器（检查 API_BASE_URL/代理/CORS）', 'error');
}

async function fetchQuestions() {
  loading.value = true;
  error.value = '';
  try {
    const params = {
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value
    };
    if (debouncedKeyword.value) {
      params.keyword = debouncedKeyword.value;
    }
    params.questionBank = questionBankFilter.value;
    params.sortBy = sortKey.value;
    params.sortOrder = sortOrder.value;
    const data = await apiRequest('/questions', { params });
    questions.value = data.rows || [];
    total.value = data.total || 0;
  } catch (err) {
    error.value = err.message || '加载失败';
    handleApiError(err);
  } finally {
    loading.value = false;
  }
}

async function fetchConjugationOptions() {
  try {
    const data = await apiRequest('/conjugations/options');
    tenseOptions.value = Array.isArray(data?.tenses) ? data.tenses : [];
    personOptions.value = Array.isArray(data?.persons) ? data.persons : [];
    tenseMoodMap.value = data?.tenseMoodMap && typeof data.tenseMoodMap === 'object' ? data.tenseMoodMap : {};
    if (drawerOpen.value) {
      syncMoodFromTense();
    }
  } catch (err) {
    handleApiError(err);
  }
}

function refresh() {
  fetchQuestions();
}

function changePage(nextPage) {
  page.value = Math.min(Math.max(nextPage, 1), totalPages.value);
}

function jumpToPage() {
  const target = Number(pageJump.value);
  if (!Number.isFinite(target)) {
    pageJump.value = page.value;
    return;
  }
  const nextPage = Math.min(Math.max(Math.trunc(target), 1), totalPages.value);
  pageJump.value = nextPage;
  page.value = nextPage;
}

function triggerSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  debouncedKeyword.value = keyword.value.trim();
  page.value = 1;
}

function clearSearch() {
  keyword.value = '';
  debouncedKeyword.value = '';
  page.value = 1;
}

function downloadJsonFile(payload, fileName) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildDownloadFileName() {
  const now = new Date();
  const bank = questionBankFilter.value === 'pronoun' ? 'pronoun' : 'traditional';
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
  return `question-bank-${bank}-${stamp}.json`;
}

async function fetchAllQuestions() {
  const limit = 200;
  let offset = 0;
  let rounds = 0;
  const all = [];
  while (true) {
    const data = await apiRequest('/questions', {
      params: {
        limit,
        offset,
        sortBy: 'id',
        sortOrder: 'asc',
        questionBank: questionBankFilter.value
      }
    });
    const rows = data?.rows || [];
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
    rounds += 1;
    if (rounds > 500) break;
  }
  return all;
}

async function downloadAllQuestionsJson() {
  if (downloadingAll.value) return;
  downloadingAll.value = true;
  try {
    const rows = await fetchAllQuestions();
    if (!rows.length) {
      showToast('没有题目可下载', 'info');
      return;
    }
    downloadJsonFile(rows, buildDownloadFileName());
    showToast('JSON 已下载', 'success');
  } catch (err) {
    handleApiError(err);
  } finally {
    downloadingAll.value = false;
  }
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatText(value) {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= 60) return text;
  return `${text.slice(0, 60)}...`;
}

function formatHostForm(question) {
  const value = String(question?.host_form || '').trim();
  if (!value) return '-';
  return HOST_FORM_LABELS[normalizeOptionKey(value)] || value;
}

function formatPronounPattern(question) {
  const value = String(question?.pronoun_pattern || '').trim().toUpperCase();
  return value || '-';
}

function briefQuestion(value) {
  if (!value) return '（空题干）';
  const text = String(value);
  return text.length <= 20 ? text : `${text.slice(0, 20)}...`;
}

function normalizeOptionKey(value) {
  return String(value || '').trim().toLowerCase();
}

function formatTenseOptionLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return TENSE_LABELS[normalizeOptionKey(raw)] || raw;
}

function formatTableTenseLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const resolved = TENSE_LABELS[normalizeOptionKey(raw)] || raw;
  const separatorIndex = resolved.indexOf(' ');
  if (separatorIndex >= 0) {
    return resolved.slice(separatorIndex + 1).trim() || resolved;
  }
  return resolved;
}

function formatTableMoodLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return TABLE_MOOD_LABELS[normalizeOptionKey(raw)] || raw;
}

function formatHostFormOptionLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  return HOST_FORM_LABELS[normalizeOptionKey(raw)] || raw;
}

function formatPronounPatternOptionLabel(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '-';
  return PRONOUN_PATTERN_LABELS[raw] || raw;
}

function isPrnlHostForm(value) {
  return normalizeOptionKey(value) === 'prnl';
}

function resolveHostFormZh(value) {
  const key = normalizeOptionKey(value);
  return HOST_FORM_LABELS[key] || String(value || '').trim();
}

function resolveSubmittedHostFormZh(value) {
  const normalizedValue = normalizeOptionKey(value);
  if (!normalizedValue) return null;

  const originalHostForm = normalizeOptionKey(activeQuestion.value?.host_form);
  if (normalizedValue === originalHostForm) {
    const originalLabel = String(activeQuestion.value?.host_form_zh || '').trim();
    if (originalLabel) return originalLabel;
  }

  const currentLabel = String(form.host_form_zh || '').trim();
  return resolveHostFormZh(value) || currentLabel || null;
}

function toggleSort(key) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    page.value = 1;
    return;
  }
  sortKey.value = key;
  sortOrder.value = 'asc';
  page.value = 1;
}

function sortIndicator(key) {
  if (sortKey.value !== key) return '↕';
  return sortOrder.value === 'asc' ? '↑' : '↓';
}

async function fetchVerbInfinitive(verbId) {
  const requestToken = ++verbLookupToken;
  try {
    const data = await apiRequest(`/verbs/${verbId}`);
    if (requestToken !== verbLookupToken) return;
    const infinitive = data?.verb?.infinitive || data?.infinitive || '';
    form.verb_infinitive = infinitive;
    if (!infinitive) {
      formErrors.verb_id = '动词ID不存在';
    }
  } catch (err) {
    if (requestToken !== verbLookupToken) return;
    if (err instanceof ApiError && err.status === 404) {
      formErrors.verb_id = '动词ID不存在';
      form.verb_infinitive = '';
      return;
    }
    handleApiError(err);
  }
}

async function openEdit(question) {
  resetErrors(formErrors);
  saving.value = false;
  try {
    const data = await apiRequest(`/questions/${question.id}`, {
      params: { source: question.public_question_source }
    });
    activeQuestion.value = data;
    form.id = data.id;
    form.verb_id = data.verb_id ? String(data.verb_id) : '';
    form.verb_infinitive = data.infinitive || '';
    form.question_type = data.question_type || 'fill';
    form.question_text = data.question_text || '';
    form.correct_answer = data.correct_answer || '';
    form.example_sentence = data.example_sentence || '';
    form.translation = data.translation || '';
    form.hint = data.hint || '';
    form.tense = data.tense || '';
    form.mood = data.mood || '';
    form.person = data.person || '';
    form.host_form = data.host_form || '';
    form.host_form_zh = data.host_form_zh || '';
    form.pronoun_pattern = data.pronoun_pattern || '';
    form.confidence_score = data.confidence_score ?? 50;
    syncMoodFromTense();
    if (form.verb_id && !form.verb_infinitive) {
      fetchVerbInfinitive(Number(form.verb_id));
    }
    drawerOpen.value = true;
  } catch (err) {
    handleApiError(err);
  }
}

function closeDrawer() {
  drawerOpen.value = false;
  activeQuestion.value = null;
}

async function submitEdit() {
  if (!form.id) return;
  resetErrors(formErrors);

  const verbId = Number(form.verb_id);
  if (!form.verb_id || Number.isNaN(verbId)) {
    formErrors.verb_id = '动词ID不能为空';
  } else if (!form.verb_infinitive) {
    formErrors.verb_id = '动词ID不存在';
  }
  if (!form.question_text || !form.question_text.trim()) {
    formErrors.question_text = '题干不能为空';
  }
  if (isEditingPronounQuestion.value) {
    if (!form.host_form || !form.host_form.trim()) {
      formErrors.host_form = '变位类型不能为空';
    }
    if (!isPrnlHostForm(form.host_form) && (!form.pronoun_pattern || !form.pronoun_pattern.trim())) {
      formErrors.pronoun_pattern = '代词模式不能为空';
    }
  } else {
    if (!form.tense || !form.tense.trim()) {
      formErrors.tense = '时态不能为空';
    }
    if (!form.mood || !form.mood.trim()) {
      formErrors.mood = formErrors.mood || '语气不能为空';
    }
    if (!form.person || !form.person.trim()) {
      formErrors.person = '人称不能为空';
    }
  }
  if (form.confidence_score < 0 || form.confidence_score > 100) {
    formErrors.confidence_score = '置信度需在 0-100 之间';
  }
  if (Object.values(formErrors).some((value) => value)) {
    return;
  }

  saving.value = true;
  try {
    const normalizedHostForm = form.host_form?.trim() || null;
    const normalizedPronounPattern = isPrnlHostForm(normalizedHostForm)
      ? null
      : (form.pronoun_pattern?.trim().toUpperCase() || null);
    await apiRequest(`/questions/${form.id}`, {
      method: 'PUT',
      body: {
        public_question_source: activeQuestion.value?.public_question_source,
        verb_id: verbId,
        question_text: form.question_text.trim(),
        translation: form.translation?.trim() || null,
        hint: form.hint?.trim() || null,
        tense: form.tense.trim(),
        mood: form.mood.trim(),
        person: form.person.trim(),
        host_form: isEditingPronounQuestion.value ? normalizedHostForm : undefined,
        host_form_zh: isEditingPronounQuestion.value
          ? resolveSubmittedHostFormZh(normalizedHostForm)
          : undefined,
        pronoun_pattern: isEditingPronounQuestion.value ? normalizedPronounPattern : undefined,
        confidence_score: form.confidence_score
      }
    });
    showToast('保存成功', 'success');
    closeDrawer();
    fetchQuestions();
  } catch (err) {
    handleApiError(err, formErrors);
  } finally {
    saving.value = false;
  }
}

function confirmDelete(question) {
  if (!isPowerAdmin.value) {
    showToast('仅 dev/superadmin 可删除题库内容', 'error');
    return;
  }
  deleteDialog.value = question;
}

function closeDelete() {
  deleteDialog.value = null;
}

async function submitDelete() {
  if (!deleteDialog.value) return;
  if (!isPowerAdmin.value) {
    showToast('仅 dev/superadmin 可删除题库内容', 'error');
    closeDelete();
    return;
  }
  deleting.value = true;
  try {
    await apiRequest(`/questions/${deleteDialog.value.id}`, {
      method: 'DELETE',
      params: { source: deleteDialog.value.public_question_source }
    });
    showToast('删除成功', 'success');
    closeDelete();
    fetchQuestions();
  } catch (err) {
    handleApiError(err);
  } finally {
    deleting.value = false;
  }
}

fetchQuestions();
fetchConjugationOptions();
</script>

<style scoped>
.question-bank-page {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.question-bank-page h2 {
  white-space: nowrap;
}

.question-bank-page .management-header > div:first-child {
  flex-shrink: 0;
}

.question-bank-page .management-header,
.question-bank-page .management-toolbar,
.question-bank-page .toolbar-left,
.question-bank-page .management-actions {
  flex-wrap: nowrap;
}

.question-bank-page .management-toolbar,
.question-bank-page .toolbar-left,
.question-bank-page .management-actions {
  gap: 8px;
}

.question-bank-page .management-table-scroll {
  width: 100%;
}

.question-bank-page .question-search-input {
  width: 180px;
  min-width: 180px;
}

.question-bank-page .question-bank-mode-select {
  width: 136px;
  min-width: 136px;
}

.question-bank-page .question-bank-download-button {
  padding: 7px 10px;
  font-size: 13px;
  white-space: nowrap;
  line-height: 1.2;
}

.question-bank-page .management-toolbar button {
  padding: 8px 10px;
  font-size: 14px;
  white-space: nowrap;
  line-height: 1.2;
}

.question-bank-page .table {
  table-layout: fixed;
  font-size: 13px;
}

.question-bank-page .table th,
.question-bank-page .table td {
  padding: 8px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.15;
}

.question-bank-page .table tbody tr {
  height: 44px;
}

.question-bank-page .col-id {
  width: 56px;
}

.question-bank-page .col-verb {
  width: 92px;
}

.question-bank-page .col-tense {
  width: 100px;
}

.question-bank-page .col-host-form {
  width: 112px;
}

.question-bank-page .col-pronoun-mode {
  width: 104px;
}

.question-bank-page .col-mood {
  width: 80px;
}

.question-bank-page .col-person {
  width: 92px;
}

.question-bank-page .col-confidence {
  width: 68px;
}

.question-bank-page .col-created {
  width: 168px;
}

.question-bank-page .col-actions {
  width: 132px;
}

.question-bank-page .table th.col-actions {
  text-align: right;
}

.question-bank-page .table th.col-actions .col-actions-label {
  display: inline-block;
  min-width: 108px;
  text-align: left;
}

.question-bank-page .question-ellipsis {
  display: block;
  max-width: 100%;
  line-height: 1.15;
}

.question-bank-page .table td.actions {
  display: table-cell;
  text-align: right;
  white-space: nowrap;
}

.question-bank-page .table td.actions .actions-group {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 108px;
}

.question-bank-page .table td.actions button {
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.1;
  border-radius: 8px;
}

.question-bank-page .table td.actions button + button {
  margin-left: 4px;
}

.question-bank-page .edit-drawer-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.question-bank-page .edit-drawer-actions button {
  flex: 1;
  width: 50%;
}

@media (max-width: 960px) {
  .question-bank-page .management-header,
  .question-bank-page .management-toolbar,
  .question-bank-page .toolbar-left,
  .question-bank-page .management-actions {
    flex-wrap: wrap;
  }

  .question-bank-page .question-search-input {
    width: 100%;
    min-width: 0;
  }

  .question-bank-page .question-bank-mode-select {
    width: 100%;
    min-width: 0;
  }
}
</style>
