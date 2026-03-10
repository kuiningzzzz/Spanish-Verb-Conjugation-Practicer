<template>
  <div class="dashboard-page">
    <section v-if="currentPanel" class="card history-panel history-panel-single">
      <div class="history-panel-header">
        <div class="history-panel-tabs" role="tablist" aria-label="管理历史切换">
          <button
            v-for="panel in panels"
            :key="panel.key"
            class="history-tab"
            :class="{ active: panel.key === currentPanel.key }"
            type="button"
            @click="selectPanel(panel.key)"
          >
            {{ panel.title }}
          </button>
        </div>
        <div class="history-header-side">
          <span class="muted history-record-total">共 {{ currentPanel.items.length }} 条记录</span>
          <div class="pagination inline-pagination compact-pagination" v-if="currentPanel.items.length > pageSize">
            <button
              class="ghost"
              :disabled="pages[currentPanel.key] === 1"
              @click="changePage(currentPanel, pages[currentPanel.key] - 1)"
            >
              ←
            </button>
            <span>第 {{ pages[currentPanel.key] }} / {{ totalPages(currentPanel) }} 页</span>
            <button
              class="ghost"
              :disabled="pages[currentPanel.key] === totalPages(currentPanel)"
              @click="changePage(currentPanel, pages[currentPanel.key] + 1)"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div class="history-table-shell">
        <table class="table history-table">
          <colgroup>
            <col style="width: 26%" />
            <col style="width: 20%" />
            <col style="width: 34%" />
            <col style="width: 20%" />
          </colgroup>
          <thead>
            <tr>
              <th>修改人</th>
              <th>{{ currentPanel.targetLabel }}</th>
              <th>修改时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in pagedItems(currentPanel)" :key="item.id" class="history-row">
              <td class="history-cell">
                <span class="ellipsis" :title="item.username">{{ item.username }}</span>
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
                <button class="ghost" @click="openDetail(currentPanel.key, item)">详情</button>
              </td>
            </tr>
            <tr v-if="!pagedItems(currentPanel).length">
              <td colspan="4" class="empty">暂无记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="detailOpen" class="overlay">
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
import { computed, reactive, ref } from 'vue';

const pageSize = 10;

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

const pages = reactive({
  users: 1,
  lexicon: 1,
  questions: 1,
  courseMaterials: 1
});
const activePanelKey = ref('users');

const detailOpen = ref(false);
const detailItem = ref(null);
const detailPanelKey = ref('');

const currentPanel = computed(() => panels.value.find((panel) => panel.key === activePanelKey.value) || panels.value[0] || null);
const detailPanel = computed(() => panels.value.find((panel) => panel.key === detailPanelKey.value) || null);
const detailTitle = computed(() => (detailPanel.value ? `${detailPanel.value.title}详情` : '详情'));
const detailTargetLabel = computed(() => detailPanel.value?.targetLabel || '目标ID');

function pagedItems(panel) {
  const start = (pages[panel.key] - 1) * pageSize;
  return panel.items.slice(start, start + pageSize);
}

function totalPages(panel) {
  return Math.max(1, Math.ceil(panel.items.length / pageSize));
}

function changePage(panel, nextPage) {
  const bounded = Math.min(Math.max(nextPage, 1), totalPages(panel));
  pages[panel.key] = bounded;
}

function selectPanel(panelKey) {
  activePanelKey.value = panelKey;
}

function openDetail(panelKey, item) {
  detailPanelKey.value = panelKey;
  detailItem.value = item;
  detailOpen.value = true;
}

function closeDetail() {
  detailOpen.value = false;
  detailItem.value = null;
  detailPanelKey.value = '';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatDateDay(value) {
  if (!value) return '-';
  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}
</script>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  height: min(calc(100vh - 180px), 760px);
  min-height: 560px;
  overflow: hidden;
}

.history-panel-single {
  width: 100%;
}

.history-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.history-panel-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.history-tab {
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 16px;
  font-weight: 700;
  padding: 4px 0;
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.history-tab.active {
  color: var(--theme-red-dark);
  border-bottom-color: var(--theme-gold);
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
}

.history-table-shell {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid #d8dce6;
  border-radius: 16px;
}

.history-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fff;
}

.history-row {
  height: 52px;
}

.history-cell {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-actions-cell {
  text-align: right;
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
  .history-panel {
    height: 66vh;
    min-height: 460px;
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
