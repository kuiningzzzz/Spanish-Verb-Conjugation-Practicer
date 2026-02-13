<template>
  <section class="card announcement-page">
    <div class="users-header">
      <div>
        <h2>公告管理</h2>
        <p class="muted">仅 dev 可管理公告，支持发布、编辑与删除。</p>
        <p class="muted total-count">共 {{ announcements.length }} 条</p>
      </div>
      <div class="toolbar">
        <input v-model.trim="keyword" placeholder="搜索标题/内容/发布者" />
        <select v-model="statusFilter">
          <option value="all">全部状态</option>
          <option value="active">仅启用</option>
          <option value="inactive">仅停用</option>
        </select>
        <button class="ghost" @click="refresh" :disabled="loading">刷新</button>
        <button @click="openCreate">发布公告</button>
        <div v-if="totalPages > 0" class="pagination-inline">
          <button class="ghost" :disabled="currentPage <= 1" @click="goPrevPage">上一页</button>
          <span class="page-info">共 {{ currentPage }} / {{ totalPages }} 页</span>
          <button class="ghost" :disabled="currentPage >= totalPages" @click="goNextPage">下一页</button>
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
              <th>标题</th>
              <th>内容</th>
              <th class="sortable" @click="toggleSort('priority')">
                优先级 <span class="sort-indicator">{{ sortIndicator('priority') }}</span>
              </th>
              <th>发布者</th>
              <th class="sortable" @click="toggleSort('publishTime')">
                发布时间 <span class="sort-indicator">{{ sortIndicator('publishTime') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('isActive')">
                状态 <span class="sort-indicator">{{ sortIndicator('isActive') }}</span>
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="announcement in pagedAnnouncements" :key="announcement.id">
              <td>{{ announcement.id }}</td>
              <td>
                <span class="ellipsis" :title="announcement.title">
                  {{ formatText(announcement.title, 32) }}
                </span>
              </td>
              <td>
                <span class="ellipsis" :title="announcement.content">
                  {{ formatText(announcement.content, 60) }}
                </span>
              </td>
              <td>
                <span class="tag" :class="priorityClass(announcement.priority)">
                  {{ priorityLabel(announcement.priority) }}
                </span>
              </td>
              <td>{{ announcement.publisher || '-' }}</td>
              <td>{{ formatDate(announcement.publishTime) }}</td>
              <td>
                <span class="tag" :class="announcement.isActive ? 'success' : 'error'">
                  {{ announcement.isActive ? '启用' : '停用' }}
                </span>
              </td>
              <td class="actions">
                <button class="ghost" @click="openEdit(announcement)">编辑</button>
                <button class="danger" @click="confirmDelete(announcement)" :disabled="deleting">删除</button>
              </td>
            </tr>
            <tr v-if="!filteredAnnouncements.length">
              <td colspan="8" class="empty">暂无公告数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="drawerOpen" class="overlay" @click.self="closeDrawer">
      <div class="drawer">
        <header>
          <h3>{{ drawerMode === 'create' ? '发布公告' : '编辑公告' }}</h3>
          <button class="ghost" @click="closeDrawer">关闭</button>
        </header>
        <form @submit.prevent="submitForm">
          <div v-if="drawerMode === 'edit'" class="inline-fields">
            <label>
              公告ID
              <input v-model="form.id" readonly />
            </label>
            <label>
              发布时间
              <input :value="formatDate(form.publishTime)" readonly />
            </label>
          </div>
          <label>
            标题
            <input v-model.trim="form.title" />
            <span v-if="formErrors.title" class="field-error">{{ formErrors.title }}</span>
          </label>
          <label>
            内容
            <textarea v-model="form.content" rows="6"></textarea>
            <span v-if="formErrors.content" class="field-error">{{ formErrors.content }}</span>
          </label>
          <div class="inline-fields">
            <label>
              优先级
              <select v-model="form.priority">
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
            <label>
              发布者
              <input v-model="form.publisher" />
            </label>
          </div>
          <label>
            {{ drawerMode === 'create' ? '立即生效' : '是否启用' }}
            <input type="checkbox" v-model="form.isActive" />
          </label>
          <button type="submit" :disabled="saving">
            {{ drawerMode === 'create' ? '发布' : '保存' }}
          </button>
        </form>
      </div>
    </div>

    <div v-if="deleteDialog" class="overlay" @click.self="closeDelete">
      <div class="modal">
        <h3>确认删除</h3>
        <p>即将删除公告：<strong>{{ deleteDialog.title || deleteDialog.id }}</strong></p>
        <p class="muted">删除后不可恢复，请谨慎操作。</p>
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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { apiRequest, ApiError } from '../utils/apiClient';
import { useAuth } from '../composables/useAuth';

const { state, logout } = useAuth();
const router = useRouter();

const announcements = ref([]);
const loading = ref(false);
const error = ref('');
const keyword = ref('');
const statusFilter = ref('all');
const sortKey = ref('id');
const sortOrder = ref('desc');
const pageSize = ref(5);
const currentPage = ref(1);

const drawerOpen = ref(false);
const drawerMode = ref('create');
const saving = ref(false);
const deleting = ref(false);
const deleteDialog = ref(null);

const form = reactive({
  id: null,
  title: '',
  content: '',
  priority: 'medium',
  publisher: '',
  isActive: true,
  publishTime: ''
});

const formErrors = reactive({});

const toast = reactive({
  visible: false,
  message: '',
  type: 'info'
});

const defaultPublisher = computed(() => state.user?.username || state.user?.email || '');

const filteredAnnouncements = computed(() => {
  const term = keyword.value.trim().toLowerCase();
  let list = sortAnnouncements(announcements.value);

  if (statusFilter.value === 'active') {
    list = list.filter((item) => Boolean(item.isActive));
  } else if (statusFilter.value === 'inactive') {
    list = list.filter((item) => !item.isActive);
  }

  if (!term) return list;

  return list.filter((item) => {
    const title = (item.title || '').toLowerCase();
    const content = (item.content || '').toLowerCase();
    const publisher = (item.publisher || '').toLowerCase();
    return title.includes(term) || content.includes(term) || publisher.includes(term);
  });
});

const totalPages = computed(() => Math.ceil(filteredAnnouncements.value.length / pageSize.value));

const pagedAnnouncements = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredAnnouncements.value.slice(start, start + pageSize.value);
});

