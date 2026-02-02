<template>
  <div class="login-page">
    <div class="login-card">
      <h1>Conjugamos 控制台</h1>
      <p class="muted">仅限管理员用户登录访问。</p>
      <form @submit.prevent="handleSubmit">
        <label>
          邮箱
          <input v-model="email" type="email" required placeholder="admin@example.com" />
        </label>
        <label>
          密码
          <input v-model="password" type="password" required placeholder="********" />
        </label>
        <button type="submit" :disabled="state.loading">
          {{ state.loading ? '登录中...' : '登录' }}
        </button>
        <p v-if="state.error" class="error">{{ state.error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const route = useRoute();
const router = useRouter();
const { login, state } = useAuth();

const email = ref('');
const password = ref('');
if (route.query.error === 'forbidden') {
  state.error = '无权限访问后台';
}

async function handleSubmit() {
  const ok = await login({ email: email.value, password: password.value });
  if (ok) {
    const target = route.query.redirect || '/';
    router.push(target);
  }
}
</script>
