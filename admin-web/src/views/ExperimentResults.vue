<template>
  <section class="card experiment-page">
    <div class="users-header">
      <div>
        <h2>实验结果分析</h2>
        <p class="muted">仅本地分析 CSV，不连接任何后端接口。</p>
      </div>
      <div class="toolbar upload-toolbar">
        <input
          ref="fileInputRef"
          class="upload-input"
          type="file"
          accept=".csv,text/csv"
          @change="handleFileUpload"
        />
        <button @click="openFilePicker">上传 CSV</button>
        <button class="ghost" :disabled="!entries.length" @click="clearEntries">清空缓存</button>
      </div>
    </div>

    <p class="hint">字段必须与 <code>prompt_matrix_1.csv</code> 完全一致（含顺序）。</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="success-message">{{ successMessage }}</p>

    <div class="entry-section">
      <h3>上传条目</h3>
      <div class="entry-accordion">
        <article
          v-for="entry in entries"
          :key="entry.id"
          class="accordion-item"
          :class="{ expanded: expandedEntryId === entry.id, selected: isViewerVisible && activeEntryId === entry.id }"
        >
          <button class="accordion-header" @click="toggleEntryAccordion(entry.id)">
            <div class="accordion-main">
              <span class="entry-file">{{ entry.fileName }}</span>
              <span class="accordion-sub muted">{{ formatDate(entry.uploadedAt) }}</span>
            </div>
            <div class="accordion-meta">
              <span class="tag">{{ entry.rowCount }} 行</span>
              <span class="accordion-arrow">{{ expandedEntryId === entry.id ? '−' : '+' }}</span>
            </div>
          </button>

          <div v-if="expandedEntryId === entry.id" class="accordion-body">
            <div class="accordion-actions">
              <button class="ghost" @click="openEntry(entry.id, 'detail')">查看详情</button>
              <button class="ghost" @click="openEntry(entry.id, 'analysis')">分析结果</button>
              <button class="danger" @click="removeEntry(entry.id)">删除</button>
            </div>
          </div>
        </article>

        <div v-if="!entries.length" class="empty">暂无上传记录，请先上传 CSV。</div>
      </div>
    </div>

    <div v-if="isViewerVisible && activeEntry" class="viewer">
      <div class="viewer-header">
        <div>
          <h3>{{ viewerMode === 'detail' ? '详情' : '分析结果' }}：{{ activeEntry.fileName }}</h3>
          <p class="muted" v-if="viewerMode === 'detail'">
            第 {{ detailRows.length ? currentRowIndex + 1 : 0 }} / {{ detailRows.length }} 行
          </p>
          <p class="muted" v-else>
            模型页 {{ modelStatsPages.length ? currentModelIndex + 1 : 0 }} / {{ modelStatsPages.length }}
          </p>
        </div>
        <div class="viewer-mode-switch">
          <button class="ghost mode-btn" :class="{ active: viewerMode === 'detail' }" @click="setViewerMode('detail')">查看详情</button>
          <button class="ghost mode-btn" :class="{ active: viewerMode === 'analysis' }" @click="setViewerMode('analysis')">分析结果</button>
        </div>
      </div>

      <div v-if="!activeRows.length" class="empty">该条目没有可展示的数据行。</div>

      <template v-else-if="viewerMode === 'detail'">
        <div class="detail-filter-bar">
          <label class="filter-checkbox">
            <input v-model="filterV1Failed" type="checkbox" @change="handleV1FilterChange" />
            V1 未通过
          </label>
          <label v-if="filterV1Failed" class="filter-checkbox">
            <input v-model="filterV2Failed" type="checkbox" />
            V2 未通过
          </label>
          <button class="ghost" :disabled="!hasDetailFilters" @click="clearDetailFilters">取消筛选</button>
          <span class="muted filter-summary">筛选后 {{ detailRows.length }} / {{ activeRows.length }} 行</span>
        </div>

        <div v-if="!detailRows.length" class="empty">当前筛选条件下没有符合的数据，点击“取消筛选”可查看全部。</div>

        <template v-else>
          <div class="row-nav">
            <button class="ghost" :disabled="!canPrevRow" @click="goPrevRow">上一行</button>
            <button class="ghost" :disabled="!canNextRow" @click="goNextRow">下一行</button>
          </div>

          <p class="row-meta muted">
            动词：{{ formatFieldValue(currentRow?.verb_infinitive) }} ｜ 时态：{{ formatFieldValue(currentRow?.conjugation_tense) }} ｜ 人称：{{ formatFieldValue(currentRow?.conjugation_person) }}
          </p>

          <div class="stage-tabs">
            <button
              v-for="(stage, index) in STAGES"
              :key="stage.key"
              class="stage-tab"
              :class="{ active: index === currentStageIndex }"
              @click="goToStage(index)"
            >
              {{ stage.title }}
            </button>
          </div>

          <div class="slider-wrapper">
            <button class="ghost slider-arrow" :disabled="!canPrevStage" @click="goPrevStage">◀</button>

            <div class="slider-viewport">
              <div class="slider-track" :style="sliderStyle">
                <section v-for="stage in STAGES" :key="stage.key" class="stage-pane">
                  <header class="stage-header">
                    <h4>{{ stage.title }}</h4>
                    <p class="muted">{{ stage.description }}</p>
                  </header>
                  <div class="stage-body">
                    <div class="detail-grid">
                      <div v-for="field in stage.fields" :key="field.key" class="detail-item">
                        <span class="detail-label">{{ field.label }}</span>
                        <pre class="field-value" :class="{ empty: isEmptyValue(currentRow?.[field.key]) }">{{ formatFieldValue(currentRow?.[field.key]) }}</pre>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <button class="ghost slider-arrow" :disabled="!canNextStage" @click="goNextStage">▶</button>
          </div>
        </template>
      </template>

      <template v-else>
        <div v-if="!modelStatsPages.length" class="empty">该条目没有可展示的模型分析结果。</div>
        <template v-else-if="activeModelStats">
          <div class="analysis-nav">
            <button class="ghost" :disabled="!canPrevModel" @click="goPrevModel">上一模型</button>
            <span>第 {{ currentModelIndex + 1 }} / {{ modelStatsPages.length }} 页</span>
            <button class="ghost" :disabled="!canNextModel" @click="goNextModel">下一模型</button>
          </div>

          <div class="analysis-heading">
            <h4>模型：{{ activeModelStats.model }}</h4>
            <p class="muted">按模型汇总当前 CSV 的通过率统计。</p>
          </div>

          <div class="stats-grid analysis-kpis">
            <article class="stat-card">
              <h3>生成题目总数</h3>
              <p class="stat-value">{{ activeModelStats.totalRows }}</p>
            </article>
            <article class="stat-card">
              <h3>Validator-1 通过率</h3>
              <p class="stat-value">{{ formatRate(activeModelStats.validator1PassRate) }}</p>
              <p class="muted">{{ activeModelStats.validator1PassCount }} / {{ activeModelStats.totalRows }}</p>
            </article>
            <article class="stat-card">
              <h3>Validator-2 通过率（不含 V1 已通过）</h3>
              <p class="stat-value">{{ formatRate(activeModelStats.validator2PassRate) }}</p>
              <p class="muted">{{ activeModelStats.validator2PassCount }} / {{ activeModelStats.validator2BaseCount }}</p>
            </article>
            <article class="stat-card">
              <h3>总通过率</h3>
              <p class="stat-value">{{ formatRate(activeModelStats.totalPassRate) }}</p>
              <p class="muted">{{ activeModelStats.totalPassCount }} / {{ activeModelStats.totalRows }}</p>
            </article>
          </div>

          <div class="analysis-table-wrap">
            <h4>各人称通过率</h4>
            <table class="table compact-table">
              <thead>
                <tr>
                  <th>人称</th>
                  <th>通过率</th>
                  <th>通过 / 总数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in activeModelStats.personRates" :key="item.name">
                  <td>{{ item.name }}</td>
                  <td>{{ formatRate(item.rate) }}</td>
                  <td>{{ item.pass }} / {{ item.total }}</td>
                </tr>
                <tr v-if="!activeModelStats.personRates.length">
                  <td colspan="3" class="empty">无人称数据</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="analysis-table-wrap">
            <h4>各时态通过率</h4>
            <table class="table compact-table">
              <thead>
                <tr>
                  <th>时态</th>
                  <th>通过率</th>
                  <th>通过 / 总数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in activeModelStats.tenseRates" :key="item.name">
                  <td>{{ item.name }}</td>
                  <td>{{ formatRate(item.rate) }}</td>
                  <td>{{ item.pass }} / {{ item.total }}</td>
                </tr>
                <tr v-if="!activeModelStats.tenseRates.length">
                  <td colspan="3" class="empty">无时态数据</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

