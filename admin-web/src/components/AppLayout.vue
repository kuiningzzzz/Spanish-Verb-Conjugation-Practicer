<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <span>Conjugamos</span>
        <span>控制台</span>
      </div>
      <nav>
        <RouterLink to="/" end>仪表盘</RouterLink>
        <RouterLink to="/users">用户管理</RouterLink>
        <RouterLink to="/lexicon">词库管理</RouterLink>
        <RouterLink to="/questions">题库管理</RouterLink>
        <RouterLink to="/course-materials">课程教材管理</RouterLink>
        <RouterLink v-if="isTeacher" to="/class-management">班级管理</RouterLink>
        <RouterLink v-if="isTeacher" to="/assignment-publishing">发布作业</RouterLink>
        <RouterLink v-if="isDev" to="/feedback">反馈处理</RouterLink>
        <RouterLink v-if="isDev" to="/practice-records">用户数据</RouterLink>
        <RouterLink v-if="isDev" to="/announcements">公告管理</RouterLink>
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
          <span class="chip">{{ user.username || user.email }}</span>
          <span class="chip" :class="user.role">{{ user.role }}</span>
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
const { state, logout, isDev, isTeacher } = useAuth();

const titles = {
  Dashboard: '仪表盘',
  Users: '用户管理',
  Lexicon: '词库管理',
  QuestionBank: '题库管理',
  CourseMaterials: '课程教材管理',
  ClassManagement: '班级管理',
  AssignmentPublishing: '发布作业',
  Logs: '日志查看',
  Feedback: '反馈处理',
  PracticeRecords: '用户数据',
  Announcements: '公告管理',
  VersionManagement: '版本管理',
  DatabaseManagement: '数据库管理',
  ExperimentResults: '实验结果分析'
};

const title = computed(() => titles[route.name] || 'Admin');
const user = computed(() => state.user);

function handleLogout() {
  logout();
  router.push({ name: 'Login' });
}
</script>