watch(
  () => [keyword.value, statusFilter.value, sortKey.value, sortOrder.value, announcements.value.length],
  () => {
    currentPage.value = 1;
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

function resetErrors(target) {
  Object.keys(target).forEach((key) => {
    target[key] = '';
  });
}

function setFieldErrors(target, fieldErrors) {
  if (!target || !fieldErrors) return;
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
      resetErrors(targetErrors || {});
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

function parsePublishTime(value) {
  if (!value) return 0;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortAnnouncements(list) {
  const normalized = [...list];
  const order = sortOrder.value === 'asc' ? 1 : -1;
  const priorityOrder = { high: 3, medium: 2, low: 1 };

  normalized.sort((a, b) => {
    let result = 0;
    if (sortKey.value === 'id') {
      result = Number(a.id || 0) - Number(b.id || 0);
    } else if (sortKey.value === 'priority') {
      result = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
    } else if (sortKey.value === 'isActive') {
      const aVal = a.isActive ? 1 : 0;
      const bVal = b.isActive ? 1 : 0;
      result = aVal - bVal;
    } else if (sortKey.value === 'publishTime') {
      result = parsePublishTime(a.publishTime) - parsePublishTime(b.publishTime);
    }
    return result * order;
  });
  return normalized;
}

function formatDate(value) {
  if (!value) return '-';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatText(value, maxLength) {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function priorityLabel(value) {
  if (value === 'high') return '高';
  if (value === 'low') return '低';
  return '中';
}

function priorityClass(value) {
  if (!value) return '';
  return `priority-${value}`;
}

function toggleSort(key) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    return;
  }
  sortKey.value = key;
  sortOrder.value = 'asc';
}

function sortIndicator(key) {
  if (sortKey.value !== key) return '↕';
  return sortOrder.value === 'asc' ? '↑' : '↓';
}

function goPrevPage() {
  if (currentPage.value <= 1) return;
  currentPage.value -= 1;
}

function goNextPage() {
  if (currentPage.value >= totalPages.value) return;
  currentPage.value += 1;
}

async function fetchAnnouncements() {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiRequest('/api/announcement/all');
    announcements.value = Array.isArray(data?.data) ? data.data : [];
  } catch (err) {
    error.value = err.message || '加载失败';
    handleApiError(err);
  } finally {
    loading.value = false;
  }
}

function refresh() {
  fetchAnnouncements();
}

function resetForm() {
  form.id = null;
  form.title = '';
  form.content = '';
  form.priority = 'medium';
  form.publisher = '';
  form.isActive = true;
  form.publishTime = '';
}

function openCreate() {
  resetErrors(formErrors);
  resetForm();
  form.publisher = defaultPublisher.value;
  drawerMode.value = 'create';
  drawerOpen.value = true;
}

async function openEdit(announcement) {
  resetErrors(formErrors);
  resetForm();
  drawerMode.value = 'edit';
  try {
    const data = await apiRequest(`/api/announcement/${announcement.id}`);
    const record = data?.data || data || {};
    form.id = record.id ?? announcement.id;
    form.title = record.title || announcement.title || '';
    form.content = record.content || announcement.content || '';
    form.priority = record.priority || announcement.priority || 'medium';
    form.publisher = record.publisher || announcement.publisher || defaultPublisher.value;
    form.isActive = record.isActive !== undefined ? record.isActive : Boolean(announcement.isActive);
    form.publishTime = record.publishTime || announcement.publishTime || '';
    drawerOpen.value = true;
  } catch (err) {
    handleApiError(err);
  }
}

function closeDrawer() {
  drawerOpen.value = false;
}

async function submitForm() {
  resetErrors(formErrors);
  if (!form.title.trim()) {
    formErrors.title = '请输入标题';
  }
  if (!form.content.trim()) {
    formErrors.content = '请输入内容';
  }
  if (Object.values(formErrors).some((value) => value)) {
    return;
  }

  saving.value = true;

  const payload = {
    title: form.title.trim(),
    content: form.content.trim(),
    priority: form.priority || 'medium',
    isActive: form.isActive
  };

  const publisherValue = (form.publisher || '').trim();
  if (publisherValue) {
    payload.publisher = publisherValue;
  }

  try {
    if (drawerMode.value === 'create') {
      await apiRequest('/api/announcement', { method: 'POST', body: payload });
      showToast('公告已发布', 'success');
    } else if (form.id) {
      await apiRequest(`/api/announcement/${form.id}`, { method: 'PUT', body: payload });
      showToast('公告已更新', 'success');
    }
    closeDrawer();
    fetchAnnouncements();
  } catch (err) {
    handleApiError(err, formErrors);
  } finally {
    saving.value = false;
  }
}

function confirmDelete(announcement) {
  deleteDialog.value = announcement;
}

function closeDelete() {
  deleteDialog.value = null;
}

async function submitDelete() {
  if (!deleteDialog.value) return;
  deleting.value = true;
  try {
    await apiRequest(`/api/announcement/${deleteDialog.value.id}`, { method: 'DELETE' });
    showToast('公告已删除', 'success');
    closeDelete();
    fetchAnnouncements();
  } catch (err) {
    handleApiError(err);
  } finally {
    deleting.value = false;
  }
}

onMounted(fetchAnnouncements);
</script>

<style scoped>
.pagination-inline {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-info {
  color: #6b7280;
  font-size: 14px;
  white-space: nowrap;
}
</style>