const STORAGE_KEY = 'admin_experiment_results_v1';

const REQUIRED_HEADERS = [
  'verb_infinitive',
  'verb_meaning',
  'conjugation_mood',
  'conjugation_tense',
  'conjugation_person',
  'conjugation_form',
  'question_sentence',
  'question_answer',
  'question_translation',
  'question_hint',
  'question_error',
  'revised_sentence',
  'revisor_reason',
  'revised_question_error',
  'generator_prompt_index',
  'generator_model',
  'generator_temperature',
  'validator_used',
  'validator_prompt_index',
  'revisor_used',
  'revisor_prompt_index',
  'revisor_temperature',
  'validator_1_is_valid',
  'validator_1_has_unique_answer',
  'validator_1_reason',
  'validator_1_rewrite_advice',
  'validator_2_is_valid',
  'validator_2_has_unique_answer',
  'validator_2_reason',
  'validator_2_rewrite_advice',
  'validator_is_valid',
  'validator_has_unique_answer',
  'validator_reason',
  'validator_rewrite_advice'
];

const FIELD_LABELS = {
  verb_infinitive: '动词原形',
  verb_meaning: '动词释义',
  conjugation_mood: '变位语气',
  conjugation_tense: '变位时态',
  conjugation_person: '变位人称',
  conjugation_form: '目标变位',
  question_sentence: '题干句子',
  question_answer: '题目答案',
  question_translation: '中文翻译',
  question_hint: '提示',
  question_error: '生成错误',
  revised_sentence: '重写句子',
  revisor_reason: '重写理由',
  revised_question_error: '重写错误',
  generator_prompt_index: 'Generator Prompt 序号',
  generator_model: 'Generator 模型',
  generator_temperature: 'Generator 温度',
  validator_used: '是否启用 Validator',
  validator_prompt_index: 'Validator Prompt 序号',
  revisor_used: '是否启用 Revisor',
  revisor_prompt_index: 'Revisor Prompt 序号',
  revisor_temperature: 'Revisor 温度',
  validator_1_is_valid: 'Validator-1 是否有效',
  validator_1_has_unique_answer: 'Validator-1 是否唯一解',
  validator_1_reason: 'Validator-1 原因',
  validator_1_rewrite_advice: 'Validator-1 重写建议',
  validator_2_is_valid: 'Validator-2 是否有效',
  validator_2_has_unique_answer: 'Validator-2 是否唯一解',
  validator_2_reason: 'Validator-2 原因',
  validator_2_rewrite_advice: 'Validator-2 重写建议',
  validator_is_valid: '最终校验是否有效',
  validator_has_unique_answer: '最终校验是否唯一解',
  validator_reason: '最终校验原因',
  validator_rewrite_advice: '最终校验建议'
};

