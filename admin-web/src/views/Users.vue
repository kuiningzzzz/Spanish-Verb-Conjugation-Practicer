<template>
  <section class="card users-page management-page">
    <div class="management-header">
      <div>
        <h2>用户管理</h2>
      </div>
      <div class="toolbar management-toolbar">
        <div class="toolbar-left">
          <input v-model.trim="keyword" placeholder="搜索邮箱/昵称/ID" />
          <select v-model="roleFilter">
            <option value="all">全部角色</option>
            <option v-if="isDev" value="dev">DEV</option>
            <option value="admin">ADMIN</option>
            <option value="user">USER</option>
          </select>
          <button class="ghost" @click="refresh" :disabled="loading">刷新</button>
        </div>
        <div class="management-actions">
          <div class="pagination inline-pagination management-inline-pagination">
            <span class="muted management-pagination-total">共 {{ total }} 条</span>
            <template v-if="total > pageSize">
              <button class="ghost" :disabled="page === 1 || loading" @click="changePage(page - 1)">上一页</button>
              <label class="management-pagination-jump" for="users-page-jump">
                第
                <input
                  id="users-page-jump"
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
          <button v-if="isDev" @click="openCreate">新建用户</button>
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
              <th class="col-id">ID</th>
              <th class="col-email">邮箱</th>
              <th class="col-username">用户名</th>
              <th class="col-type">类型</th>
              <th class="col-role">角色</th>
              <th class="col-created-at">创建时间</th>
              <th class="col-actions"><span class="col-actions-label">操作</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td class="col-id">{{ user.id }}</td>
              <td class="col-email">{{ user.email || '-' }}</td>
              <td class="col-username">{{ user.username || '-' }}</td>
              <td class="col-type">
                <span class="tag" :class="typeTagClass(user.user_type)">{{ userTypeLabel(user.user_type) }}</span>
              </td>
              <td class="col-role">
                <span class="tag" :class="user.role">{{ roleLabel(user.role) }}</span>
              </td>
              <td class="col-created-at">{{ formatDate(user.created_at) }}</td>
              <td class="actions">
                <div class="actions-group">
                  <button
                    class="ghost"
                    :disabled="!canEdit(user)"
                    :title="editDisabledReason(user)"
                    @click="openEdit(user)"
                  >
                    编辑
                  </button>
                  <button
                    class="danger"
                    :disabled="!canDelete(user)"
                    :title="deleteDisabledReason(user)"
                    @click="confirmDelete(user)"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filteredUsers.length">
              <td colspan="7" class="empty">暂无用户数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="drawerOpen" class="overlay">
      <div class="drawer">
        <header>
          <h3>编辑用户</h3>
          <button class="ghost" @click="closeDrawer">关闭</button>
        </header>
        <form @submit.prevent="submitEdit">
          <label>
            邮箱
            <input v-model="form.email" type="email" />
            <span v-if="formErrors.email" class="field-error">{{ formErrors.email }}</span>
          </label>
          <label>
            用户名
            <input v-model="form.username" />
            <span v-if="formErrors.username" class="field-error">{{ formErrors.username }}</span>
          </label>
          <label>
            重置密码（可选）
            <input v-model="form.password" type="password" />
            <span v-if="formErrors.password" class="field-error">{{ formErrors.password }}</span>
          </label>
          <label>
            角色
            <select v-model="form.role" :disabled="!canEditRole(activeUser)" :title="roleDisabledReason(activeUser)">
              <option v-for="role in roleOptions(activeUser)" :key="role" :value="role">
                {{ roleLabel(role) }}
              </option>
            </select>
            <span v-if="roleHelp" class="hint">{{ roleHelp }}</span>
          </label>
          <label>
            类型
            <select v-model="form.user_type">
              <option v-for="type in userTypeOptions" :key="type" :value="type">
                {{ userTypeLabel(type) }}
              </option>
            </select>
          </label>
          <div class="edit-drawer-actions">
            <button type="button" class="ghost" :disabled="saving" @click="closeDrawer">不保存</button>
            <button type="submit" :disabled="saving">保存</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="createOpen" class="overlay">
      <div class="drawer">
        <header>
          <h3>新建用户</h3>
          <button class="ghost" @click="closeCreate">关闭</button>
        </header>
        <form @submit.prevent="submitCreate">
          <label>
            邮箱
            <input v-model="createForm.email" type="email" />
            <span v-if="createErrors.email" class="field-error">{{ createErrors.email }}</span>
          </label>
          <label>
            用户名
            <input v-model="createForm.username" />
            <span v-if="createErrors.username" class="field-error">{{ createErrors.username }}</span>
          </label>
          <label>
            密码
            <input v-model="createForm.password" type="password" />
            <span v-if="createErrors.password" class="field-error">{{ createErrors.password }}</span>
          </label>
          <label>
            角色
            <select v-model="createForm.role">
              <option value="user">USER</option>
              <option value="admin">ADMIN</option>
              <option value="dev">DEV</option>
            </select>
          </label>
          <label>
            类型
            <select v-model="createForm.user_type">
              <option v-for="type in userTypeOptions" :key="type" :value="type">
                {{ userTypeLabel(type) }}
              </option>
            </select>
          </label>
          <button type="submit" :disabled="creating">创建</button>
        </form>
      </div>
    </div>

    <div v-if="deleteDialog" class="overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>确认删除</h3>
          <button class="ghost" @click="closeDelete">关闭</button>
        </div>
        <p>
          即将删除用户：<strong>{{ deleteDialog.username || deleteDialog.email || deleteDialog.id }}</strong>
        </p>
        <p class="muted">注意：删除后账号无法恢复，需要重新注册。</p>
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

