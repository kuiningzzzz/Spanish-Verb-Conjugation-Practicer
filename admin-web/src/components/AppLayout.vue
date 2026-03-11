<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <span>Conjugamos</span>
      </div>
      <nav>
        <RouterLink to="/" end>仪表盘</RouterLink>
        <RouterLink to="/users">用户管理</RouterLink>
        <RouterLink to="/lexicon">词库管理</RouterLink>
        <RouterLink to="/questions">题库管理</RouterLink>
        <RouterLink to="/course-materials">课程教材管理</RouterLink>
        <RouterLink v-if="isTeacher" to="/class-management">班级管理</RouterLink>
        <RouterLink v-if="isTeacher" to="/assignment-publishing">作业管理</RouterLink>
        <RouterLink v-if="isPowerAdmin" to="/feedback">{{ feedbackNavLabel }}</RouterLink>
        <RouterLink v-if="isDev" to="/practice-records">用户数据</RouterLink>
        <RouterLink v-if="isPowerAdmin" to="/announcements">公告管理</RouterLink>
        <RouterLink v-if="isDev" to="/versions">版本管理</RouterLink>
        <RouterLink v-if="isDev" to="/database">数据库管理</RouterLink>
        <RouterLink v-if="isDev" to="/logs">日志查看</RouterLink>
        <RouterLink v-if="isDev" to="/experiment-results">实验结果分析</RouterLink>
      </nav>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="topbar-left">
          <h1>{{ title }}</h1>
          <div class="topbar-left-actions"></div>
        </div>
        <div class="topbar-right" v-if="user">
          <span class="chip identity-chip">{{ user.username || user.email }}</span>
          <span class="chip role-chip" :class="user.role">{{ user.role }}</span>
          <span class="chip type-chip" :class="userTypeClass">{{ userTypeLabel }}</span>
          <button class="ghost" @click="handleLogout">退出</button>
        </div>
      </header>
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const route = useRoute();
const router = useRouter();
const { state, logout, isDev, isPowerAdmin, isSuperAdmin, isTeacher } = useAuth();

const titles = {
  Dashboard: '仪表盘',
  Users: '用户管理',
  Lexicon: '词库管理',
  QuestionBank: '题库管理',
  CourseMaterials: '课程教材管理',
  ClassManagement: '班级管理',
  AssignmentPublishing: '作业管理',
  Logs: '日志查看',
  Feedback: '反馈处理',
  PracticeRecords: '用户数据',
  Announcements: '公告管理',
  VersionManagement: '版本管理',
  DatabaseManagement: '数据库管理',
  ExperimentResults: '实验结果分析'
};

const feedbackNavLabel = computed(() => (isSuperAdmin.value ? '题目反馈' : '反馈处理'));
const title = computed(() => {
  if (route.name === 'Feedback' && isSuperAdmin.value) return '题目反馈';
  return titles[route.name] || 'Admin';
});
const user = computed(() => state.user);
const userTypeLabel = computed(() => {
  const normalized = String(user.value?.user_type || '').trim().toLowerCase();
  if (normalized === 'student') return '学生用户';
  if (normalized === 'public') return '社会人士';
  if (normalized === 'teacher') return '教师用户';
  return normalized || '-';
});
const userTypeClass = computed(() => {
  const normalized = String(user.value?.user_type || '').trim().toLowerCase();
  return normalized ? `type-${normalized}` : 'type-unknown';
});

function handleLogout() {
  logout();
  router.push({ name: 'Login' });
}
</script>
