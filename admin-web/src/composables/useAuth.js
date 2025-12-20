import { reactive, computed } from 'vue';

const API_BASE = process.env.VUE_APP_ADMIN_API_BASE_URL || 'http://localhost:3000';
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
    const res = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    if (!res.ok) {
      throw new Error('登录失败，请检查账号或密码');
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
    const res = await fetch(`${API_BASE}/admin/auth/me`, {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    if (!res.ok) {
      throw new Error('鉴权失败');
    }
    state.user = await res.json();
    return state.user;
  } catch (err) {
    logout();
    return null;
  }
}

function logout() {
  state.token = '';
  state.user = null;
  localStorage.removeItem(TOKEN_KEY);
}

const isAuthenticated = computed(() => Boolean(state.token && state.user));
const isAdmin = computed(() => state.user?.role === 'admin');

export function useAuth() {
  return {
    state,
    login,
    logout,
    fetchMe,
    isAuthenticated,
    isAdmin
  };
}