const { state, isDev, isAdmin, logout, fetchMe } = useAuth();
const router = useRouter();

const users = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const pageJump = ref(1);
const roleFilter = ref('all');
const keyword = ref('');
const loading = ref(false);
const error = ref('');

const drawerOpen = ref(false);
const createOpen = ref(false);
const saving = ref(false);
const creating = ref(false);
const deleting = ref(false);
const activeUser = ref(null);
const deleteDialog = ref(null);

const form = reactive({
  id: null,
  email: '',
  username: '',
  password: '',
  role: 'user',
  user_type: 'student'
});

const createForm = reactive({
  email: '',
  username: '',
  password: '',
  role: 'user',
  user_type: 'student'
});

const formErrors = reactive({});
const createErrors = reactive({});

const toast = reactive({
  visible: false,
  message: '',
  type: 'info'
});
const userTypeOptions = ['student', 'public', 'teacher'];

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

const filteredUsers = computed(() => {
  const baseUsers = isAdmin.value ? users.value.filter((user) => user.role !== 'dev') : users.value;
  const term = keyword.value.trim().toLowerCase();
  if (!term) return baseUsers;
  return baseUsers.filter((user) => {
    return (
      String(user.id).includes(term) ||
      (user.email || '').toLowerCase().includes(term) ||
      (user.username || '').toLowerCase().includes(term)
    );
  });
});

const roleHelp = computed(() => {
  if (!activeUser.value) return '';
  if (isAdmin.value && (activeUser.value.role === 'dev' || activeUser.value.is_initial_dev)) {
    return 'admin 无法编辑 dev 用户';
  }
  if (isAdmin.value && activeUser.value.role === 'admin') {
    return 'admin 不能取消任何 admin 的 admin 权限';
  }
  if (isDev.value && activeUser.value.is_initial_dev) {
    return '初始 dev 不可降级';
  }
  return '';
});

watch([page, pageSize, roleFilter], () => {
  fetchUsers();
});