const STAGES = [
  {
    key: 'generator',
    title: 'Generator 输出',
    description: '题目生成与基础上下文字段',
    fields: [
      'verb_infinitive',
      'verb_meaning',
      'conjugation_mood',
      'conjugation_tense',
      'conjugation_person',
      'conjugation_form',
      'question_sentence',
      'question_answer',
      'question_translation',
      'question_hint',
      'question_error',
      'generator_prompt_index',
      'generator_model',
      'generator_temperature'
    ]
  },
  {
    key: 'validator_1',
    title: 'Validator-1 输出',
    description: '第一轮校验结果',
    fields: [
      'validator_used',
      'validator_prompt_index',
      'validator_1_is_valid',
      'validator_1_has_unique_answer',
      'validator_1_reason',
      'validator_1_rewrite_advice'
    ]
  },
  {
    key: 'revisor',
    title: 'Revisor 输出',
    description: '重写与修正结果',
    fields: [
      'revisor_used',
      'revisor_prompt_index',
      'revisor_temperature',
      'revised_sentence',
      'revisor_reason',
      'revised_question_error'
    ]
  },
  {
    key: 'validator_2',
    title: 'Validator-2 输出',
    description: '第二轮校验与最终结论',
    fields: [
      'validator_2_is_valid',
      'validator_2_has_unique_answer',
      'validator_2_reason',
      'validator_2_rewrite_advice',
      'validator_is_valid',
      'validator_has_unique_answer',
      'validator_reason',
      'validator_rewrite_advice'
    ]
  }
].map((stage) => ({
  ...stage,
  fields: stage.fields.map((fieldKey) => ({
    key: fieldKey,
    label: FIELD_LABELS[fieldKey] || fieldKey
  }))
}));

