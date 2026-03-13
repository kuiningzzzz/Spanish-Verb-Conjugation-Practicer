<template>
  <div class="dashboard-page" :class="{ 'with-history': showHistory }">
    <div class="dashboard-top-row">
      <section ref="welcomeCardRef" class="card dashboard-welcome-card">
        <h2 ref="welcomeTextRef" class="dashboard-welcome-text" :style="welcomeTextStyle">欢迎回来，{{ welcomeText }}</h2>
        <p class="dashboard-welcome-subtext">
          在这里，您可以编辑用户信息、增设动词词条、调整题库内容、管理课程教材。
        </p>
        <p v-if="isTeacherUser" class="dashboard-welcome-subtext">
          作为教师，您还可以管理您的班级、发布和检查作业。
        </p>
      </section>

      <section v-if="showHistory" class="card dashboard-summary-card">
        <h3 class="dashboard-summary-title">管理总览</h3>
        <div class="dashboard-summary-list">
          <button
            v-for="item in dashboardStatsCards"
            :key="item.key"
            class="summary-item"
            type="button"
            @click="goTo(item.routeName)"
          >
            <span class="summary-main">
              <span class="summary-icon" :class="`icon-${item.key}`" aria-hidden="true">
                <svg v-if="item.key === 'users'" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="3.2" />
                  <path d="M5.5 18.4c0-2.7 2.9-4.9 6.5-4.9s6.5 2.2 6.5 4.9" />
                </svg>
                <svg v-else-if="item.key === 'verbs'" viewBox="0 0 24 24" fill="none">
                  <path d="M5.5 4.5h10a2 2 0 0 1 2 2v12.8a.2.2 0 0 1-.32.15L13.2 16.5a2 2 0 0 0-2.4 0l-3.98 2.95a.2.2 0 0 1-.32-.15V6.5a2 2 0 0 1 2-2z" />
                  <path d="M9 8.5h6M9 11.5h6" />
                </svg>
                <svg v-else-if="item.key === 'questions'" viewBox="0 0 24 24" fill="none">
                  <path d="M12 18.5v.01" />
                  <path d="M9.6 9.2a2.8 2.8 0 1 1 4.8 1.95c-.7.72-1.4 1.22-1.4 2.35" />
                  <circle cx="12" cy="12" r="8.5" />
                </svg>
                <svg v-else-if="item.key === 'textbooks'" viewBox="0 0 24 24" fill="none">
                  <path d="M6.5 5.2h9.2a2.3 2.3 0 0 1 2.3 2.3v11.3H8.8a2.3 2.3 0 0 0-2.3 2.3V5.2z" />
                  <path d="M6.5 18.8h11.5" />
                  <path d="M8.5 7.8h7.5" />
                  <path d="M8.5 10.9h7.5" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8.5" />
                </svg>
              </span>
              <span class="summary-text">{{ item.label }}：{{ formatStatCount(item.value, item.unit) }}</span>
            </span>
            <span class="summary-arrow" aria-hidden="true">›</span>
          </button>
        </div>
      </section>
    </div>

    <section v-if="showHistory" class="card history-panel history-panel-single">
      <div class="management-header history-panel-header">
        <h3 class="history-panel-title">管理历史</h3>
        <div class="history-header-side">
          <span class="muted history-record-total">共 {{ mergedHistory.length }} 条记录</span>
          <div class="pagination inline-pagination compact-pagination" v-if="mergedHistory.length > pageSize">
            <button
              class="ghost"
              :disabled="page === 1"
              @click="changePage(page - 1)"
            >
              ←
            </button>
            <span>第 {{ page }} / {{ totalPages }} 页</span>
            <button
              class="ghost"
              :disabled="page === totalPages"
              @click="changePage(page + 1)"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div class="management-page-body">
        <div class="management-table-scroll history-table-shell">
          <table class="table history-table">
            <colgroup>
              <col style="width: 22%" />
              <col style="width: 22%" />
              <col style="width: 16%" />
              <col style="width: 24%" />
              <col style="width: 16%" />
            </colgroup>
            <thead>
              <tr>
                <th>修改人</th>
                <th>管理历史类型</th>
                <th>目标ID</th>
                <th>修改时间</th>
                <th class="history-actions-header">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in pagedItems" :key="item.id" class="history-row">
                <td class="history-cell">
                  <span class="ellipsis" :title="item.username">{{ item.username }}</span>
                </td>
                <td class="history-cell">
                  <span class="ellipsis" :title="item.historyType">{{ item.historyType }}</span>
                </td>
                <td class="history-cell">
                  <span class="ellipsis" :title="String(item.targetId)">{{ item.targetId }}</span>
                </td>
                <td class="history-cell">
                  <span class="ellipsis" :title="formatDate(item.modifiedAt)">
                    {{ formatDateDay(item.modifiedAt) }}
                  </span>
                </td>
                <td class="history-actions-cell">
                  <button class="ghost" @click="openDetail(item)">详情</button>
                </td>
              </tr>
              <tr v-if="!pagedItems.length">
                <td colspan="5" class="empty">暂无记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <div v-if="showHistory && detailOpen" class="overlay">
      <div class="modal history-detail">
        <div class="modal-header">
          <h3>{{ detailTitle }}</h3>
          <button class="ghost" @click="closeDetail">关闭</button>
        </div>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">修改人</span>
            <span class="detail-value">{{ detailItem?.username || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">管理历史类型</span>
            <span class="detail-value">{{ detailItem?.historyType || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">{{ detailTargetLabel }}</span>
            <span class="detail-value">{{ detailItem?.targetId || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">修改时间</span>
            <span class="detail-value">{{ formatDate(detailItem?.modifiedAt) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">操作类型</span>
            <span class="detail-value">{{ detailItem?.action || '-' }}</span>
          </div>
          <div class="detail-item detail-span">
            <span class="detail-label">操作说明</span>
            <span class="detail-value muted">{{ detailItem?.description || '暂无更多信息' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { apiRequest } from '../utils/apiClient';
import { useAuth } from '../composables/useAuth';

const { state, isPowerAdmin, isAdmin } = useAuth();
const router = useRouter();

const pageSize = 5;

function buildHistory({ count, usernames, targetStart, actions, descriptions, prefix }) {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    username: usernames[index % usernames.length],
    targetId: targetStart + index,
    modifiedAt: new Date(now - index * 60 * 60 * 1000).toISOString(),
    action: actions[index % actions.length],
    description: descriptions[index % descriptions.length]
  }));
}

const userHistory = ref(
  buildHistory({
    count: 16,
    prefix: 'user',
    usernames: ['admin_zoe', 'dev_ming', 'admin_kai', 'ops_lina'],
    targetStart: 1001,
    actions: ['更新用户角色', '重置用户密码', '编辑用户资料', '禁用用户'],
    descriptions: [
      '角色由 user 调整为 admin',
      '通过后台重置密码并触发通知',
      '更新用户名与邮箱信息',
      '因违规操作暂时禁用账号'
    ]
  })
);

const lexiconHistory = ref(
  buildHistory({
    count: 12,
    prefix: 'lexicon',
    usernames: ['admin_zoe', 'lexi_hao', 'dev_ming'],
    targetStart: 3201,
    actions: ['更新动词释义', '补充变位', '修正标签', '调整示例'],
    descriptions: [
      '补充新的中文释义与词性',
      '新增虚拟式变位',
      '修正时态标签与分类',
      '替换更准确的例句'
    ]
  })
);

const questionHistory = ref(
  buildHistory({
    count: 14,
    prefix: 'question',
    usernames: ['admin_kai', 'dev_ming', 'qa_suri'],
    targetStart: 8801,
    actions: ['更新题干', '修正答案', '调整难度', '更新置信度'],
    descriptions: [
      '优化题干表述，使题目更清晰',
      '修正正确答案与解析',
      '根据反馈调整题目难度',
      '依据答题数据更新置信度'
    ]
  })
);

const courseMaterialHistory = ref(
  buildHistory({
    count: 11,
    prefix: 'course-material',
    usernames: ['admin_zoe', 'dev_ming', 'editor_yan'],
    targetStart: 501,
    actions: ['更新教材信息', '调整课程排序', '补充教材说明', '修正课程标签'],
    descriptions: [
      '更新课程教材基础信息与展示文案',
      '调整课程与教材的排序关系',
      '补充教材说明与适用范围',
      '修正课程教材标签与分类'
    ]
  })
);

const panels = computed(() => [
  {
    key: 'users',
    title: '用户管理历史',
    targetLabel: '用户ID',
    items: userHistory.value
  },
  {
    key: 'lexicon',
    title: '词库管理历史',
    targetLabel: '动词ID',
    items: lexiconHistory.value
  },
  {
    key: 'questions',
    title: '题库管理历史',
    targetLabel: '题目ID',
    items: questionHistory.value
  },
  {
    key: 'courseMaterials',
    title: '课程教材管理历史',
    targetLabel: '教材ID',
    items: courseMaterialHistory.value
  }
]);

const mergedHistory = computed(() =>
  panels.value
    .flatMap((panel) =>
      panel.items.map((item) => ({
        ...item,
        panelKey: panel.key,
        historyType: panel.title,
        targetLabel: panel.targetLabel
      }))
    )
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
);
const page = ref(1);

const detailOpen = ref(false);
const detailItem = ref(null);

const detailTitle = computed(() => (detailItem.value?.historyType ? `${detailItem.value.historyType}详情` : '详情'));
const detailTargetLabel = computed(() => detailItem.value?.targetLabel || '目标ID');
const dashboardUserName = computed(() => state.user?.username || state.user?.email || '管理员');
const dashboardUserSuffix = computed(() => (state.user?.user_type === 'teacher' ? '老师！' : '同学！'));
const isTeacherUser = computed(() => state.user?.user_type === 'teacher');
const welcomeText = computed(() => `${dashboardUserName.value} ${dashboardUserSuffix.value}`);
const showHistory = computed(() => isPowerAdmin.value || isAdmin.value);
const welcomeCardRef = ref(null);
const welcomeTextRef = ref(null);
const WELCOME_FONT_MAX = 34;
const WELCOME_FONT_MIN = 10;
const welcomeFontSize = ref(WELCOME_FONT_MAX);
const welcomeTextStyle = computed(() => ({
  fontSize: `${welcomeFontSize.value}px`
}));
const statsLoading = ref(false);
const dashboardStats = reactive({
  users: null,
  verbs: null,
  questions: null,
  textbooks: null
});
const dashboardStatsCards = computed(() => [
  { key: 'users', label: '用户总数', value: dashboardStats.users, unit: '人', routeName: 'Users' },
  { key: 'verbs', label: '词库动词', value: dashboardStats.verbs, unit: '条', routeName: 'Lexicon' },
  { key: 'questions', label: '题库总量', value: dashboardStats.questions, unit: '题', routeName: 'QuestionBank' },
  { key: 'textbooks', label: '录入教材', value: dashboardStats.textbooks, unit: '本', routeName: 'CourseMaterials' }
]);

const totalPages = computed(() => Math.max(1, Math.ceil(mergedHistory.value.length / pageSize)));
const pagedItems = computed(() => {
  const start = (page.value - 1) * pageSize;
  return mergedHistory.value.slice(start, start + pageSize);
});

function changePage(nextPage) {
  page.value = Math.min(Math.max(nextPage, 1), totalPages.value);
}

function extractTotal(result) {
  if (result.status !== 'fulfilled') return null;
  const total = Number(result.value?.total);
  return Number.isFinite(total) ? total : 0;
}

function extractTextbookTotal(result) {
  if (result.status !== 'fulfilled') return null;
  const explicitTotal = Number(result.value?.total);
  if (Number.isFinite(explicitTotal)) return explicitTotal;
  return Array.isArray(result.value?.rows) ? result.value.rows.length : 0;
}

async function fetchDashboardStats() {
  statsLoading.value = true;
  const [
    userRoleUsers,
    userRoleAdmins,
    verbsTotal,
    questionsTraditional,
    questionsPronoun,
    textbooksTotal
  ] = await Promise.allSettled([
    apiRequest('/users', { params: { role: 'user', limit: 1, offset: 0 } }),
    apiRequest('/users', { params: { role: 'admin', limit: 1, offset: 0 } }),
    apiRequest('/verbs', { params: { limit: 1, offset: 0 } }),
    apiRequest('/questions', { params: { questionBank: 'traditional', limit: 1, offset: 0 } }),
    apiRequest('/questions', { params: { questionBank: 'pronoun', limit: 1, offset: 0 } }),
    apiRequest('/course-materials/textbooks')
  ]);

  const usersCount = extractTotal(userRoleUsers);
  const adminsCount = extractTotal(userRoleAdmins);
  dashboardStats.users = usersCount === null || adminsCount === null ? null : usersCount + adminsCount;

  dashboardStats.verbs = extractTotal(verbsTotal);

  const traditionalQuestionsCount = extractTotal(questionsTraditional);
  const pronounQuestionsCount = extractTotal(questionsPronoun);
  dashboardStats.questions = traditionalQuestionsCount === null || pronounQuestionsCount === null
    ? null
    : traditionalQuestionsCount + pronounQuestionsCount;

  dashboardStats.textbooks = extractTextbookTotal(textbooksTotal);
  statsLoading.value = false;
}

function formatStatCount(value, unit) {
  if (Number.isFinite(value)) {
    return `${value} ${unit}`;
  }
  return statsLoading.value ? '加载中...' : '--';
}

function goTo(routeName) {
  if (!routeName) return;
  router.push({ name: routeName });
}

async function adjustWelcomeTextSize() {
  if (!welcomeTextRef.value) return;

  welcomeFontSize.value = WELCOME_FONT_MAX;
  await nextTick();

  const textEl = welcomeTextRef.value;
  const availableWidth = textEl.clientWidth;
  if (!availableWidth) return;

  const requiredWidth = textEl.scrollWidth;
  if (requiredWidth <= availableWidth) return;

  const scaled = Math.floor((availableWidth / requiredWidth) * WELCOME_FONT_MAX);
  welcomeFontSize.value = Math.max(WELCOME_FONT_MIN, scaled);
}

function openDetail(item) {
  detailItem.value = item;
  detailOpen.value = true;
}

function closeDetail() {
  detailOpen.value = false;
  detailItem.value = null;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
}

function formatDateDay(value) {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

const welcomeResizeObserver = ref(null);

onMounted(() => {
  adjustWelcomeTextSize();
  if (showHistory.value) {
    fetchDashboardStats();
  }

  if (typeof ResizeObserver !== 'undefined' && welcomeCardRef.value) {
    const observer = new ResizeObserver(() => {
      adjustWelcomeTextSize();
    });
    observer.observe(welcomeCardRef.value);
    welcomeResizeObserver.value = observer;
  } else {
    window.addEventListener('resize', adjustWelcomeTextSize);
  }
});

watch(welcomeText, () => {
  adjustWelcomeTextSize();
});

onBeforeUnmount(() => {
  if (welcomeResizeObserver.value) {
    welcomeResizeObserver.value.disconnect();
    welcomeResizeObserver.value = null;
    return;
  }
  window.removeEventListener('resize', adjustWelcomeTextSize);
});
</script>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: min(calc(100vh - 110px), 860px);
}

.dashboard-page.with-history {
  height: min(calc(100vh - 110px), 860px);
  overflow: hidden;
}

.dashboard-top-row {
  display: flex;
  gap: 12px;
  min-height: 0;
}

.dashboard-page.with-history .dashboard-top-row {
  flex: 0 0 36%;
}

.dashboard-page.with-history .dashboard-welcome-card {
  flex: 1.14;
  min-width: 0;
}

.dashboard-page.with-history .dashboard-summary-card {
  flex: 0.86;
  min-width: 0;
}

.dashboard-welcome-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 8px;
  padding-top: 40px;
}

.dashboard-page:not(.with-history) .dashboard-welcome-card {
  min-height: 220px;
}

.dashboard-welcome-text {
  margin: 0;
  font-size: 34px;
  line-height: 1.2;
  color: var(--theme-red-dark);
  font-weight: 800;
  padding-right: 2em;
  width: 100%;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}

.dashboard-welcome-subtext {
  margin: 0;
  font-size: 15px;
  line-height: 1.45;
  color: #c57a83;
}

.dashboard-welcome-text + .dashboard-welcome-subtext {
  margin-top: 18px;
}

.dashboard-summary-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dashboard-summary-title {
  margin: 0;
  font-size: 21px;
  color: var(--theme-red-dark);
}

.dashboard-summary-list {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.summary-item {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #ffffff;
  color: var(--text-main);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
}

.summary-item:hover {
  border-color: rgba(139, 0, 18, 0.28);
  background: #fffaf8;
}

.summary-main {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.summary-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 28px;
}

.summary-icon svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.summary-icon.icon-users {
  background: #fff2e8;
}

.summary-icon.icon-users svg {
  stroke: #a54f16;
}

.summary-icon.icon-verbs {
  background: #eaf2ff;
}

.summary-icon.icon-verbs svg {
  stroke: #1f5da5;
}

.summary-icon.icon-questions {
  background: #ffecee;
}

.summary-icon.icon-questions svg {
  stroke: #b43a49;
}

.summary-icon.icon-textbooks {
  background: #e8f8ef;
}

.summary-icon.icon-textbooks svg {
  stroke: #1d7a4f;
}

.summary-text {
  font-size: 14px;
  font-weight: 700;
  color: #4f1f25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-arrow {
  color: var(--theme-red);
  font-size: 18px;
  line-height: 1;
}

.dashboard-intro {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.history-panel-single {
  width: 100%;
}

.dashboard-page.with-history .history-panel-single {
  flex: 1;
}

.history-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.history-panel-title {
  margin: 0;
  font-size: 24px;
  color: var(--theme-red-dark);
}

.history-header-side {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  min-width: 0;
}

.history-record-total {
  font-size: 13px;
  white-space: nowrap;
}

.history-table {
  table-layout: fixed;
  font-size: 13px;
}

.history-table th,
.history-table td {
  padding: 8px 8px;
  line-height: 1.15;
}

.history-row {
  height: 44px;
}

.history-cell {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-actions-cell {
  text-align: center;
  padding-left: 18px;
  padding-right: 0;
}

.history-actions-header {
  text-align: center;
  padding-left: 18px;
  padding-right: 0;
}

.history-actions-cell .ghost {
  font-size: 12px;
  padding: 4px 8px;
  line-height: 1.1;
  min-width: 44px;
  white-space: nowrap;
}

.compact-pagination {
  font-size: 12px;
  gap: 6px;
  white-space: nowrap;
}

.compact-pagination .ghost {
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.1;
}

.history-detail {
  width: min(560px, 96vw);
}

@media (max-width: 960px) {
  .dashboard-top-row {
    flex-direction: column;
  }

  .dashboard-page.with-history .dashboard-top-row {
    flex: 0 0 auto;
  }

  .history-panel-header {
    align-items: flex-start;
  }

  .history-header-side {
    width: 100%;
    margin-left: 0;
    justify-content: space-between;
  }
}
</style>
