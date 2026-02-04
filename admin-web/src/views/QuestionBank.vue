<template>
  <section class="card question-bank-page">
    <div class="users-header">
      <div>
        <h2>题库管理</h2>
        <p class="muted">
          管理所有动词变位例句题目
        </p>
        <p class="muted total-count">共 {{ total }} 条</p>
      </div>
      <div class="toolbar">
        <div class="toolbar-left">
          <input
            v-model.trim="keyword"
            placeholder="搜索题干/动词原形"
            @keydown.enter="triggerSearch"
          />
          <button class="ghost" :disabled="!keyword" @click="clearSearch">清空</button>
          <button class="ghost" :disabled="loading" @click="refresh">刷新</button>
        </div>
        <div class="toolbar-right">
          <button class="ghost" :disabled="downloadingAll" @click="downloadAllQuestionsJson">下载题库JSON</button>
          <div class="pagination inline-pagination" v-if="total > pageSize">
            <button class="ghost" :disabled="page === 1 || loading" @click="changePage(page - 1)">上一页</button>
            <span>第 {{ page }} / {{ totalPages }} 页</span>
            <button
              class="ghost"
              :disabled="page === totalPages || loading"
              @click="changePage(page + 1)"
            >
              下一页
            </button>
            <input
              v-model.number="pageJump"
              class="page-jump-input"
              type="number"
              min="1"
              :max="totalPages"
              placeholder="跳转页"
              @keydown.enter="jumpToPage"
            />
            <button class="ghost" :disabled="loading" @click="jumpToPage">跳转</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-block">
      <p class="error">{{ error }}</p>
      <button class="ghost" @click="refresh">重试</button>
    </div>

    <div v-else>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else>
        <table class="table">
          <thead>
            <tr>
              <th class="sortable" @click="toggleSort('id')">
                ID <span class="sort-indicator">{{ sortIndicator('id') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('infinitive')">
                动词原形 <span class="sort-indicator">{{ sortIndicator('infinitive') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('question_text')">
                题干 <span class="sort-indicator">{{ sortIndicator('question_text') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('tense')">
                时态 <span class="sort-indicator">{{ sortIndicator('tense') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('mood')">
                语气 <span class="sort-indicator">{{ sortIndicator('mood') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('person')">
                人称 <span class="sort-indicator">{{ sortIndicator('person') }}</span>
              </th>
              <th v-if="isDev" class="sortable" @click="toggleSort('confidence_score')">
                置信度 <span class="sort-indicator">{{ sortIndicator('confidence_score') }}</span>
              </th>
              <th v-if="isDev" class="sortable" @click="toggleSort('created_at')">
                创建时间 <span class="sort-indicator">{{ sortIndicator('created_at') }}</span>
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="question in questions" :key="question.id">
              <td>{{ question.id }}</td>
              <td>{{ question.infinitive || '-' }}</td>
              <td>
                <span class="ellipsis" :title="question.question_text">
                  {{ formatText(question.question_text) }}
                </span>
              </td>
              <td>{{ question.tense }}</td>
              <td>{{ question.mood }}</td>
              <td>{{ question.person }}</td>
              <td v-if="isDev">{{ question.confidence_score ?? '-' }}</td>
              <td v-if="isDev">{{ formatDate(question.created_at) }}</td>
              <td class="actions">
                <button class="ghost" @click="openEdit(question)">编辑</button>
                <button class="danger" @click="confirmDelete(question)">删除</button>
              </td>
            </tr>
            <tr v-if="!questions.length">
              <td :colspan="emptyColspan" class="empty">{{ emptyText }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="drawerOpen" class="overlay" @click.self="closeDrawer">
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
          <div class="inline-fields">
            <label>
              时态
              <select v-model="form.tense">
                <option value="" disabled>请选择时态</option>
                <option v-for="tense in resolvedTenseOptions" :key="tense" :value="tense">
                  {{ tense }}
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
          <label v-if="isDev">
            置信度（0-100）
            <input v-model.number="form.confidence_score" type="number" min="0" max="100" />
            <span v-if="formErrors.confidence_score" class="field-error">{{ formErrors.confidence_score }}</span>
          </label>
          <button type="submit" :disabled="saving">保存</button>
        </form>
      </div>
    </div>

    <div v-if="deleteDialog" class="overlay" @click.self="closeDelete">
      <div class="modal">
        <h3>确认删除</h3>
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

const { logout, isDev } = useAuth();
const router = useRouter();

const questions = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const pageJump = ref(null);
const keyword = ref('');
const debouncedKeyword = ref('');
const loading = ref(false);
const error = ref('');
const sortKey = ref('created_at');
const sortOrder = ref('desc');
const tenseOptions = ref([]);
const personOptions = ref([]);
const tenseMoodMap = ref({});

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
  confidence_score: 50
});

const formErrors = reactive({});

const toast = reactive({
  visible: false,
  message: '',
  type: 'info'
});

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const emptyColspan = computed(() => (isDev.value ? 9 : 7));
const resolvedTenseOptions = computed(() => mergeOptions(tenseOptions.value, form.tense));
const resolvedPersonOptions = computed(() => mergeOptions(personOptions.value, form.person));

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
  if (!pageJump.value) return;
  const target = Math.min(Math.max(Number(pageJump.value), 1), totalPages.value);
  page.value = target;
  pageJump.value = null;
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
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
  return `question-bank-list-${stamp}.json`;
}

async function fetchAllQuestions() {
  const limit = 200;
  let offset = 0;
  let rounds = 0;
  const all = [];
  while (true) {
    const data = await apiRequest('/questions', {
      params: { limit, offset, sortBy: 'id', sortOrder: 'asc' }
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

function briefQuestion(value) {
  if (!value) return '（空题干）';
  const text = String(value);
  return text.length <= 20 ? text : `${text.slice(0, 20)}...`;
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
    const data = await apiRequest(`/questions/${question.id}`);
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
  if (!form.tense || !form.tense.trim()) {
    formErrors.tense = '时态不能为空';
  }
  if (!form.mood || !form.mood.trim()) {
    formErrors.mood = formErrors.mood || '语气不能为空';
  }
  if (!form.person || !form.person.trim()) {
    formErrors.person = '人称不能为空';
  }
  if (form.confidence_score < 0 || form.confidence_score > 100) {
    formErrors.confidence_score = '置信度需在 0-100 之间';
  }
  if (Object.values(formErrors).some((value) => value)) {
    return;
  }

  saving.value = true;
  try {
    await apiRequest(`/questions/${form.id}`, {
      method: 'PUT',
      body: {
        verb_id: verbId,
        question_text: form.question_text.trim(),
        translation: form.translation?.trim() || null,
        hint: form.hint?.trim() || null,
        tense: form.tense.trim(),
        mood: form.mood.trim(),
        person: form.person.trim(),
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
  deleteDialog.value = question;
}

function closeDelete() {
  deleteDialog.value = null;
}

async function submitDelete() {
  if (!deleteDialog.value) return;
  deleting.value = true;
  try {
    await apiRequest(`/questions/${deleteDialog.value.id}`, { method: 'DELETE' });
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
