<template>
  <section class="card users-page">
    <div class="users-header">
      <div>
        <h2>用户管理</h2>
        <p class="muted">
          已启用用户管理表格与编辑抽屉。接口对接：GET /admin/users（limit/offset/role）、GET /admin/users/:id、POST /admin/users、PUT /admin/users/:id、DELETE /admin/users/:id、GET /admin/auth/me。
        </p>
        <p class="muted total-count">共 {{ total }} 条</p>
      </div>
      <div class="toolbar">
        <input v-model.trim="keyword" placeholder="搜索邮箱/昵称/ID" />
        <select v-model="roleFilter">
          <option value="all">全部角色</option>
          <option value="dev">DEV</option>
          <option value="admin">ADMIN</option>
          <option value="user">USER</option>
        </select>
        <button class="ghost" @click="refresh" :disabled="loading">刷新</button>
        <button v-if="isDev" @click="openCreate">新建用户</button>
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
              <th>ID</th>
              <th>邮箱</th>
              <th>昵称</th>
              <th>角色</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in filteredUsers" :key="user.id">
              <td>{{ user.id }}</td>
              <td>{{ user.email || '-' }}</td>
              <td>{{ user.username || '-' }}</td>
              <td>
                <span class="tag" :class="user.role">{{ roleLabel(user.role) }}</span>
              </td>
              <td>{{ formatDate(user.created_at) }}</td>
              <td class="actions">
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
              </td>
            </tr>
            <tr v-if="!filteredUsers.length">
              <td colspan="6" class="empty">暂无用户数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="pagination" v-if="total > pageSize">
      <button class="ghost" :disabled="page === 1 || loading" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button
        class="ghost"
        :disabled="page === totalPages || loading"
        @click="changePage(page + 1)"
      >
        下一页
      </button>
    </div>

    <div v-if="drawerOpen" class="overlay" @click.self="closeDrawer">
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
            昵称
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
          <button type="submit" :disabled="saving">保存</button>
        </form>
      </div>
    </div>

    <div v-if="createOpen" class="overlay" @click.self="closeCreate">
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
            昵称
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
          <button type="submit" :disabled="creating">创建</button>
        </form>
      </div>
    </div>

    <div v-if="deleteDialog" class="overlay" @click.self="closeDelete">
      <div class="modal">
        <h3>确认删除</h3>
        <p>
          即将删除用户：<strong>{{ deleteDialog.username || deleteDialog.email || deleteDialog.id }}</strong>
        </p>
        <p class="muted">规则：admin 仅能删除非 admin/dev；dev 不能删除自己/初始 dev。</p>
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

const { state, isDev, isAdmin, logout } = useAuth();
const router = useRouter();

const users = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
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
  role: 'user'
});

const createForm = reactive({
  email: '',
  username: '',
  password: '',
  role: 'user'
});

const formErrors = reactive({});
const createErrors = reactive({});

const toast = reactive({
  visible: false,
  message: '',
  type: 'info'
});

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

  try {
    await apiRequest(`/users/${form.id}`, {
      method: 'PUT',
      body: payload
    });
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
        role: createForm.role
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
