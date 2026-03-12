import { reactive, computed } from 'vue';
import { apiRequest, ApiError } from '../utils/apiClient';

const TOKEN_KEY = 'admin_token';

const state = reactive({
  user: null,
  token: localStorage.getItem(TOKEN_KEY) || '',
  loading: false,
  error: ''
});

window.addEventListener('auth:expired', () => {
  state.token = '';
  state.user = null;
  localStorage.removeItem(TOKEN_KEY);
});

async function login(credentials) {
  state.loading = true;
  state.error = '';
  try {
    const identifier = credentials.identifier || credentials.email || credentials.username;
    if (!identifier || !credentials.password) {
      throw new Error('请输入账号和密码');
    }
    const payload = { identifier, password: credentials.password };
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: payload,
      auth: false
    });

    state.token = data.token;
    localStorage.setItem(TOKEN_KEY, state.token);
    state.user = data.user;
    return true;
  } catch (err) {
    if (err instanceof ApiError) {
      state.error = err.message || '登录失败';
    } else {
      state.error = err.message || '登录失败';
    }
    return false;
  } finally {
    state.loading = false;
  }
}

async function fetchMe() {
  if (!state.token) {
    state.user = null;
    return null;
  }
  try {
    const data = await apiRequest('/auth/me');
    state.user = data.user;
    return state.user;
  } catch (err) {
    logout();
    return null;
  }
}

function logout() {
  const token = state.token;
  state.token = '';
  state.user = null;
  localStorage.removeItem(TOKEN_KEY);
  if (token) {
    apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
  }
}

const isAuthenticated = computed(() => Boolean(state.token && state.user));
const isAdmin = computed(() => state.user?.role === 'admin');
const isDev = computed(() => state.user?.role === 'dev');
const isSuperAdmin = computed(() => state.user?.role === 'superadmin');
const isPowerAdmin = computed(() => ['dev', 'superadmin'].includes(state.user?.role));
const isPrivileged = computed(() => ['admin', 'dev', 'superadmin'].includes(state.user?.role));
const isTeacher = computed(() => state.user?.user_type === 'teacher');
const isInitialDev = computed(() => Boolean(state.user?.isInitialDev));

export function useAuth() {
  return {
    state,
    login,
    logout,
    fetchMe,
    isAuthenticated,
    isAdmin,
    isDev,
    isSuperAdmin,
    isPowerAdmin,
    isPrivileged,
    isTeacher,
    isInitialDev
  };
}
