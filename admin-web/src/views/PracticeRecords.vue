<template>
  <section class="card practice-records-page">
    <div class="users-header">
      <div>
        <h2>用户数据</h2>
        <p class="muted">
          仅 dev 可查看 user_data.db 中的 practice_records，支持筛选与排序。
        </p>
      </div>
      <div class="toolbar">
        <div class="toolbar-left">
          <input
            v-model.trim="keyword"
            placeholder="搜索用户ID/邮箱/昵称"
            @keydown.enter="triggerSearch"
          />
          <input
            v-model.trim="userId"
            placeholder="用户ID"
            inputmode="numeric"
            pattern="[0-9]*"
          />
          <input
            v-model.trim="verbId"
            placeholder="动词ID"
            inputmode="numeric"
            pattern="[0-9]*"
          />
          <select v-model="exerciseType">
            <option value="all">全部题型</option>
            <option value="fill">填空</option>
            <option value="sentence">造句</option>
            <option value="quick-fill">快填</option>
            <option value="combo-fill">组合填空</option>
          </select>
          <select v-model="correctness">
            <option value="all">全部结果</option>
            <option value="1">正确</option>
            <option value="0">错误</option>
          </select>
          <input v-model.trim="tense" placeholder="时态" />
          <input v-model.trim="mood" placeholder="语气" />
          <input v-model.trim="person" placeholder="人称" />
          <button class="ghost" :disabled="!hasFilters" @click="clearFilters">清空</button>
          <button class="ghost" :disabled="loading" @click="refresh">刷新</button>
        </div>
        <div class="toolbar-right">
          <div class="pagination inline-pagination" v-if="total > pageSize">
            <button class="ghost" :disabled="page === 1 || loading" @click="changePage(page - 1)">
              上一页
            </button>
            <span>第 {{ page }} / {{ totalPages }} 页</span>
            <button
              class="ghost"
              :disabled="page === totalPages || loading"
              @click="changePage(page + 1)"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-block">
      <p class="error">{{ error }}</p>
      <button class="ghost" @click="refresh">重试</button>
    </div>

    <div v-else>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else>
        <div class="stats-grid">
          <div class="stat-card">
            <h3>总体正确率</h3>
            <p class="stat-value">{{ formatPercent(stats.overall.accuracy) }}</p>
            <p class="muted">正确 {{ stats.overall.correct }} / 总量 {{ stats.overall.total }}</p>
          </div>
        </div>

        <div class="stats-section">
          <div class="stats-toolbar">
            <h3>正确率统计</h3>
            <div class="stats-controls">
              <select v-model="statsView">
                <option value="byUser">按用户</option>
                <option value="byVerb">按题目（动词）</option>
                <option value="byUserTenseMood">用户 × 时态/语气</option>
              </select>
              <input v-model.trim="statsFilter" :placeholder="currentStats.placeholder" />
              <button class="ghost" :disabled="!statsFilter" @click="statsFilter = ''">清空筛选</button>
            </div>
          </div>
          <table class="table compact-table">
            <thead>
              <tr>
                <th v-for="column in currentStats.columns" :key="column.key">
                  <button
                    v-if="column.sortable"
                    class="ghost inline-button"
                    @click="toggleStatsSort"
                  >
                    {{ column.label }}
                    <span class="sort-indicator">{{ statsSortIndicator }}</span>
                  </button>
                  <span v-else>{{ column.label }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in currentStats.rows" :key="item.rowKey">
                <td v-for="column in currentStats.columns" :key="column.key">
                  {{ column.format(item) }}
                </td>
              </tr>
              <tr v-if="!currentStats.rows.length">
                <td :colspan="currentStats.columns.length" class="empty">暂无统计</td>
              </tr>
            </tbody>
          </table>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th class="sortable" @click="toggleSort('id')">
                ID <span class="sort-indicator">{{ sortIndicator('id') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('user_id')">
                用户ID <span class="sort-indicator">{{ sortIndicator('user_id') }}</span>
              </th>
              <th>用户</th>
              <th class="sortable" @click="toggleSort('verb_id')">
                动词 <span class="sort-indicator">{{ sortIndicator('verb_id') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('exercise_type')">
                练习类型 <span class="sort-indicator">{{ sortIndicator('exercise_type') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('is_correct')">
                结果 <span class="sort-indicator">{{ sortIndicator('is_correct') }}</span>
              </th>
              <th>作答</th>
              <th>正确答案</th>
              <th class="sortable" @click="toggleSort('tense')">
                时态 <span class="sort-indicator">{{ sortIndicator('tense') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('mood')">
                语气 <span class="sort-indicator">{{ sortIndicator('mood') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('person')">
                人称 <span class="sort-indicator">{{ sortIndicator('person') }}</span>
              </th>
              <th class="sortable" @click="toggleSort('created_at')">
                时间 <span class="sort-indicator">{{ sortIndicator('created_at') }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in records" :key="record.id">
              <td>{{ record.id }}</td>
              <td>{{ record.user_id }}</td>
              <td>
                <div>{{ formatUser(record) }}</div>
                <div class="muted">{{ record.email || '-' }}</div>
              </td>
              <td>
                <div>{{ record.infinitive || '-' }}</div>
                <div class="muted">{{ record.verb_id }}</div>
              </td>
              <td>{{ record.exercise_type || '-' }}</td>
              <td>
                <span class="tag" :class="record.is_correct ? 'success' : 'error'">
                  {{ record.is_correct ? '正确' : '错误' }}
                </span>
              </td>
              <td>
                <span class="ellipsis" :title="record.answer || '-'">
                  {{ formatText(record.answer) }}
                </span>
              </td>
              <td>
                <span class="ellipsis" :title="record.correct_answer || '-'">
                  {{ formatText(record.correct_answer) }}
                </span>
              </td>
              <td>{{ record.tense || '-' }}</td>
              <td>{{ record.mood || '-' }}</td>
              <td>{{ record.person || '-' }}</td>
              <td>{{ formatDate(record.created_at) }}</td>
            </tr>
            <tr v-if="!records.length">
              <td colspan="12" class="empty">暂无记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { apiRequest, ApiError } from '../utils/apiClient';
import { useAuth } from '../composables/useAuth';

const { logout } = useAuth();
const router = useRouter();

const records = ref([]);
const stats = ref({
  overall: { total: 0, correct: 0, accuracy: 0 },
  byUser: [],
  byVerb: [],
  byUserTenseMood: []
});

const statsView = ref('byUser');
const statsFilter = ref('');
const statsSortOrder = ref('desc');
const total = ref(0);
const page = ref(1);
const pageSize = ref(15);
const loading = ref(false);
const error = ref('');

const keyword = ref('');
const debouncedKeyword = ref('');
const userId = ref('');
const verbId = ref('');
const exerciseType = ref('all');
const correctness = ref('all');
const tense = ref('');
const mood = ref('');
const person = ref('');

const sortKey = ref('created_at');
const sortOrder = ref('desc');

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));
const hasFilters = computed(() =>
  Boolean(
    keyword.value ||
      verbId.value ||
      userId.value ||
      exerciseType.value !== 'all' ||
      correctness.value !== 'all' ||
      tense.value ||
      mood.value ||
      person.value
  )
);

let searchTimer;

watch(keyword, (value) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    debouncedKeyword.value = value.trim();
    page.value = 1;
  }, 300);
});

watch(
  [page, pageSize, debouncedKeyword, userId, verbId, exerciseType, correctness, tense, mood, person, sortKey, sortOrder],
  () => {
    fetchRecords();
    fetchStats();
  },
  { immediate: true }
);

function triggerSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  debouncedKeyword.value = keyword.value.trim();
  page.value = 1;
}

function clearFilters() {
  keyword.value = '';
  debouncedKeyword.value = '';
  userId.value = '';
  verbId.value = '';
  exerciseType.value = 'all';
  correctness.value = 'all';
  tense.value = '';
  mood.value = '';
  person.value = '';
  page.value = 1;
}

function changePage(nextPage) {
  page.value = Math.min(Math.max(nextPage, 1), totalPages.value);
}

function toggleSort(key) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    page.value = 1;
    return;
  }
  sortKey.value = key;
  sortOrder.value = 'asc';
  page.value = 1;
}

function sortIndicator(key) {
  if (sortKey.value !== key) return '↕';
  return sortOrder.value === 'asc' ? '↑' : '↓';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatPercent(value) {
  if (!value && value !== 0) return '-';
  return `${(value * 100).toFixed(1)}%`;
}

const statsSortIndicator = computed(() => (statsSortOrder.value === 'asc' ? '↑' : '↓'));

function toggleStatsSort() {
  statsSortOrder.value = statsSortOrder.value === 'asc' ? 'desc' : 'asc';
}

function buildStatsRows(rows, matcher) {
  const filtered = statsFilter.value
    ? rows.filter((row) => matcher(row, statsFilter.value))
    : rows.slice();
  return filtered.sort((a, b) => {
    const delta = (a.accuracy || 0) - (b.accuracy || 0);
    return statsSortOrder.value === 'asc' ? delta : -delta;
  });
}

const currentStats = computed(() => {
  if (statsView.value === 'byVerb') {
    const rows = buildStatsRows(stats.value.byVerb, (row, query) => {
      const value = query.toLowerCase();
      return (
        String(row.verb_id || '').includes(value) ||
        String(row.infinitive || '').toLowerCase().includes(value)
      );
    });
    return {
      placeholder: '筛选动词ID/原形',
      columns: [
        {
          key: 'infinitive',
          label: '动词',
          format: (row) => row.infinitive || '-'
        },
        {
          key: 'verb_id',
          label: '动词ID',
          format: (row) => row.verb_id ?? '-'
        },
        {
          key: 'accuracy',
          label: '正确率',
          sortable: true,
          format: (row) => formatPercent(row.accuracy)
        },
        {
          key: 'counts',
          label: '正确/总量',
          format: (row) => `${row.correct} / ${row.total}`
        }
      ],
      rows: rows.map((row) => ({ ...row, rowKey: `verb-${row.verb_id}` }))
    };
  }
  if (statsView.value === 'byUserTenseMood') {
    const rows = buildStatsRows(stats.value.byUserTenseMood, (row, query) => {
      const value = query.toLowerCase();
      return (
        String(row.user_id || '').includes(value) ||
        String(row.username || '').toLowerCase().includes(value) ||
        String(row.tense || '').toLowerCase().includes(value) ||
        String(row.mood || '').toLowerCase().includes(value)
      );
    });
    return {
      placeholder: '筛选用户/时态/语气',
      columns: [
        {
          key: 'user',
          label: '用户',
          format: (row) => row.username || `用户 ${row.user_id}`
        },
        {
          key: 'tense',
          label: '时态',
          format: (row) => row.tense || '-'
        },
        {
          key: 'mood',
          label: '语气',
          format: (row) => row.mood || '-'
        },
        {
          key: 'accuracy',
          label: '正确率',
          sortable: true,
          format: (row) => formatPercent(row.accuracy)
        },
        {
          key: 'counts',
          label: '正确/总量',
          format: (row) => `${row.correct} / ${row.total}`
        }
      ],
      rows: rows.map((row) => ({
        ...row,
        rowKey: `utm-${row.user_id}-${row.tense}-${row.mood}`
      }))
    };
  }

  const rows = buildStatsRows(stats.value.byUser, (row, query) => {
    const value = query.toLowerCase();
    return (
      String(row.user_id || '').includes(value) ||
      String(row.username || '').toLowerCase().includes(value) ||
      String(row.email || '').toLowerCase().includes(value)
    );
  });
  return {
    placeholder: '筛选用户ID/昵称/邮箱',
    columns: [
      {
        key: 'user',
        label: '用户',
        format: (row) => row.username || `用户 ${row.user_id}`
      },
      {
        key: 'email',
        label: '邮箱',
        format: (row) => row.email || '-'
      },
      {
        key: 'accuracy',
        label: '正确率',
        sortable: true,
        format: (row) => formatPercent(row.accuracy)
      },
      {
        key: 'counts',
        label: '正确/总量',
        format: (row) => `${row.correct} / ${row.total}`
      }
    ],
    rows: rows.map((row) => ({ ...row, rowKey: `user-${row.user_id}` }))
  };
});

function formatText(value) {
  if (!value) return '-';
  const text = String(value);
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}

function formatUser(record) {
  if (record.username) return record.username;
  if (record.email) return record.email;
  return `用户 ${record.user_id}`;
}

function refresh() {
  fetchRecords();
}

function handleApiError(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      logout();
      router.push({ name: 'Login', query: { error: 'expired' } });
      return;
    }
    if (err.status === 403) {
      error.value = err.message || '无权限查看用户数据';
      return;
    }
    if (err.isNetworkError) {
      error.value = '网络异常：无法连接到服务器（检查 API_BASE_URL/代理/CORS）';
      return;
    }
    error.value = err.message || '加载失败';
    return;
  }
  error.value = '网络异常：无法连接到服务器（检查 API_BASE_URL/代理/CORS）';
}

async function fetchRecords() {
  loading.value = true;
  error.value = '';
  try {
    const params = {
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value,
      sortBy: sortKey.value,
      sortOrder: sortOrder.value
    };
    if (debouncedKeyword.value) {
      params.keyword = debouncedKeyword.value;
    }
    if (verbId.value) {
      params.verbId = verbId.value.trim();
    }
    if (userId.value) {
      params.userId = userId.value.trim();
    }
    if (exerciseType.value !== 'all') {
      params.exerciseType = exerciseType.value;
    }
    if (correctness.value !== 'all') {
      params.isCorrect = correctness.value;
    }
    if (tense.value) {
      params.tense = tense.value.trim();
    }
    if (mood.value) {
      params.mood = mood.value.trim();
    }
    if (person.value) {
      params.person = person.value.trim();
    }

    const data = await apiRequest('/practice-records', { params });
    records.value = data.rows || [];
    total.value = data.total || 0;
  } catch (err) {
    handleApiError(err);
  } finally {
    loading.value = false;
  }
}

async function fetchStats() {
  try {
    const params = {};
    if (debouncedKeyword.value) {
      params.keyword = debouncedKeyword.value;
    }
    if (verbId.value) {
      params.verbId = verbId.value.trim();
    }
    if (userId.value) {
      params.userId = userId.value.trim();
    }
    if (exerciseType.value !== 'all') {
      params.exerciseType = exerciseType.value;
    }
    if (correctness.value !== 'all') {
      params.isCorrect = correctness.value;
    }
    if (tense.value) {
      params.tense = tense.value.trim();
    }
    if (mood.value) {
      params.mood = mood.value.trim();
    }
    if (person.value) {
      params.person = person.value.trim();
    }
    const data = await apiRequest('/practice-records/stats', { params });
    stats.value = {
      overall: data.overall || { total: 0, correct: 0, accuracy: 0 },
      byUser: data.byUser || [],
      byVerb: data.byVerb || [],
      byUserTenseMood: data.byUserTenseMood || []
    };
  } catch (err) {
    handleApiError(err);
  }
}
</script>
