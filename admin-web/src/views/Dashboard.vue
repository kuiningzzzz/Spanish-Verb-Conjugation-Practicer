<template>
  <div class="dashboard-page" :class="{ 'with-history': showHistory, 'history-expanded': showHistory && historyExpanded }">
    <transition name="dashboard-top-collapse">
      <div v-show="!showHistory || !historyExpanded" class="dashboard-top-row">
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
    </transition>

    <section v-if="showHistory" class="card history-panel history-panel-single">
      <div class="management-header history-panel-header">
        <h3 class="history-panel-title">管理历史</h3>
        <button
          class="history-expand-toggle"
          :title="historyExpanded ? '收起管理历史' : '展开管理历史'"
          @click="toggleHistoryExpanded"
        >
          <span
            aria-hidden="true"
            class="history-expand-icon"
            :class="{ expanded: historyExpanded }"
          >
            ⌃
          </span>
        </button>
        <div class="history-header-side">
          <button v-if="isDev" class="danger" :disabled="historyLoading || batchDeleting" @click="openBatchDeleteDialog">
            {{ batchDeleting ? '删除中...' : '删除 30 天前历史' }}
          </button>
          <button class="ghost" :disabled="historyLoading" @click="refreshHistory">
            {{ historyLoading ? '刷新中...' : '刷新' }}
          </button>
          <span class="muted history-record-total">共 {{ historyTotal }} 条记录</span>
          <div class="pagination inline-pagination compact-pagination" v-if="historyTotal > pageSize">
            <button
              class="ghost"
              :disabled="page === 1 || historyLoading"
              @click="changePage(page - 1)"
            >
              ←
            </button>
            <span>第 {{ page }} / {{ totalPages }} 页</span>
            <button
              class="ghost"
              :disabled="page === totalPages || historyLoading"
              @click="changePage(page + 1)"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div class="management-page-body">
        <div v-if="historyError" class="error-block">
          <p class="error">{{ historyError }}</p>
          <button class="ghost" @click="refreshHistory">重试</button>
        </div>
        <div v-else-if="historyLoading" class="loading">加载中...</div>
        <div v-else class="management-table-scroll history-table-shell">
          <table class="table history-table">
            <colgroup>
              <col style="width: 21%" />
              <col style="width: 24%" />
              <col style="width: 14%" />
              <col style="width: 23%" />
              <col style="width: 18%" />
            </colgroup>
            <thead>
              <tr>
                <th>修改人</th>
                <th>操作类型</th>
                <th>目标ID</th>
                <th>修改时间</th>
                <th class="history-actions-header">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in historyRows" :key="`${item.record_source}-${item.id}`" class="history-row">
                <td class="history-cell">
                  <span class="ellipsis" :title="item.operator_username">{{ item.operator_username }}</span>
                </td>
                <td class="history-cell">
                  <span class="ellipsis" :title="formatActionType(item.action_type)">{{ formatActionType(item.action_type) }}</span>
                </td>
                <td class="history-cell">
                  <span class="ellipsis" :title="String(item.target_id)">{{ item.target_id }}</span>
                </td>
                <td class="history-cell">
                  <span class="ellipsis" :title="formatDate(item.modified_at)">
                    {{ formatDate(item.modified_at) }}
                  </span>
                </td>
                <td class="history-actions-cell">
                  <div class="history-actions-group">
                    <button class="ghost" @click="openDetail(item)">详情</button>
                    <button
                      v-if="isDev"
                      class="danger"
                      :disabled="deletingHistory"
                      @click="openDeleteDialog(item)"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="!historyRows.length">
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
        <div v-if="detailLoading" class="loading history-detail-loading">加载中...</div>
        <div v-else-if="detailError" class="error-block history-detail-error">
          <p class="error">{{ detailError }}</p>
          <button class="ghost" @click="closeDetail">关闭</button>
        </div>
        <div v-else class="history-detail-scroll">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">修改人</span>
              <span class="detail-value">{{ detailItem?.operator_username || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">修改人角色</span>
              <span class="detail-value">{{ detailItem?.operator_role || '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">管理历史类型</span>
              <span class="detail-value">{{ formatHistoryType(detailItem?.history_type) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">目标ID</span>
              <span class="detail-value">{{ detailItem?.target_id ?? '-' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">操作类型</span>
              <span class="detail-value">{{ formatActionType(detailItem?.action_type) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">修改时间</span>
              <span class="detail-value">{{ formatDate(detailItem?.modified_at) }}</span>
            </div>
          </div>

          <section v-if="detailChangedFields.length" class="detail-section">
            <h4 class="detail-section-title">变更字段</h4>
            <div class="detail-chip-list">
              <span v-for="item in detailChangedFields" :key="item.key" class="detail-chip">
                {{ item.label }}
              </span>
            </div>
          </section>

          <section
            v-for="section in detailSections"
            :key="section.key"
            class="detail-section"
          >
            <h4 class="detail-section-title">{{ section.title }}</h4>
            <div class="detail-payload-grid">
              <div
                v-for="entry in section.entries"
                :key="`${section.key}-${entry.key}`"
                class="detail-payload-item"
              >
                <span class="detail-label">{{ entry.label }}</span>
                <pre v-if="entry.isComplex" class="detail-json">{{ entry.display }}</pre>
                <span v-else class="detail-value">{{ entry.display }}</span>
              </div>
            </div>
          </section>

          <div v-if="!detailSections.length && !detailChangedFields.length" class="empty history-detail-empty">
            暂无更多详情
          </div>
        </div>
      </div>
    </div>

    <div v-if="deleteDialog" class="overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>确认删除历史</h3>
          <button class="ghost" @click="closeDeleteDialog">关闭</button>
        </div>
        <p>
          即将删除历史记录：<strong>{{ formatHistoryType(deleteDialog.history_type) }}</strong>（ID: {{ deleteDialog.id }}）
        </p>
        <p class="muted">删除后不可恢复。</p>
        <div class="modal-actions">
          <button class="ghost" @click="closeDeleteDialog">取消</button>
          <button class="danger" :disabled="deletingHistory" @click="submitDeleteHistory">确认删除</button>
        </div>
      </div>
    </div>

    <div v-if="batchDeleteDialogOpen" class="overlay">
      <div class="modal warning">
        <div class="modal-header">
          <h3>确认删除旧历史</h3>
          <button class="ghost" @click="closeBatchDeleteDialog">关闭</button>
        </div>
        <p>将删除所有早于 30 天的管理历史记录。</p>
        <p class="muted">此操作不可恢复，请确认无误。</p>
        <div class="modal-actions">
          <button class="ghost" @click="closeBatchDeleteDialog">取消</button>
          <button class="danger" :disabled="batchDeleting" @click="submitDeleteOlderHistory">确认删除</button>
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

const { state, isPowerAdmin, isAdmin, isDev } = useAuth();
const router = useRouter();

const historyExpanded = ref(false);
const pageSize = 10;
const page = ref(1);
const historyRows = ref([]);
const historyTotal = ref(0);
const historyLoading = ref(false);
const historyError = ref('');

const detailOpen = ref(false);
const detailItem = ref(null);
const detailLoading = ref(false);
const detailError = ref('');

const deleteDialog = ref(null);
const deletingHistory = ref(false);
const batchDeleteDialogOpen = ref(false);
const batchDeleting = ref(false);

const HISTORY_TYPE_LABELS = {
  user: '用户(user)',
  lexicon: '词库(lexicon)',
  question_traditional: '题库(question_traditional)',
  question_pronoun: '题库(question_pronoun)',
  textbook: '教材(textbook)'
};

const ACTION_TYPE_LABELS = {
  update_user: '编辑用户',
  delete_user: '删除用户',
  create_verb: '新建动词',
  update_verb: '编辑动词',
  delete_verb: '删除动词',
  create_conjugation: '新增变位',
  update_conjugation: '编辑变位',
  delete_conjugation: '删除变位',
  update_question: '编辑题目',
  delete_question: '删除题目',
  delete_question_auto: '系统自动删除题目',
  create_textbook: '新建教材',
  update_textbook: '编辑教材',
  submit_textbook_publish: '提交发布教材',
  approve_textbook_publish: '确认发布教材',
  publish_textbook: '发布教材',
  unpublish_textbook: '取消发布教材',
  delete_textbook: '删除教材'
};

const FIELD_LABELS = {
  username: '用户名',
  email: '邮箱',
  password: '密码（已修改）',
  school: '学校',
  enrollment_year: '入学年份',
  role: '角色',
  user_type: '类型',
  subscription_end_date: '订阅截止时间',
  participate_in_leaderboard: '参与排行榜',
  is_initial_admin: '初始管理员',
  is_initial_dev: '初始开发者',
  id: 'ID',
  infinitive: '动词原形',
  meaning: '释义',
  conjugation_type: '变位类型',
  is_irregular: '是否不规则',
  is_reflexive: '是否自反',
  has_tr_use: '及物用法',
  has_intr_use: '不及物用法',
  supports_do: '支持 DO',
  supports_io: '支持 IO',
  supports_do_io: '支持 DO+IO',
  gerund: '副动词',
  participle: '过去分词',
  participle_forms: '过去分词其它形式',
  lesson_number: '课次',
  textbook_volume: '教材册数',
  frequency_level: '频率等级',
  verb_id: '动词ID',
  tense: '时态',
  mood: '语气',
  person: '人称',
  conjugated_form: '变位',
  question_bank: '题目类型',
  question_text: '题干',
  correct_answer: '答案',
  example_sentence: '例句',
  translation: '翻译',
  hint: '提示',
  confidence_score: '置信度',
  host_form: '变位形式',
  host_form_zh: '变位形式中文',
  pronoun_pattern: '代词模式',
  io_pronoun: 'IO 代词',
  do_pronoun: 'DO 代词',
  textbook: '教材内容',
  lessons: '课程内容',
  lesson: '课程内容',
  verb: '动词详情',
  verbs: '动词列表',
  conjugations: '变位信息',
  verb_ids: '动词ID列表',
  name: '教材名',
  description: '描述',
  cover_image: '封面',
  is_published: '是否发布',
  publish_status: '发布状态',
  order_index: '排序',
  uploader_id: '上传者ID',
  created_at: '创建时间',
  updated_at: '更新时间',
  textbook_id: '教材ID',
  title: '标题',
  grammar_points: '语法点',
  moods: '语气列表',
  tenses: '时态列表',
  conjugation_types: '变位类型列表'
};

const HIDDEN_DETAIL_FIELDS = new Set([
  'password',
  'avatar',
  'is_initial_admin',
  'is_initial_dev',
  'unique_id',
  'participate_in_leaderboard',
  'example_sentence',
  'question_type',
  'question_source',
  'public_question_source'
]);

function formatHistoryType(value) {
  if (!value) return '-';
  return HISTORY_TYPE_LABELS[value] || value;
}

function formatActionType(value) {
  if (!value) return '-';
  return ACTION_TYPE_LABELS[value] || value;
}

function formatFieldLabel(key) {
  return FIELD_LABELS[key] || key;
}

function isComplexValue(value) {
  return Array.isArray(value) || (value && typeof value === 'object');
}

function localizeDetailValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => localizeDetailValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      if (HIDDEN_DETAIL_FIELDS.has(key)) {
        return acc;
      }
      acc[formatFieldLabel(key)] = localizeDetailValue(nestedValue);
      return acc;
    }, {});
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }

  return value;
}

function formatFieldDisplay(key, value) {
  if (key === 'password') return '已隐藏';
  if (key === 'avatar') return null;
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (isComplexValue(value)) return JSON.stringify(localizeDetailValue(value), null, 2);
  return String(value);
}

function formatConjugationIrregularLabel(value) {
  return Number(value) === 1 || value === true ? '不规则' : '规则';
}

function normalizeConjugationTextKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizeConjugationMoodLabel(mood) {
  const raw = String(mood || '').trim();
  if (!raw) return '';

  const directMap = {
    '陈述式': '陈述式',
    '复合陈述式': '陈述式',
    '虚拟式': '虚拟式',
    '复合虚拟式': '虚拟式',
    '条件式': '条件式',
    '命令式': '命令式'
  };
  if (directMap[raw]) return directMap[raw];

  const normalized = normalizeConjugationTextKey(raw);
  const normalizedMap = {
    indicativo: '陈述式',
    indicativo_compuesto: '陈述式',
    subjuntivo: '虚拟式',
    subjuntivo_compuesto: '虚拟式',
    condicional: '条件式',
    imperativo: '命令式'
  };
  return normalizedMap[normalized] || raw;
}

function resolveConjugationMoodAndTense(mood, tense) {
  const rawTense = String(tense || '').trim();
  const normalizedTense = normalizeConjugationTextKey(rawTense);
  let moodLabel = normalizeConjugationMoodLabel(mood);

  const conditionalKeys = [
    '条件式',
    'condicional',
    'conditional',
    '条件完成时',
    'condicional_perfecto',
    'conditional_perfect'
  ];
  const imperativeKeys = [
    '肯定命令式',
    '否定命令式',
    'imperativo_afirmativo',
    'imperativo_negativo',
    'afirmativo',
    'negativo'
  ];

  if (conditionalKeys.includes(rawTense) || conditionalKeys.includes(normalizedTense)) {
    moodLabel = '条件式';
  } else if (imperativeKeys.includes(rawTense) || imperativeKeys.includes(normalizedTense)) {
    moodLabel = '命令式';
  }

  if (!rawTense) {
    return {
      mood: moodLabel || '',
      tense: ''
    };
  }

  const tenseDisplayMap = {
    '陈述式': {
      '现在时': '一般现在时',
      presente: '一般现在时',
      present: '一般现在时',
      '现在完成时': '现在完成时',
      perfecto: '现在完成时',
      preterito_perfecto: '现在完成时',
      preterite_perfect: '现在完成时',
      '未完成过去时': '过去未完成时',
      '过去未完成时': '过去未完成时',
      imperfecto: '过去未完成时',
      preterito_imperfecto: '过去未完成时',
      imperfect: '过去未完成时',
      '简单过去时': '简单过去时',
      preterito: '简单过去时',
      preterito_indefinido: '简单过去时',
      preterite: '简单过去时',
      '过去完成时': '过去完成时',
      pluscuamperfecto: '过去完成时',
      pluperfect: '过去完成时',
      '将来时': '将来未完成时',
      futuro: '将来未完成时',
      future: '将来未完成时',
      '将来完成时': '将来完成时',
      futuro_perfecto: '将来完成时',
      future_perfect: '将来完成时',
      '前过去时': '前过去时',
      '先过去时': '前过去时',
      preterito_anterior: '前过去时',
      preterite_anterior: '前过去时'
    },
    '虚拟式': {
      '虚拟现在时': '现在时',
      subjuntivo_presente: '现在时',
      presente: '现在时',
      present: '现在时',
      '虚拟过去时': '过去未完成时',
      '虚拟过去未完成时': '过去未完成时',
      subjuntivo_imperfecto: '过去未完成时',
      imperfecto: '过去未完成时',
      imperfect: '过去未完成时',
      preterito_imperfecto: '过去未完成时',
      '虚拟现在完成时': '现在完成时',
      subjuntivo_perfecto: '现在完成时',
      perfecto: '现在完成时',
      preterito_perfecto: '现在完成时',
      preterite_perfect: '现在完成时',
      '虚拟过去完成时': '过去完成时',
      subjuntivo_pluscuamperfecto: '过去完成时',
      pluscuamperfecto: '过去完成时',
      pluperfect: '过去完成时',
      '虚拟将来未完成时': '将来未完成时',
      '虚拟将来时': '将来未完成时',
      subjuntivo_futuro: '将来未完成时',
      futuro: '将来未完成时',
      future: '将来未完成时',
      '虚拟将来完成时': '将来完成时',
      subjuntivo_futuro_perfecto: '将来完成时',
      futuro_perfecto: '将来完成时',
      future_perfect: '将来完成时'
    },
    '条件式': {
      '条件式': '简单条件式',
      condicional: '简单条件式',
      conditional: '简单条件式',
      '条件完成时': '复合条件式',
      condicional_perfecto: '复合条件式',
      conditional_perfect: '复合条件式'
    },
    '命令式': {
      '肯定命令式': '命令式',
      imperativo_afirmativo: '命令式',
      afirmativo: '命令式',
      '否定命令式': '否定命令式',
      imperativo_negativo: '否定命令式',
      negativo: '否定命令式'
    }
  };

  const moodMap = tenseDisplayMap[moodLabel] || {};
  const display = moodMap[rawTense] || moodMap[normalizedTense];
  if (display) {
    return {
      mood: moodLabel || '',
      tense: display
    };
  }

  let normalizedDisplay = rawTense;
  if (moodLabel && rawTense.startsWith(`${moodLabel} `)) {
    normalizedDisplay = rawTense.slice(moodLabel.length).trim();
  }

  return {
    mood: moodLabel || '',
    tense: normalizedDisplay || rawTense
  };
}

function formatConjugationPersonLabel(person) {
  const raw = String(person || '').trim();
  if (!raw) return '';

  const personMap = {
    yo: 'yo',
    'tú': 'tú',
    'él/ella/usted': 'él/ella/usted',
    nosotros: 'nosotros',
    vosotros: 'vosotros',
    'ellos/ellas/ustedes': 'ellos/ellas/ustedes',
    vos: 'vos',
    'tú (afirmativo)': 'tú (afirmativo)',
    'tú (negativo)': 'tú (negativo)',
    usted: 'usted',
    'nosotros/nosotras': 'nosotros/nosotras',
    'vosotros/vosotras': 'vosotros/vosotras',
    ustedes: 'ustedes'
  };

  return personMap[raw] || raw;
}

function buildConjugationSummary(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '-';
  const { mood, tense } = resolveConjugationMoodAndTense(payload.mood, payload.tense);

  const parts = [
    mood || '未设语气',
    tense || '未设时态',
    formatConjugationPersonLabel(payload.person) || '未设人称',
    payload.conjugated_form || '未设变位',
    formatConjugationIrregularLabel(payload.is_irregular)
  ];

  return parts.join(' / ');
}

function buildDetailEntries(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  return Object.entries(payload)
    .filter(([key]) => !HIDDEN_DETAIL_FIELDS.has(key))
    .map(([key, value]) => ({
      key,
      label: formatFieldLabel(key),
      display: formatFieldDisplay(key, value),
      isComplex: isComplexValue(value)
    }));
}

const totalPages = computed(() => Math.max(1, Math.ceil(historyTotal.value / pageSize)));
const detailTitle = computed(() => (detailItem.value ? `${formatHistoryType(detailItem.value.history_type)}详情` : '详情'));
const isConjugationUpdateDetail = computed(() => detailItem.value?.action_type === 'update_conjugation');
const detailChangedFields = computed(() => {
  if (isConjugationUpdateDetail.value) {
    return [];
  }
  const fields = Array.isArray(detailItem.value?.changed_fields) ? detailItem.value.changed_fields : [];
  return fields.map((field) => ({
    key: field,
    label: field === 'password' ? '密码（已修改）' : formatFieldLabel(field)
  }));
});
const detailSections = computed(() => {
  const sections = [];
  if (detailItem.value?.before_data) {
    sections.push({
      key: 'before',
      title: '修改前',
      entries: isConjugationUpdateDetail.value
        ? [{
            key: 'conjugation_summary_before',
            label: '完整变位描述',
            display: buildConjugationSummary(detailItem.value.before_data),
            isComplex: false
          }]
        : buildDetailEntries(detailItem.value.before_data)
    });
  }
  if (detailItem.value?.after_data) {
    sections.push({
      key: 'after',
      title: isConjugationUpdateDetail.value ? '修改后' : '修改内容',
      entries: isConjugationUpdateDetail.value
        ? [{
            key: 'conjugation_summary_after',
            label: '完整变位描述',
            display: buildConjugationSummary(detailItem.value.after_data),
            isComplex: false
          }]
        : buildDetailEntries(detailItem.value.after_data)
    });
  }
  if (detailItem.value?.snapshot_data) {
    sections.push({
      key: 'snapshot',
      title: '保留内容',
      entries: buildDetailEntries(detailItem.value.snapshot_data)
    });
  }
  return sections.filter((section) => section.entries.length);
});
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

async function fetchHistory() {
  if (!showHistory.value) return;

  historyLoading.value = true;
  historyError.value = '';

  try {
    const data = await apiRequest('/history', {
      params: {
        limit: pageSize,
        offset: (page.value - 1) * pageSize
      }
    });

    const nextRows = Array.isArray(data?.rows) ? data.rows : [];
    const nextTotal = Number.isFinite(Number(data?.total)) ? Number(data.total) : 0;
    const maxPage = Math.max(1, Math.ceil(nextTotal / pageSize));

    if (page.value > maxPage) {
      page.value = maxPage;
      historyLoading.value = false;
      await fetchHistory();
      return;
    }

    historyRows.value = nextRows;
    historyTotal.value = nextTotal;
  } catch (error) {
    historyRows.value = [];
    historyTotal.value = 0;
    historyError.value = error.message || '加载管理历史失败';
  } finally {
    historyLoading.value = false;
  }
}

async function refreshHistory() {
  await fetchHistory();
}

async function changePage(nextPage) {
  const safePage = Math.min(Math.max(nextPage, 1), totalPages.value);
  if (safePage === page.value) return;
  page.value = safePage;
  await fetchHistory();
}

async function toggleHistoryExpanded() {
  historyExpanded.value = !historyExpanded.value;
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

async function openDetail(item) {
  detailOpen.value = true;
  detailLoading.value = true;
  detailError.value = '';
  detailItem.value = null;

  try {
    const data = await apiRequest(`/history/${item.record_source}/${item.id}`);
    detailItem.value = data?.row || null;
  } catch (error) {
    detailError.value = error.message || '加载详情失败';
  } finally {
    detailLoading.value = false;
  }
}

function closeDetail() {
  detailOpen.value = false;
  detailItem.value = null;
  detailError.value = '';
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

function openDeleteDialog(item) {
  deleteDialog.value = item;
}

function closeDeleteDialog() {
  deleteDialog.value = null;
}

async function submitDeleteHistory() {
  if (!deleteDialog.value) return;

  deletingHistory.value = true;
  try {
    await apiRequest(`/history/${deleteDialog.value.record_source}/${deleteDialog.value.id}`, {
      method: 'DELETE'
    });
    const deletedSource = deleteDialog.value.record_source;
    const deletedId = deleteDialog.value.id;
    closeDeleteDialog();
    if (detailItem.value && detailItem.value.id === deletedId && detailItem.value.record_source === deletedSource) {
      closeDetail();
    }
    if (page.value > 1 && historyRows.value.length === 1) {
      page.value -= 1;
    }
    await fetchHistory();
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.alert(error.message || '删除管理历史失败');
    }
  } finally {
    deletingHistory.value = false;
  }
}

function openBatchDeleteDialog() {
  batchDeleteDialogOpen.value = true;
}

function closeBatchDeleteDialog() {
  batchDeleteDialogOpen.value = false;
}

async function submitDeleteOlderHistory() {
  batchDeleting.value = true;
  try {
    await apiRequest('/history/delete-older-than', {
      method: 'POST',
      body: {
        days: 30
      }
    });
    closeBatchDeleteDialog();
    if (page.value > 1 && historyRows.value.length === 0) {
      page.value = 1;
    }
    await fetchHistory();
  } catch (error) {
    if (typeof window !== 'undefined') {
      window.alert(error.message || '删除旧管理历史失败');
    }
  } finally {
    batchDeleting.value = false;
  }
}

const welcomeResizeObserver = ref(null);

onMounted(() => {
  adjustWelcomeTextSize();
  if (showHistory.value) {
    fetchDashboardStats();
    fetchHistory();
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
  --history-toggle-shift-x: 30px;
  --history-toggle-shift-y: -12px;
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
  transform-origin: top center;
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
  transition: transform 0.24s ease, box-shadow 0.24s ease;
}

.dashboard-page.with-history .history-panel-single {
  flex: 1;
}

.dashboard-page.history-expanded .history-panel-single {
  transform: translateY(0px);
}

.history-panel-header {
  position: relative;
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

.history-expand-toggle {
  position: absolute;
  left: calc(50% - var(--history-toggle-shift-x));
  top: var(--history-toggle-shift-y);
  transform: translateX(-50%);
  border: none;
  background: transparent;
  box-shadow: none;
  min-width: 0;
  height: auto;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  line-height: 1;
  color: var(--theme-red-dark);
  cursor: pointer;
  transition: transform 0.22s ease, color 0.22s ease, opacity 0.22s ease;
}

.history-expand-icon {
  display: inline-block;
  transform-origin: center;
  transition: transform 0.22s ease;
}

.history-expand-icon.expanded {
  transform: scaleY(-1);
}

.history-expand-toggle:hover {
  color: var(--theme-red);
}

.history-expand-toggle:active {
  transform: translateX(-50%) scale(0.92);
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

.history-table-shell {
  scroll-behavior: smooth;
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
  padding-left: 12px;
  padding-right: 0;
}

.history-actions-header {
  text-align: center;
  padding-left: 12px;
  padding-right: 0;
}

.history-actions-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.history-actions-group .ghost,
.history-actions-group .danger {
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
  width: min(900px, calc(100vw - 48px));
  height: min(720px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
}

.history-detail-loading,
.history-detail-error,
.history-detail-empty {
  margin: auto 0;
}

.history-detail-scroll {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-right: 4px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-item,
.detail-payload-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.detail-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-muted);
}

.detail-value {
  color: var(--text-main);
  word-break: break-word;
}

.detail-section {
  border-top: 1px solid var(--border);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-section-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--theme-red-dark);
}

.detail-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(139, 0, 18, 0.08);
  color: var(--theme-red-dark);
  font-size: 12px;
}

.detail-payload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-json {
  margin: 0;
  padding: 10px;
  border-radius: 10px;
  background: #fff7f5;
  border: 1px solid rgba(139, 0, 18, 0.12);
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
  line-height: 1.45;
}

.dashboard-top-collapse-enter-active,
.dashboard-top-collapse-leave-active {
  transition: opacity 0.26s ease, transform 0.26s ease, max-height 0.26s ease, margin 0.26s ease;
  overflow: hidden;
}

.dashboard-top-collapse-enter-from,
.dashboard-top-collapse-leave-to {
  opacity: 0;
  transform: translateY(-16px) scaleY(0.96);
  max-height: 0;
}

.dashboard-top-collapse-enter-to,
.dashboard-top-collapse-leave-from {
  opacity: 1;
  transform: translateY(0) scaleY(1);
  max-height: 420px;
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

  .history-expand-toggle {
    position: static;
    transform: none;
    order: 3;
    font-size: 20px;
  }

  .history-header-side {
    width: 100%;
    margin-left: 0;
    justify-content: space-between;
  }

  .detail-grid,
  .detail-payload-grid {
    grid-template-columns: 1fr;
  }

  .history-actions-group {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
