import { createRouter, createWebHistory } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import AppLayout from '../components/AppLayout.vue';
import Dashboard from '../views/Dashboard.vue';
import Users from '../views/Users.vue';
import Lexicon from '../views/Lexicon.vue';
import QuestionBank from '../views/QuestionBank.vue';
import Logs from '../views/Logs.vue';
import Feedback from '../views/Feedback.vue';
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
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', name: 'Dashboard', component: Dashboard },
      { path: 'users', name: 'Users', component: Users },
      { path: 'lexicon', name: 'Lexicon', component: Lexicon },
      { path: 'questions', name: 'QuestionBank', component: QuestionBank },
      { path: 'logs', name: 'Logs', component: Logs },
      { path: 'feedback', name: 'Feedback', component: Feedback }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, isAdmin, fetchMe, state } = useAuth();

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

  if (to.meta.requiresAdmin && !isAdmin.value) {
    next({ name: 'Login' });
    return;
  }

  next();
});

export default router;