const fileInputRef = ref(null);
const entries = ref(loadEntries());
const activeEntryId = ref('');
const expandedEntryId = ref('');
const isViewerVisible = ref(false);
const viewerMode = ref('detail');
const filterV1Failed = ref(false);
const filterV2Failed = ref(false);
const currentRowIndex = ref(0);
const currentStageIndex = ref(0);
const currentModelIndex = ref(0);
const errorMessage = ref('');
const successMessage = ref('');

const activeEntry = computed(() => entries.value.find((item) => item.id === activeEntryId.value) || null);
const activeRows = computed(() => Array.isArray(activeEntry.value?.rows) ? activeEntry.value.rows : []);
const detailRows = computed(() => {
  if (!activeRows.value.length) return [];
  if (!filterV1Failed.value) return activeRows.value;
  return activeRows.value.filter((row) => {
    if (isValidatorPass(row, 'validator_1')) return false;
    if (filterV2Failed.value && isValidatorPass(row, 'validator_2')) return false;
    return true;
  });
});
const currentRow = computed(() => detailRows.value[currentRowIndex.value] || null);
const modelStatsPages = computed(() => buildModelStats(activeRows.value));
const activeModelStats = computed(() => modelStatsPages.value[currentModelIndex.value] || null);
const hasDetailFilters = computed(() => filterV1Failed.value || filterV2Failed.value);

const canPrevRow = computed(() => currentRowIndex.value > 0);
const canNextRow = computed(() => currentRowIndex.value < detailRows.value.length - 1);
const canPrevStage = computed(() => currentStageIndex.value > 0);
const canNextStage = computed(() => currentStageIndex.value < STAGES.length - 1);
const canPrevModel = computed(() => currentModelIndex.value > 0);
const canNextModel = computed(() => currentModelIndex.value < modelStatsPages.value.length - 1);

const sliderStyle = computed(() => ({
  transform: `translateX(-${currentStageIndex.value * 100}%)`
}));

watch(
  detailRows,
  (rows) => {
    if (!rows.length) {
      currentRowIndex.value = 0;
      return;
    }
    if (currentRowIndex.value > rows.length - 1) {
      currentRowIndex.value = rows.length - 1;
    }
  },
  { immediate: true }
);

watch([filterV1Failed, filterV2Failed], () => {
  currentRowIndex.value = 0;
});

watch(filterV1Failed, (enabled) => {
  if (!enabled) {
    filterV2Failed.value = false;
  }
});

watch(
  modelStatsPages,
  (pages) => {
    if (!pages.length) {
      currentModelIndex.value = 0;
      return;
    }
    if (currentModelIndex.value > pages.length - 1) {
      currentModelIndex.value = pages.length - 1;
    }
  },
  { immediate: true }
);

function loadEntries() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (!Array.isArray(entry.rows)) return null;
  const normalizedRows = entry.rows.map((row) => {
    const mapped = {};
    REQUIRED_HEADERS.forEach((header) => {
      mapped[header] = row?.[header] ?? '';
    });
    return mapped;
  });
  return {
    id: String(entry.id || ''),
    fileName: String(entry.fileName || 'unknown.csv'),
    uploadedAt: String(entry.uploadedAt || ''),
    rowCount: Number(entry.rowCount ?? normalizedRows.length) || normalizedRows.length,
    rows: normalizedRows
  };
}

function persistEntries(nextEntries) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
    return true;
  } catch (error) {
    errorMessage.value = '写入浏览器缓存失败，可能是本地存储空间不足。';
    return false;
  }
}

