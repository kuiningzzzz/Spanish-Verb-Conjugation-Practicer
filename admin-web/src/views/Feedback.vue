<template>
  <section class="card feedback-page">
    <div class="header-row">
      <div>
        <h2>反馈处理</h2>
        <p class="muted">处理用户反馈与题目反馈，支持状态标记、备注与删除。</p>
        <p class="muted total-count">共 {{ total }} 条</p>
      </div>
      <div class="toolbar">
        <select v-model="tab">
          <option value="general">用户反馈</option>
          <option value="question">题目反馈</option>
        </select>
        <input v-model.trim="keyword" placeholder="搜索用户/内容/动词/题目ID" />
        <select v-if="tab==='general'" v-model="statusFilter">
          <option value="all">全部状态</option>
          <option value="open">open</option>
          <option value="handled">handled</option>
          <option value="closed">closed</option>
        </select>
        <select v-if="tab==='general'" v-model.number="satisfactionFilter">
          <option :value="0">全部满意度</option>
          <option :value="1">1</option>
          <option :value="2">2</option>
          <option :value="3">3</option>
          <option :value="4">4</option>
        </select>
        <button class="ghost" @click="refresh" :disabled="loading">刷新</button>
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
            <tr v-if="tab === 'general'">
              <th>ID</th>
              <th>用户ID</th>
              <th>用户名</th>
              <th>满意度</th>
              <th>评论</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
            <tr v-else>
              <th>ID</th>
              <th>用户ID</th>
              <th>题目ID</th>
              <th>题目类型</th>
              <th>动词</th>
              <th>题目答案</th>
              <th>报告类型</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="(tab==='general' ? filteredGeneral.length : filteredQuestion.length) === 0">
              <td :colspan="tab==='general' ? 8 : 9">暂无数据</td>
            </tr>
            <tr v-for="item in (tab === 'general' ? filteredGeneral : filteredQuestion)" :key="(tab==='general'? 'g-'+item.id : 'q-'+item.id)">
              <td>{{ item.id }}</td>
              <td>{{ item.user_id }}</td>
              <template v-if="tab==='general'">
                <td>{{ item.username || '-' }}</td>
                <td>{{ item.satisfaction }}</td>
                <td>{{ (item.comment || '-').slice(0, 60) }}</td>
                <td>{{ item.status || '-' }}</td>
                <td>{{ formatDate(item.created_at) }}</td>
                <td>
                  <button class="ghost" @click="openGeneralDetail(item)">详情</button>
                  <button class="danger" @click="confirmDelete(item, 'general')" :disabled="deleting">删除</button>
                </td>
              </template>
              <template v-else>
                <td>{{ formatQuestionId(item.question_id) }}</td>
                <td>{{ item.question_type }}</td>
                <td>{{ item.verb_infinitive || '-' }}</td>
                <td>{{ item.question_answer || '-' }}</td>
                <td>{{ item.issue_types || '-' }}</td>
                <td>{{ formatDate(item.created_at) }}</td>
                <td>
                  <button class="ghost" @click="openQuestionDetail(item)">详情</button>
                  <button class="danger" @click="confirmDelete(item, 'question')" :disabled="deleting">删除</button>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="pagination" v-if="total > pageSize">
      <button class="ghost" :disabled="page === 1 || loading" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button class="ghost" :disabled="page === totalPages || loading" @click="changePage(page + 1)">下一页</button>
    </div>

    <div v-if="drawerOpen" class="overlay" @click.self="closeDrawer">
      <div class="drawer">
        <header>
          <h3>反馈详情</h3>
          <button class="ghost" @click="closeDrawer">关闭</button>
        </header>
        <form @submit.prevent="submitDetail">
          <div v-if="drawerType==='general'" class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">用户ID</span>
              <span class="detail-value">{{ detail.user_id }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">用户名</span>
              <span class="detail-value">{{ detail.username }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">满意度</span>
              <span class="detail-value">{{ detail.satisfaction }}</span>
            </div>
            <div class="detail-item detail-span">
              <span class="detail-label">评论</span>
              <span class="detail-value muted">{{ detail.comment || '-' }}</span>
            </div>
            <label class="detail-item">
              <span class="detail-label">状态</span>
              <select v-model="detail.status">
                <option value="open">open</option>
                <option value="handled">handled</option>
                <option value="closed">closed</option>
              </select>
            </label>
            <label class="detail-item detail-span">
              <span class="detail-label">管理员备注</span>
              <textarea v-model="detail.admin_note" rows="4"></textarea>
            </label>
          </div>

          <div v-else class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">用户ID</span>
              <span class="detail-value">{{ detail.user_id || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">用户名</span>
              <span class="detail-value">{{ detail.username || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">题目ID</span>
              <span class="detail-value">{{ formatQuestionId(detail.question_id) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">题目类型</span>
              <span class="detail-value">{{ detail.question_type }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">动词</span>
              <span class="detail-value">{{ detail.verb_infinitive || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">题目来源</span>
              <span class="detail-value">{{ detail.question_source || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">题目答案</span>
              <span class="detail-value">{{ detail.question_answer || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">时态</span>
              <span class="detail-value">{{ detail.tense || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">语气</span>
              <span class="detail-value">{{ detail.mood || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">人称</span>
              <span class="detail-value">{{ detail.person || '-' }}</span>
            </div>
            <div class="detail-item detail-span">
              <span class="detail-label">用户说明</span>
              <span class="detail-value muted">{{ detail.user_comment || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">报告类型</span>
              <span class="detail-value">{{ detail.issue_types || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">创建时间</span>
              <span class="detail-value">{{ formatDate(detail.created_at) }}</span>
            </div>
          </div>

          <div class="drawer-actions">
            <button class="ghost" @click="closeDrawer">取消</button>
            <button type="submit" :disabled="saving">保存</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="deleteDialog" class="overlay" @click.self="closeDelete">
      <div class="modal">
        <h3>确认删除</h3>
        <p>即将删除反馈：<strong>{{ deleteDialog.id }}</strong></p>
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

const { state, isAdmin, isDev, logout } = useAuth();
const router = useRouter();

const tab = ref('general');
const keyword = ref('');
const statusFilter = ref('all');
const satisfactionFilter = ref(0);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const error = ref('');

const general = ref([]);
const question = ref([]);

const drawerOpen = ref(false);
const drawerType = ref('general');
const detail = reactive({});
const saving = ref(false);
const deleting = ref(false);
const deleteDialog = ref(null);

const toast = reactive({ visible: false, message: '', type: 'info' });

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

const filteredGeneral = computed(() => {
  const term = keyword.value.trim().toLowerCase();
  const list = Array.isArray(general.value) ? general.value : (general.value && Array.isArray(general.value.rows) ? general.value.rows : []);
  return list.filter((it) => {
    if (statusFilter.value !== 'all' && it.status !== statusFilter.value) return false;
    if (satisfactionFilter.value && it.satisfaction !== satisfactionFilter.value) return false;
    if (!term) return true;
    return (
      String(it.id).includes(term) ||
      String(it.user_id).includes(term) ||
      String(it.username || '').toLowerCase().includes(term) ||
      String(it.comment || '').toLowerCase().includes(term)
    );
  });
});

const filteredQuestion = computed(() => {
  const term = keyword.value.trim().toLowerCase();
  const list = Array.isArray(question.value) ? question.value : (question.value && Array.isArray(question.value.rows) ? question.value.rows : []);
  return list.filter((it) => {
    if (!term) return true;
    return (
      String(it.id).includes(term) ||
      String(it.user_id).includes(term) ||
      String(it.username || '').toLowerCase().includes(term) ||
      String(it.verb_infinitive || '').toLowerCase().includes(term) ||
      String(it.question_id || '').toLowerCase().includes(term) ||
      String(it.user_comment || '').toLowerCase().includes(term)
    );
  });
});

function showToast(message, type = 'info') {
  toast.message = message;
  toast.type = type;
  toast.visible = true;
  setTimeout(() => (toast.visible = false), 3000);
}

function handleApiError(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      showToast('登录已过期', 'error');
      logout();
      router.push({ name: 'Login', query: { error: 'expired' } });
      return;
    }
    if (err.isNetworkError) {
      showToast('网络异常：无法连接到服务器', 'error');
      return;
    }
    showToast(err.message || '操作失败', 'error');
    return;
  }
  showToast('网络异常：无法连接到服务器', 'error');
}

async function fetchGeneral() {
  loading.value = true;
  error.value = '';
  try {
    const params = { limit: pageSize.value, offset: (page.value - 1) * pageSize.value };
    const data = await apiRequest('/feedback', { params });
    general.value = data.feedbackList || data.rows || (Array.isArray(data) ? data : []);
    total.value = data.total || (Array.isArray(data) ? data.length : total.value);
  } catch (err) {
    error.value = err.message || '加载失败';
    handleApiError(err);
  } finally {
    loading.value = false;
  }
}

async function fetchQuestion() {
  loading.value = true;
  error.value = '';
  try {
    const params = { limit: pageSize.value, offset: (page.value - 1) * pageSize.value };
    const data = await apiRequest('/question-feedback', { params });
    question.value = data.feedbackList || data.rows || (Array.isArray(data) ? data : []);
    total.value = data.total || (Array.isArray(data) ? data.length : total.value);
  } catch (err) {
    error.value = err.message || '加载失败';
    handleApiError(err);
  } finally {
    loading.value = false;
  }
}

function refresh() {
  page.value = 1;
  if (tab.value === 'general') fetchGeneral();
  else fetchQuestion();
}

function changePage(nextPage) {
  page.value = Math.min(Math.max(nextPage, 1), totalPages.value);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatQuestionId(value) {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? value : parsed;
}

async function openGeneralDetail(item) {
  drawerType.value = 'general';
  try {
    const data = await apiRequest(`/feedback/${item.id}`);
    Object.assign(detail, data || item);
    drawerOpen.value = true;
  } catch (err) {
    handleApiError(err);
  }
}

async function openQuestionDetail(item) {
  drawerType.value = 'question';
  try {
    const data = await apiRequest(`/question-feedback/${item.id}`);
    Object.assign(detail, data || item);
    drawerOpen.value = true;
  } catch (err) {
    handleApiError(err);
  }
}

function closeDrawer() {
  drawerOpen.value = false;
  for (const k in detail) delete detail[k];
}

async function submitDetail() {
  if (!drawerOpen.value) return;
  saving.value = true;
  try {
    if (drawerType.value === 'general') {
      await apiRequest(`/feedback/${detail.id}`, { method: 'PUT', body: { status: detail.status, admin_note: detail.admin_note } });
      showToast('保存成功', 'success');
      closeDrawer();
      fetchGeneral();
    } else {
      showToast('题目反馈不支持编辑（仅支持删除）', 'info');
    }
  } catch (err) {
    handleApiError(err);
  } finally {
    saving.value = false;
  }
}

function confirmDelete(item, type) {
  deleteDialog.value = { ...item, _type: type };
}

function closeDelete() {
  deleteDialog.value = null;
}

async function submitDelete() {
  if (!deleteDialog.value) return;
  deleting.value = true;
  try {
    if (deleteDialog.value._type === 'general') {
      await apiRequest(`/feedback/${deleteDialog.value.id}`, { method: 'DELETE' });
      showToast('删除成功', 'success');
      closeDelete();
      fetchGeneral();
    } else {
      await apiRequest(`/question-feedback/${deleteDialog.value.id}`, { method: 'DELETE' });
      showToast('删除成功', 'success');
      closeDelete();
      fetchQuestion();
    }
  } catch (err) {
    handleApiError(err);
  } finally {
    deleting.value = false;
  }
}

watch([page, pageSize, tab], () => {
  refresh();
});

fetchGeneral();
</script>

<style scoped>
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 24px;
  margin-bottom: 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-span {
  grid-column: 1 / -1;
}

.detail-label {
  font-weight: 600;
  color: #4b5563;
}

.detail-value {
  color: #111827;
}

.detail-grid select,
.detail-grid textarea {
  width: 100%;
}
</style>
