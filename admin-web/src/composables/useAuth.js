import { reactive, computed } from 'vue';

const API_BASE = process.env.VUE_APP_ADMIN_API_BASE_URL || '/admin';
const TOKEN_KEY = 'admin_token';

const state = reactive({
  user: null,
  token: localStorage.getItem(TOKEN_KEY) || '',
  loading: false,
  error: ''
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
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.json().catch(() => ({}));
      const message = text?.error || (res.status === 403 ? '无权限访问后台' : '登录失败，请检查账号或密码');
      throw new Error(message);
    }
    const data = await res.json();
    state.token = data.token;
    localStorage.setItem(TOKEN_KEY, state.token);
    await fetchMe();
    return true;
  } catch (err) {
    state.error = err.message || '登录失败';
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
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (!res.ok) {
      throw new Error('鉴权失败');
    }
    const data = await res.json();
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
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }
}

const isAuthenticated = computed(() => Boolean(state.token && state.user));
const isAdmin = computed(() => state.user?.role === 'admin');
const isDev = computed(() => state.user?.role === 'dev');
const isPrivileged = computed(() => ['admin', 'dev'].includes(state.user?.role));

export function useAuth() {
  return {
    state,
    login,
    logout,
    fetchMe,
    isAuthenticated,
    isAdmin,
    isDev,
    isPrivileged
  };
}