function openFilePicker() {
  fileInputRef.value?.click();
}

async function handleFileUpload(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  resetMessages();

  try {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (!parsed.length) {
      throw new Error('CSV 为空，无法导入。');
    }

    const headers = parsed[0].map((value, index) => {
      const textValue = String(value ?? '');
      if (index === 0 && textValue.charCodeAt(0) === 0xfeff) {
        return textValue.slice(1).trim();
      }
      return textValue.trim();
    });

    const headerError = validateHeaders(headers);
    if (headerError) {
      throw new Error(headerError);
    }

    const rows = parsed
      .slice(1)
      .filter(hasAnyCellValue)
      .map((row) => mapRowToObject(headers, row));

    const nextEntry = {
      id: createEntryId(),
      fileName: file.name || 'uploaded.csv',
      uploadedAt: new Date().toISOString(),
      rowCount: rows.length,
      rows
    };

    const nextEntries = [nextEntry, ...entries.value];
    if (!persistEntries(nextEntries)) return;

    entries.value = nextEntries;
    expandedEntryId.value = nextEntry.id;
    isViewerVisible.value = false;
    successMessage.value = `导入成功：${nextEntry.fileName}（${rows.length} 行）`;
  } catch (error) {
    errorMessage.value = error?.message || '导入失败，请检查文件格式。';
  } finally {
    if (event?.target) {
      event.target.value = '';
    }
  }
}

function createEntryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function validateHeaders(headers) {
  if (headers.length !== REQUIRED_HEADERS.length) {
    return `CSV 字段数量不匹配：期望 ${REQUIRED_HEADERS.length} 列，实际 ${headers.length} 列。`;
  }
  const mismatchIndex = REQUIRED_HEADERS.findIndex((field, index) => headers[index] !== field);
  if (mismatchIndex !== -1) {
    return `CSV 字段不匹配：第 ${mismatchIndex + 1} 列应为 "${REQUIRED_HEADERS[mismatchIndex]}"，实际为 "${headers[mismatchIndex] || ''}"。`;
  }
  return '';
}

function mapRowToObject(headers, row) {
  const mapped = {};
  headers.forEach((header, index) => {
    mapped[header] = row[index] ?? '';
  });
  return mapped;
}

