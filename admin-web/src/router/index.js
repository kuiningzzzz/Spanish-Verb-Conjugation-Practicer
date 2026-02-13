import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import AppLayout from '../components/AppLayout.vue';
import Dashboard from '../views/Dashboard.vue';
import Users from '../views/Users.vue';
import Lexicon from '../views/Lexicon.vue';
import QuestionBank from '../views/QuestionBank.vue';
import Logs from '../views/Logs.vue';
import Feedback from '../views/Feedback.vue';
import PracticeRecords from '../views/PracticeRecords.vue';
import Announcements from '../views/Announcements.vue';
import VersionManagement from '../views/VersionManagement.vue';
import DatabaseManagement from '../views/DatabaseManagement.vue';
import ExperimentResults from '../views/ExperimentResults.vue';
import Login from '../views/Login.vue';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { public: true }
  },
  {
    path: '/',
    component: AppLayout,
    meta: { requiresAuth: true, requiresPrivileged: true },
    children: [
      { path: '', name: 'Dashboard', component: Dashboard },
      { path: 'users', name: 'Users', component: Users },
      { path: 'lexicon', name: 'Lexicon', component: Lexicon },
      { path: 'questions', name: 'QuestionBank', component: QuestionBank },
      { path: 'logs', name: 'Logs', component: Logs, meta: { requiresDev: true } },
      { path: 'feedback', name: 'Feedback', component: Feedback, meta: { requiresDev: true } },
      { path: 'practice-records', name: 'PracticeRecords', component: PracticeRecords, meta: { requiresDev: true } },
      { path: 'announcements', name: 'Announcements', component: Announcements, meta: { requiresDev: true } },
      { path: 'versions', name: 'VersionManagement', component: VersionManagement, meta: { requiresDev: true } },
      { path: 'database', name: 'DatabaseManagement', component: DatabaseManagement, meta: { requiresDev: true } },
      { path: 'experiment-results', name: 'ExperimentResults', component: ExperimentResults, meta: { requiresDev: true } }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, isAdmin, isDev, isPrivileged, fetchMe, state } = useAuth();

  if (!state.user && state.token) {
    await fetchMe();
  }

  if (to.meta.public) {
    if (isAuthenticated.value && isAdmin.value) {
      next({ name: 'Dashboard' });
    } else {
      next();
    }
    return;
  }

  if (to.meta.requiresAuth && !isAuthenticated.value) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
    return;
  }

  if (to.meta.requiresPrivileged && !isPrivileged.value) {
    next({ name: 'Login', query: { error: 'forbidden' } });
    return;
  }
  if (to.meta.requiresDev && !isDev.value) {
    next({ name: 'Dashboard' });
    return;
  }

  next();
});

export default router;