watch(page, (value) => {
  pageJump.value = value;
}, { immediate: true });

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
    if (err.status === 409) {
      showToast('冲突：例如邮箱已存在', 'error');
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

async function fetchUsers() {
  loading.value = true;
  error.value = '';
  try {
    const params = {
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value
    };
    if (roleFilter.value !== 'all') {
      params.role = roleFilter.value;
    }
    const data = await apiRequest('/users', { params });
    users.value = data.rows || [];
    total.value = data.total || 0;
  } catch (err) {
    error.value = err.message || '加载失败';
    handleApiError(err);
  } finally {
    loading.value = false;
  }
}

function refresh() {
  fetchUsers();
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
  changePage(nextPage);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function roleLabel(role) {
  if (role === 'dev') return 'DEV';
  if (role === 'admin') return 'ADMIN';
  return 'USER';
}

function userTypeLabel(userType) {
  const normalized = String(userType || '').trim().toLowerCase();
  if (normalized === 'student') return 'STUDENT';
  if (normalized === 'public') return 'PUBLIC';
  if (normalized === 'teacher') return 'TEACHER';
  if (!normalized) return '-';
  return normalized.toUpperCase();
}

function typeTagClass(userType) {
  const normalized = String(userType || '').trim().toLowerCase();
  return normalized ? `type-${normalized}` : 'type-unknown';
}

function canEdit(user) {
  if (!user) return false;
  if (isAdmin.value && (user.role === 'dev' || user.is_initial_dev)) {
    return false;
  }
  return true;
}

function editDisabledReason(user) {
  if (!user) return '';
  if (isAdmin.value && (user.role === 'dev' || user.is_initial_dev)) {
    return 'admin 不能修改 dev 用户';
  }
  return '';
}

function canEditRole(user) {
  if (!user) return false;
  if (isAdmin.value && (user.role === 'dev' || user.is_initial_dev)) {
    return false;
  }
  if (isAdmin.value && user.role === 'admin') {
    return false;
  }
  if (isDev.value && user.is_initial_dev) {
    return false;
  }
  return true;
}

function roleDisabledReason(user) {
  if (!user) return '';
  if (isAdmin.value && (user.role === 'dev' || user.is_initial_dev)) {
    return 'admin 不能修改 dev 用户';
  }
  if (isAdmin.value && user.role === 'admin') {
    return 'admin 不能取消任何 admin 的 admin 权限';
  }
  if (isDev.value && user.is_initial_dev) {
    return '初始 dev 不可降级';
  }
  return '';
}

function canDelete(user) {
  if (!user) return false;
  const currentUserId = state.user?.id;
  if (isDev.value) {
    if (user.id === currentUserId) return false;
    if (user.is_initial_dev) return false;
    return true;
  }
  if (isAdmin.value) {
    if (user.is_initial_dev) return false;
    if (['admin', 'dev'].includes(user.role)) return false;
    return true;
  }
  return false;
}

function deleteDisabledReason(user) {
  if (!user) return '';
  const currentUserId = state.user?.id;
  if (isDev.value) {
    if (user.id === currentUserId) return 'dev 不允许删除自己的账号';
    if (user.is_initial_dev) return '初始 dev 不可删除';
  }
  if (isAdmin.value) {
    if (user.role === 'dev' || user.is_initial_dev) return 'admin 不能修改 dev 用户';
    if (user.role === 'admin') return 'admin 不能删除管理员账号';
  }
  return '';
}

function roleOptions(user) {
  if (!user) return ['user', 'admin', 'dev'];
  if (isDev.value) {
    if (user.is_initial_dev) return ['dev'];
    return ['dev', 'admin', 'user'];
  }
  if (isAdmin.value) {
    if (user.role === 'admin') return ['admin'];
    if (user.role === 'dev' || user.is_initial_dev) return ['dev'];
    return ['user', 'admin'];
  }
  return ['user'];
}

async function openEdit(user) {
  if (!canEdit(user)) {
    showToast(editDisabledReason(user) || '无权限编辑', 'error');
    return;
  }
  resetErrors(formErrors);
  saving.value = false;
  try {
    const data = await apiRequest(`/users/${user.id}`);
    activeUser.value = data;
    form.id = data.id;
    form.email = data.email || '';
    form.username = data.username || '';
    form.password = '';
    form.role = data.role || 'user';
    form.user_type = data.user_type || 'student';
    drawerOpen.value = true;
  } catch (err) {
    handleApiError(err);
  }
}

function closeDrawer() {
  drawerOpen.value = false;
  activeUser.value = null;
}

function openCreate() {
  resetErrors(createErrors);
  createForm.email = '';
  createForm.username = '';
  createForm.password = '';
  createForm.role = 'user';
  createForm.user_type = 'student';
  createOpen.value = true;
}

function closeCreate() {
  createOpen.value = false;
}

function validateEmail(value) {
  return /.+@.+\..+/.test(value);
}

function validateUsername(value) {
  return /^[A-Za-z0-9]{6,15}$/.test(value);
}

function validatePassword(value) {
  if (!/^[A-Za-z0-9!@#$%^&*()_+\-.]{8,20}$/.test(value)) {
    return false;
  }
  const hasLetter = /[A-Za-z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[!@#$%^&*()_+\-.]/.test(value);
  const categoryCount = [hasLetter, hasNumber, hasSymbol].filter(Boolean).length;
  return categoryCount >= 2;
}

async function submitEdit() {
  if (!form.id) return;
  resetErrors(formErrors);
  if (!form.username || !validateUsername(form.username.trim())) {
    formErrors.username = '用户名需为6-15位字母或数字组合';
  }
  if (form.password && !validatePassword(form.password.trim())) {
    formErrors.password = '密码需为8-20位，包含字母、数字、特殊符号中的至少两种';
  }
  if (Object.values(formErrors).some((value) => value)) {
    return;
  }
  saving.value = true;

  const payload = {
    email: form.email || null,
    username: form.username?.trim() || null
  };

  if (form.password) {
    payload.password = form.password.trim();
  }

  if (form.role) {
    payload.role = form.role;
  }
  if (form.user_type) {
    payload.user_type = form.user_type;
  }

  try {
    await apiRequest(`/users/${form.id}`, {
      method: 'PUT',
      body: payload
    });
    if (state.user?.id === form.id) {
      await fetchMe();
    }
    showToast('保存成功', 'success');
    closeDrawer();
    fetchUsers();
  } catch (err) {
    handleApiError(err, formErrors);
  } finally {
    saving.value = false;
  }
}

async function submitCreate() {
  resetErrors(createErrors);
  if (!createForm.username || !validateUsername(createForm.username.trim())) {
    createErrors.username = '用户名需为6-15位字母或数字组合';
  }
  if (!createForm.password || !validatePassword(createForm.password.trim())) {
    createErrors.password = '密码需为8-20位，包含字母、数字、特殊符号中的至少两种';
  }
  if (!createForm.email) {
    createErrors.email = '请输入邮箱';
  } else if (!validateEmail(createForm.email)) {
    createErrors.email = '邮箱格式不正确';
  }
  if (Object.values(createErrors).some((value) => value)) {
    return;
  }

  creating.value = true;
  try {
    await apiRequest('/users', {
      method: 'POST',
      body: {
        email: createForm.email.trim(),
        username: createForm.username.trim(),
        password: createForm.password.trim(),
        role: createForm.role,
        user_type: createForm.user_type
      }
    });
    showToast('保存成功', 'success');
    closeCreate();
    fetchUsers();
  } catch (err) {
    handleApiError(err, createErrors);
  } finally {
    creating.value = false;
  }
}

function confirmDelete(user) {
  deleteDialog.value = user;
}

function closeDelete() {
  deleteDialog.value = null;
}

async function submitDelete() {
  if (!deleteDialog.value) return;
  deleting.value = true;
  try {
    await apiRequest(`/users/${deleteDialog.value.id}`, { method: 'DELETE' });
    showToast('删除成功', 'success');
    closeDelete();
    fetchUsers();
  } catch (err) {
    handleApiError(err);
  } finally {
    deleting.value = false;
  }
}

fetchUsers();
</script>

<style scoped>
.users-page {
  --users-col-id: 72px;
  --users-col-type: 108px;
  --users-col-role: 104px;
  --users-col-created-at: 168px;
  --users-col-actions: 132px;
  --users-col-shift: 92px;
  --users-fixed-width: calc(
    var(--users-col-id) +
    var(--users-col-type) +
    var(--users-col-role) +
    var(--users-col-created-at) +
    var(--users-col-actions)
  );
  --users-col-flex: calc((100% - var(--users-fixed-width)) / 2);
  --users-col-email: calc(var(--users-col-flex) + var(--users-col-shift));
  --users-col-username: calc(var(--users-col-flex) - var(--users-col-shift));
}

.users-page .table {
  width: 100%;
  table-layout: fixed;
  font-size: 13px;
}

.users-page .table th,
.users-page .table td {
  padding: 8px 8px;
  line-height: 1.15;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.users-page .table tbody tr {
  height: 44px;
}

.users-page .table tbody td {
  height: 44px;
  min-height: 44px;
  max-height: 44px;
  vertical-align: middle;
}

.users-page .table td.actions {
  display: table-cell;
  text-align: right;
  white-space: nowrap;
}

.users-page .table th.col-id,
.users-page .table td.col-id {
  width: var(--users-col-id);
  min-width: var(--users-col-id);
}

.users-page .table th.col-type,
.users-page .table td.col-type {
  width: var(--users-col-type);
  min-width: var(--users-col-type);
}

.users-page .table th.col-role,
.users-page .table td.col-role {
  width: var(--users-col-role);
  min-width: var(--users-col-role);
}

.users-page .table th.col-email,
.users-page .table td.col-email {
  width: var(--users-col-email);
  min-width: var(--users-col-email);
}

.users-page .table th.col-username,
.users-page .table td.col-username {
  width: var(--users-col-username);
  min-width: var(--users-col-username);
}

.users-page .table th.col-actions {
  text-align: right;
  width: var(--users-col-actions);
  min-width: var(--users-col-actions);
}

.users-page .table th.col-actions .col-actions-label {
  display: inline-block;
  min-width: 112px;
  text-align: left;
}

.users-page .table th.col-created-at,
.users-page .table td.col-created-at {
  width: var(--users-col-created-at);
  min-width: var(--users-col-created-at);
  font-variant-numeric: tabular-nums;
}

.users-page .table td.actions .actions-group {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 112px;
}

.users-page .table td.actions button {
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.1;
  border-radius: 8px;
}

.users-page .table td.actions button + button {
  margin-left: 4px;
}

.edit-drawer-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.edit-drawer-actions button {
  flex: 1;
  width: 50%;
}
</style>
