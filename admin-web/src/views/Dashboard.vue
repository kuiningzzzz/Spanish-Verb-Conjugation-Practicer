<template>
  <div class="dashboard-page">
    <div class="dashboard-grid">
      <section v-for="panel in panels" :key="panel.key" class="card history-panel">
        <div class="history-panel-header">
          <div class="history-header-main">
            <div class="history-title-row">
              <h3>{{ panel.title }}</h3>
              <div class="pagination inline-pagination compact-pagination" v-if="panel.items.length > pageSize">
                <button
                  class="ghost"
                  :disabled="pages[panel.key] === 1"
                  @click="changePage(panel, pages[panel.key] - 1)"
                >
                  ←
                </button>
                <span>第 {{ pages[panel.key] }} / {{ totalPages(panel) }} 页</span>
                <button
                  class="ghost"
                  :disabled="pages[panel.key] === totalPages(panel)"
                  @click="changePage(panel, pages[panel.key] + 1)"
                >
                  →
                </button>
              </div>
            </div>
            <p class="muted">共 {{ panel.items.length }} 条记录</p>
          </div>
        </div>

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
              <th>{{ panel.targetLabel }}</th>
              <th>修改时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in pagedItems(panel)" :key="item.id" class="history-row">
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
              <td class="actions">
                <button class="ghost" @click="openDetail(panel.key, item)">详情</button>
              </td>
            </tr>
            <tr v-if="!pagedItems(panel).length">
              <td colspan="4" class="empty">暂无记录</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <div v-if="detailOpen" class="overlay" @click.self="closeDetail">
      <div class="modal history-detail">
        <h3>{{ detailTitle }}</h3>
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
        <div class="modal-actions">
          <button class="ghost" @click="closeDetail">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';

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
      '更新昵称与邮箱信息',
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
  }
]);

const pages = reactive({
  users: 1,
  lexicon: 1,
  questions: 1
});

const detailOpen = ref(false);
const detailItem = ref(null);
const detailPanelKey = ref('');

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

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.history-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-panel h3 {
  margin: 0 0 4px;
}

.history-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.history-header-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.history-table {
  table-layout: fixed;
}

.history-row {
  height: 52px;
}

.history-cell {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-table .actions .ghost {
  font-size: 12px;
  padding: 4px 8px;
  line-height: 1.1;
  min-width: 44px;
  white-space: nowrap;
}

.compact-pagination {
  font-size: 12px;
  gap: 6px;
}

.compact-pagination .ghost {
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.1;
}

.history-detail {
  width: min(560px, 96vw);
}
</style>