function hasAnyCellValue(row) {
  return row.some((cell) => String(cell ?? '').trim() !== '');
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      if (!cell) {
        inQuotes = true;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (char === '\r') {
      if (content[i + 1] !== '\n') {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      }
      continue;
    }
    cell += char;
  }

  if (inQuotes) {
    throw new Error('CSV 格式错误：存在未闭合的双引号。');
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  while (rows.length && rows[rows.length - 1].every((value) => String(value ?? '').trim() === '')) {
    rows.pop();
  }

  return rows;
}

function buildModelStats(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const modelMap = new Map();

  rows.forEach((row) => {
    const model = normalizeDimension(row?.generator_model, '未标注模型');
    const modelRows = modelMap.get(model) || [];
    modelRows.push(row);
    modelMap.set(model, modelRows);
  });

  return Array.from(modelMap.entries())
    .map(([model, modelRows]) => buildSingleModelStats(model, modelRows))
    .sort((a, b) => {
      if (b.totalRows !== a.totalRows) return b.totalRows - a.totalRows;
      return a.model.localeCompare(b.model, 'zh-Hans-CN');
    });
}

function buildSingleModelStats(model, rows) {
  let validator1PassCount = 0;
  let validator2BaseCount = 0;
  let validator2PassCount = 0;
  let totalPassCount = 0;
  const personMap = new Map();
  const tenseMap = new Map();

  rows.forEach((row) => {
    const validator1Pass = isValidatorPass(row, 'validator_1');
    const validator2Pass = isValidatorPass(row, 'validator_2');
    const finalPass = validator1Pass || (!validator1Pass && validator2Pass);

    if (validator1Pass) {
      validator1PassCount += 1;
    } else {
      validator2BaseCount += 1;
      if (validator2Pass) {
        validator2PassCount += 1;
      }
    }
    if (finalPass) {
      totalPassCount += 1;
    }

    accumulateDimension(personMap, normalizeDimension(row?.conjugation_person, '未标注人称'), finalPass);
    accumulateDimension(tenseMap, normalizeDimension(row?.conjugation_tense, '未标注时态'), finalPass);
  });

  return {
    model,
    totalRows: rows.length,
    validator1PassCount,
    validator1PassRate: calcRate(validator1PassCount, rows.length),
    validator2BaseCount,
    validator2PassCount,
    validator2PassRate: calcRate(validator2PassCount, validator2BaseCount),
    totalPassCount,
    totalPassRate: calcRate(totalPassCount, rows.length),
    personRates: toDimensionRates(personMap),
    tenseRates: toDimensionRates(tenseMap)
  };
}

function isValidatorPass(row, prefix) {
  return parseBoolean(row?.[`${prefix}_is_valid`]) && parseBoolean(row?.[`${prefix}_has_unique_answer`]);
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function accumulateDimension(map, key, passed) {
  const current = map.get(key) || { total: 0, pass: 0 };
  current.total += 1;
  if (passed) {
    current.pass += 1;
  }
  map.set(key, current);
}

function toDimensionRates(map) {
  return Array.from(map.entries())
    .map(([name, stats]) => ({
      name,
      total: stats.total,
      pass: stats.pass,
      rate: calcRate(stats.pass, stats.total)
    }))
    .sort((a, b) => {
      const rateA = a.rate ?? Number.POSITIVE_INFINITY;
      const rateB = b.rate ?? Number.POSITIVE_INFINITY;
      if (rateA !== rateB) return rateA - rateB;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
}

function calcRate(numerator, denominator) {
  if (!denominator) return null;
  return numerator / denominator;
}

function normalizeDimension(value, fallback) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function toggleEntryAccordion(id) {
  expandedEntryId.value = expandedEntryId.value === id ? '' : id;
}

function openEntry(id, mode = 'detail') {
  activeEntryId.value = id;
  expandedEntryId.value = id;
  isViewerVisible.value = true;
  viewerMode.value = mode;
  currentRowIndex.value = 0;
  currentStageIndex.value = 0;
  currentModelIndex.value = 0;
  resetMessages();
}

function removeEntry(id) {
  if (!window.confirm('确认删除该上传条目吗？')) return;
  const nextEntries = entries.value.filter((item) => item.id !== id);
  if (!persistEntries(nextEntries)) return;
  entries.value = nextEntries;

  if (activeEntryId.value === id) {
    activeEntryId.value = '';
    isViewerVisible.value = false;
    viewerMode.value = 'detail';
    currentRowIndex.value = 0;
    currentStageIndex.value = 0;
    currentModelIndex.value = 0;
  }
  if (expandedEntryId.value === id) {
    expandedEntryId.value = '';
  }
}

function clearEntries() {
  if (!entries.value.length) return;
  if (!window.confirm('确认清空所有实验结果缓存吗？')) return;
  if (!persistEntries([])) return;
  entries.value = [];
  activeEntryId.value = '';
  expandedEntryId.value = '';
  isViewerVisible.value = false;
  viewerMode.value = 'detail';
  currentRowIndex.value = 0;
  currentStageIndex.value = 0;
  currentModelIndex.value = 0;
  resetMessages();
}

function goPrevRow() {
  if (!canPrevRow.value) return;
  currentRowIndex.value -= 1;
}

function goNextRow() {
  if (!canNextRow.value) return;
  currentRowIndex.value += 1;
}

function goToStage(index) {
  currentStageIndex.value = Math.min(Math.max(index, 0), STAGES.length - 1);
}

function goPrevStage() {
  if (!canPrevStage.value) return;
  currentStageIndex.value -= 1;
}

function goNextStage() {
  if (!canNextStage.value) return;
  currentStageIndex.value += 1;
}

function handleV1FilterChange() {
  if (!filterV1Failed.value) {
    filterV2Failed.value = false;
  }
}

function clearDetailFilters() {
  filterV1Failed.value = false;
  filterV2Failed.value = false;
}

function setViewerMode(mode) {
  viewerMode.value = mode === 'analysis' ? 'analysis' : 'detail';
  if (viewerMode.value === 'analysis') {
    currentModelIndex.value = 0;
  }
}

function goPrevModel() {
  if (!canPrevModel.value) return;
  currentModelIndex.value -= 1;
}

function goNextModel() {
  if (!canNextModel.value) return;
  currentModelIndex.value += 1;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatFieldValue(value) {
  if (isEmptyValue(value)) return '—';
  return String(value);
}

function formatRate(rate) {
  if (rate === null || rate === undefined) return '-';
  return `${(rate * 100).toFixed(2)}%`;
}

function isEmptyValue(value) {
  return value === null || value === undefined || String(value).trim() === '';
}

function resetMessages() {
  errorMessage.value = '';
  successMessage.value = '';
}
</script>

<style scoped>
.experiment-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.upload-toolbar {
  justify-content: flex-end;
}

.upload-input {
  display: none;
}

.success-message {
  margin: 0;
  color: #166534;
  font-weight: 600;
}

.entry-section h3 {
  margin: 0 0 10px;
}

.entry-accordion {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.accordion-item {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
}

.accordion-item.selected {
  border-color: #93c5fd;
  box-shadow: 0 0 0 2px rgba(147, 197, 253, 0.25);
}

.accordion-header {
  width: 100%;
  border: none;
  background: #ffffff;
  color: var(--text);
  border-radius: 0;
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  text-align: left;
}

.accordion-header:hover {
  transform: none;
  box-shadow: none;
  background: #f8fafc;
}

.accordion-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.accordion-sub {
  font-size: 13px;
}

.accordion-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.accordion-arrow {
  width: 16px;
  font-size: 18px;
  font-weight: 700;
  color: var(--muted);
  text-align: center;
}

.accordion-body {
  border-top: 1px solid var(--border);
  background: #f8fafc;
  padding: 12px 14px 14px;
}

.accordion-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.entry-file {
  font-weight: 600;
  max-width: 360px;
  word-break: break-all;
}

.viewer {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: #f8fafc;
}

.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.viewer-header h3 {
  margin: 0 0 4px;
}

.viewer-header p {
  margin: 0;
}

.viewer-mode-switch {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mode-btn.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
}

.row-nav {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 8px 0 10px;
}

.detail-filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 8px 0 10px;
}

.filter-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--text);
}

.filter-checkbox input {
  margin: 0;
}

.filter-summary {
  margin-left: auto;
  font-size: 13px;
}

.row-meta {
  margin: 2px 0 12px;
  font-size: 13px;
}

.stage-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.stage-tab {
  background: white;
  border: 1px solid var(--border);
  color: var(--text);
}

.stage-tab.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.slider-wrapper {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 10px;
}

.slider-arrow {
  width: 44px;
  height: 44px;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 0;
}

.slider-viewport {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: white;
}

.slider-track {
  display: flex;
  transition: transform 0.24s ease;
  width: 100%;
}

.stage-pane {
  flex: 0 0 100%;
  min-height: 560px;
  max-height: 560px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stage-header h4 {
  margin: 0;
}

.stage-header p {
  margin: 4px 0 0;
}

.stage-body {
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-label {
  font-size: 13px;
  font-weight: 700;
}

.field-value {
  margin: 0;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #f8fafc;
  padding: 10px;
  min-height: 72px;
  max-height: 180px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  font-family: inherit;
}

.field-value.empty {
  color: var(--muted);
}

.analysis-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin: 12px 0;
}

.analysis-heading h4 {
  margin: 0;
}

.analysis-heading p {
  margin: 6px 0 0;
}

.analysis-kpis {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 6px;
}

.analysis-kpis .stat-card {
  padding: 10px;
  border-radius: 10px;
}

.analysis-kpis .stat-card h3 {
  margin: 0 0 4px;
  font-size: 12px;
}

.analysis-kpis .stat-value {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
}

.analysis-kpis .muted {
  margin-top: 2px;
  font-size: 12px;
}

.analysis-table-wrap {
  margin-top: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #ffffff;
  padding: 12px;
  max-height: 320px;
  overflow: auto;
}

.analysis-table-wrap h4 {
  margin: 0 0 10px;
}

@media (max-width: 960px) {
  .slider-wrapper {
    grid-template-columns: 1fr;
  }

  .slider-arrow {
    justify-self: center;
  }

  .stage-pane {
    min-height: 520px;
    max-height: 520px;
  }
}
</style>
