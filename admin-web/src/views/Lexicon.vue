<template>
  <Teleport v-if="isDev" to=".topbar-left-actions">
    <button
      class="ghost lexicon-download-button"
      :disabled="downloadingAll"
      @click="downloadAllVerbsJson"
    >
      下载词库JSON
    </button>
  </Teleport>

  <section class="card lexicon-page">
    <div class="header-row">
      <div class="header-copy">
        <h2>词库条目管理</h2>
      </div>
      <div class="toolbar">
        <div class="toolbar-left">
          <input v-model.trim="keyword" placeholder="搜索动词/释义/ID" />
          <button class="ghost" @click="toggleIdOrder" :disabled="loading">
            {{ idOrder === 'asc' ? '倒序查看' : '顺序查看' }}
          </button>
          <button class="ghost" @click="refresh" :disabled="loading">刷新</button>
        </div>
        <div class="toolbar-right">
          <div class="pagination inline-pagination">
            <span class="muted pagination-total">共 {{ total }} 条</span>
            <template v-if="total > pageSize">
              <button class="ghost" :disabled="page === 1 || loading" @click="changePage(page - 1)">上一页</button>
              <label class="pagination-jump" for="lexicon-page-jump">
                第
                <input
                  id="lexicon-page-jump"
                  v-model.number="pageJump"
                  class="page-jump-input page-number-input"
                  type="number"
                  min="1"
                  :max="totalPages"
                  @keydown.enter.prevent="jumpToPage"
                  @blur="jumpToPage"
                />
                / {{ totalPages }} 页
              </label>
              <button class="ghost" :disabled="page === totalPages || loading" @click="changePage(page + 1)">下一页</button>
            </template>
          </div>
          <button @click="openCreate">新建条目</button>
        </div>
      </div>
    </div>

    <div class="lexicon-body">
      <div v-if="error" class="error-block">
        <p class="error">{{ error }}</p>
        <button class="ghost" @click="refresh">重试</button>
      </div>
      <div v-else-if="loading" class="loading">加载中...</div>
      <div v-else class="table-scroll">
        <div v-if="filteredRows.length" class="lexicon-entry-grid">
          <article v-for="item in filteredRows" :key="item.id" class="lexicon-entry-card">
            <div class="lexicon-entry-main">
              <div class="lexicon-entry-meta">
                <div class="lexicon-entry-title">
                  <span class="lexicon-entry-id">ID {{ item.id }}</span>
                  <span class="lexicon-entry-verb">{{ item.infinitive }}</span>
                </div>
                <div class="lexicon-entry-actions">
                  <button class="ghost" @click="openEdit(item)">编辑</button>
                  <button class="ghost" @click="openConjugations(item)">变位</button>
                  <button class="danger" @click="confirmDelete(item)">删除</button>
                </div>
              </div>
              <p class="lexicon-entry-meaning">{{ item.meaning || '-' }}</p>
            </div>
          </article>
        </div>
        <div v-else class="empty">暂无条目</div>
      </div>
    </div>

    <div v-if="drawerOpen" class="overlay">
      <div class="drawer lexicon-edit-drawer">
        <header>
          <h3>{{ editingId ? '编辑动词' : '新建动词' }}</h3>
          <div class="drawer-header-actions">
            <span
              v-if="isCreateMode && createDrawerView !== 'queue' && activeQueueItem"
              class="drawer-current-item"
            >
              当前词条：{{ form.infinitive || activeQueueItem.infinitive }}
            </span>
            <button
              v-if="!isCreateMode || createDrawerView !== 'queue'"
              type="submit"
              form="lexicon-edit-form"
              :disabled="saving"
            >
              {{ isCreateMode ? '保存到队列' : '保存' }}
            </button>
            <button
              v-if="isCreateMode && createDrawerView !== 'queue'"
              class="ghost"
              @click="switchCreateDrawerView('queue')"
            >
              返回队列
            </button>
            <button v-else class="ghost" @click="closeDrawer">关闭</button>
          </div>
        </header>
        <div class="drawer-body">
          <div
            v-if="isCreateMode && createDrawerView !== 'queue'"
            class="drawer-view-switch"
            role="tablist"
            aria-label="新建动词内容切换"
          >
            <div class="drawer-view-switch-buttons">
              <button
                type="button"
                class="ghost"
                :class="{ active: createDrawerView === 'details' }"
                @click="switchCreateDrawerView('details')"
              >
                编辑字段
              </button>
              <button
                type="button"
                class="ghost"
                :class="{ active: createDrawerView === 'conjugations' }"
                @click="switchCreateDrawerView('conjugations')"
              >
                变位字段
              </button>
            </div>
          </div>

          <form id="lexicon-edit-form" @submit.prevent="submitSave">
            <template v-if="isCreateMode && createDrawerView === 'queue'">
              <div class="queue-panel">
                <div class="queue-input-row">
                  <input
                    v-model.trim="queueInput"
                    class="queue-input"
                    placeholder="输入动词原型词干（逐条添加）"
                    @keydown.enter.prevent="addQueueInfinitive"
                  />
                  <button type="button" class="ghost" @click="addQueueInfinitive" :disabled="queueProcessing || queueSaving">
                    添加
                  </button>
                  <button type="button" :disabled="queueProcessing || queueSaving || !queueItems.length" @click="runQueueGenerate">
                    {{ queueProcessing ? '生成中...' : '一键生成' }}
                  </button>
                  <button
                    type="button"
                    class="drawer-auto-fill-btn"
                    :disabled="queueSaving || queueProcessing || !queueSuccessItems.length"
                    @click="saveQueueSuccessItems"
                  >
                    {{ queueSaving ? '保存中...' : '一键保存成功项' }}
                  </button>
                </div>

                <p class="queue-hint">
                  仅需录入动词原形，系统将逐条自动生成变位信息并反馈结果。AI生成可能存在错误，请核实相关信息。完成后点击按钮保存完整的词条。
                </p>

                <div class="queue-table-wrap">
                  <table class="table queue-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>原形</th>
                        <th>状态</th>
                        <th>反馈</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(item, index) in queueItems" :key="item.id">
                        <td>{{ index + 1 }}</td>
                        <td>{{ item.infinitive }}</td>
                        <td>
                          <span class="queue-status" :class="`queue-status-${item.status}`">
                            {{ getQueueStatusLabel(item.status) }}
                          </span>
                        </td>
                        <td class="queue-message">{{ item.message || '-' }}</td>
                        <td class="actions queue-actions-cell">
                          <button
                            type="button"
                            class="ghost queue-action-btn"
                            :disabled="!canOpenQueueDetail(item)"
                            @click="openQueueDetail(item.id)"
                          >
                            详情
                          </button>
                          <button
                            type="button"
                            class="danger queue-action-btn"
                            :disabled="queueProcessing || queueSaving"
                            @click="requestRemoveQueueItem(item)"
                          >
                            移除
                          </button>
                        </td>
                      </tr>
                      <tr v-if="!queueItems.length">
                        <td colspan="5" class="empty">队列为空，请先添加动词原形</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
            <template v-else-if="!isCreateMode || createDrawerView === 'details'">
              <template v-if="!isCreateMode || activeQueueItem">
                <div class="drawer-inline-row drawer-field-row">
                  <label class="drawer-field drawer-id-field">
                    动词ID
                    <input :value="editingId || '自动生成'" disabled />
                  </label>

                  <label class="drawer-field">
                    原形
                    <input v-model="form.infinitive" placeholder="仅输入动词原型词干" />
                    <span v-if="formErrors.infinitive" class="field-error">{{ formErrors.infinitive }}</span>
                  </label>
                </div>

                <div class="drawer-inline-row drawer-field-row">
                  <label class="drawer-field">
                    释义
                    <input v-model="form.meaning" />
                    <span v-if="formErrors.meaning" class="field-error">{{ formErrors.meaning }}</span>
                  </label>

                  <label class="drawer-field">
                    副动词
                    <input v-model="form.gerund" />
                    <span v-if="formErrors.gerund" class="field-error">{{ formErrors.gerund }}</span>
                  </label>
                </div>

                <div class="drawer-inline-row drawer-field-row">
                  <label class="drawer-field">
                    过去分词
                    <input v-model="form.participle" />
                    <span v-if="formErrors.participle" class="field-error">{{ formErrors.participle }}</span>
                  </label>

                  <label class="drawer-field">
                    过去分词其它形式
                    <input v-model="form.participle_forms" />
                    <span v-if="formErrors.participle_forms" class="field-error">{{ formErrors.participle_forms }}</span>
                  </label>
                </div>

                <div class="drawer-flags-wrap">
                  <div class="drawer-flags-row drawer-flags-row-four">
                    <label class="drawer-flag-chip">
                      <span class="drawer-flag-label">Irreg. 不规则</span>
                      <span class="drawer-flag-control">
                        <input class="drawer-flag-input" type="checkbox" v-model="form.is_irregular" />
                        <span class="drawer-flag-switch" aria-hidden="true"></span>
                      </span>
                    </label>

                    <label class="drawer-flag-chip">
                      <span class="drawer-flag-label">Prnl. 自反</span>
                      <span class="drawer-flag-control">
                        <input class="drawer-flag-input" type="checkbox" v-model="form.is_reflexive" />
                        <span class="drawer-flag-switch" aria-hidden="true"></span>
                      </span>
                    </label>

                    <label class="drawer-flag-chip">
                      <span class="drawer-flag-label">tr. 及物用法</span>
                      <span class="drawer-flag-control">
                        <input class="drawer-flag-input" type="checkbox" v-model="form.has_tr_use" />
                        <span class="drawer-flag-switch" aria-hidden="true"></span>
                      </span>
                    </label>

                    <label class="drawer-flag-chip">
                      <span class="drawer-flag-label">intr. 不及物用法</span>
                      <span class="drawer-flag-control">
                        <input class="drawer-flag-input" type="checkbox" v-model="form.has_intr_use" />
                        <span class="drawer-flag-switch" aria-hidden="true"></span>
                      </span>
                    </label>
                  </div>

                  <div v-if="form.has_tr_use" class="drawer-flags-row drawer-flags-row-three">
                    <label class="drawer-flag-chip">
                      <span class="drawer-flag-label">动词+DO</span>
                      <span class="drawer-flag-control">
                        <input class="drawer-flag-input" type="checkbox" v-model="form.supports_do" />
                        <span class="drawer-flag-switch" aria-hidden="true"></span>
                      </span>
                    </label>

                    <label class="drawer-flag-chip">
                      <span class="drawer-flag-label">动词+IO</span>
                      <span class="drawer-flag-control">
                        <input class="drawer-flag-input" type="checkbox" v-model="form.supports_io" />
                        <span class="drawer-flag-switch" aria-hidden="true"></span>
                      </span>
                    </label>

                    <label class="drawer-flag-chip">
                      <span class="drawer-flag-label">动词+IO+DO</span>
                      <span class="drawer-flag-control">
                        <input class="drawer-flag-input" type="checkbox" v-model="form.supports_do_io" />
                        <span class="drawer-flag-switch" aria-hidden="true"></span>
                      </span>
                    </label>
                  </div>
                </div>
              </template>
            </template>

            <template v-else>
              <p class="drawer-tip">请检查词条各时态、人称的变位信息。</p>
              <div v-if="!isCreateMode || activeQueueItem" class="conj-list create-conj-list">
                <div class="conj-groups">
                  <section
                    v-for="group in createConjugationSections"
                    :key="`create-${group.moodKey}`"
                    class="conj-group"
                  >
                    <button type="button" class="conj-group-header" @click="toggleCreateConjMood(group.moodKey)">
                      <span class="conj-group-title">{{ getConjMoodName(group.moodKey) }}</span>
                      <span class="conj-group-meta">{{ group.tenses.length }} 项 {{ isCreateConjMoodExpanded(group.moodKey) ? '▼' : '▶' }}</span>
                    </button>

                    <div v-if="isCreateConjMoodExpanded(group.moodKey)" class="conj-tense-list">
                      <section
                        v-for="tense in group.tenses"
                        :key="`create-${group.moodKey}-${tense.tenseKey}`"
                        class="conj-tense-card"
                      >
                        <button
                          type="button"
                          class="conj-tense-header"
                          @click="toggleCreateConjTense(group.moodKey, tense.tenseKey)"
                        >
                          <span class="conj-tense-title">
                            <span class="conj-tense-es">{{ tense.display.es }}</span>
                            <span class="conj-tense-cn">（{{ tense.display.cn }}）</span>
                          </span>
                          <span class="conj-group-meta">{{ tense.rows.length }} 项 {{ isCreateConjTenseExpanded(group.moodKey, tense.tenseKey) ? '▼' : '▶' }}</span>
                        </button>

                        <div v-if="isCreateConjTenseExpanded(group.moodKey, tense.tenseKey)" class="conj-row-list">
                          <template v-for="row in tense.rows" :key="row.key">
                            <div v-if="row.isVos" class="conj-vos-divider">
                              <span class="conj-divider-line"></span>
                              <span class="conj-divider-text">特殊变位</span>
                              <span class="conj-divider-line"></span>
                            </div>

                            <div class="conj-row conj-row-create">
                              <div class="conj-row-person">{{ getConjPersonLabel(row.person) }}</div>
                              <div class="conj-row-value">
                                <input
                                  v-model="row.draft.conjugated_form"
                                  class="conj-inline-input"
                                  type="text"
                                  placeholder="输入变位形式"
                                />
                              </div>
                              <div class="conj-row-flag">
                                <span class="conj-row-flag-label">不规则：</span>
                                <input class="conj-row-checkbox" type="checkbox" v-model="row.draft.is_irregular" />
                              </div>
                            </div>
                          </template>
                        </div>
                      </section>
                    </div>
                  </section>
                </div>
              </div>
            </template>
          </form>
        </div>
      </div>
    </div>

    <!-- 变位抽屉 -->
    <div v-if="conjDrawerOpen" class="overlay">
      <div class="drawer">
        <header>
          <h3>动词：{{ activeVerb?.infinitive || '' }} 的变位</h3>
          <button class="ghost" @click="closeConjDrawer">关闭</button>
        </header>
        <div class="drawer-body">
          <div class="conj-list">
            <div v-if="groupedConjugationSections.length" class="conj-groups">
              <section
                v-for="group in groupedConjugationSections"
                :key="group.moodKey"
                class="conj-group"
              >
                <button type="button" class="conj-group-header" @click="toggleConjMood(group.moodKey)">
                  <span class="conj-group-title">{{ getConjMoodName(group.moodKey) }}</span>
                  <span class="conj-group-meta">{{ group.tenses.length }} 项 {{ isConjMoodExpanded(group.moodKey) ? '▼' : '▶' }}</span>
                </button>

                <div v-if="isConjMoodExpanded(group.moodKey)" class="conj-tense-list">
                  <section
                    v-for="tense in group.tenses"
                    :key="`${group.moodKey}-${tense.tenseKey}`"
                    class="conj-tense-card"
                  >
                    <button
                      type="button"
                      class="conj-tense-header"
                      @click="toggleConjTense(group.moodKey, tense.tenseKey)"
                    >
                      <span class="conj-tense-title">
                        <span class="conj-tense-es">{{ tense.display.es }}</span>
                        <span class="conj-tense-cn">（{{ tense.display.cn }}）</span>
                      </span>
                      <span class="conj-group-meta">{{ tense.rows.length }} 项 {{ isConjTenseExpanded(group.moodKey, tense.tenseKey) ? '▼' : '▶' }}</span>
                    </button>

                    <div v-if="isConjTenseExpanded(group.moodKey, tense.tenseKey)" class="conj-row-list">
                      <template v-for="row in tense.rows" :key="`${group.moodKey}-${tense.tenseKey}-${row.person}`">
                        <div v-if="row.isVos" class="conj-vos-divider">
                          <span class="conj-divider-line"></span>
                          <span class="conj-divider-text">特殊变位</span>
                          <span class="conj-divider-line"></span>
                        </div>

                        <div class="conj-row" :class="{ 'conj-row-empty': !row.record, 'conj-row-vos': row.isVos }">
                          <div class="conj-row-person">{{ getConjPersonLabel(row.person) }}</div>
                          <div class="conj-row-value">
                            <input
                              v-if="isConjRowEditing(row)"
                              v-model="activeConjDraft"
                              class="conj-inline-input"
                              type="text"
                              placeholder="输入变位形式"
                            />
                            <span v-else>{{ row.record?.conjugated_form || '未填写' }}</span>
                          </div>
                          <div class="conj-row-flag">
                            <span class="conj-row-flag-label">不规则：</span>
                            <input
                              v-if="isConjRowEditing(row)"
                              class="conj-row-checkbox"
                              type="checkbox"
                              v-model="activeConjIrregular"
                            />
                            <input
                              v-else
                              class="conj-row-checkbox conj-row-checkbox-readonly"
                              type="checkbox"
                              :checked="!!row.record?.is_irregular"
                              aria-disabled="true"
                              tabindex="-1"
                              @click.prevent
                              @keydown.prevent
                            />
                          </div>
                          <div class="conj-row-actions">
                            <template v-if="isConjRowEditing(row)">
                              <button type="button" class="ghost" @click="cancelConjRowEdit">取消</button>
                              <button
                                type="button"
                                :disabled="activeConjSavingKey === getConjRowKey(row)"
                                @click="submitConjRowSave(row)"
                              >
                                保存
                              </button>
                            </template>
                            <button v-else type="button" class="ghost" @click="startConjRowEdit(row)">{{ row.record ? '编辑' : '新建' }}</button>
                          </div>
                        </div>
                      </template>
                    </div>
                  </section>
                </div>
              </section>
            </div>
            <div v-else class="empty">暂无变位</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="deleteDialog" class="overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>确认删除</h3>
          <button class="ghost" @click="closeDelete">关闭</button>
        </div>
        <p>即将删除条目：<strong>{{ deleteDialog.infinitive || deleteDialog.id }}</strong></p>
        <div class="modal-actions">
          <button class="ghost" @click="closeDelete">取消</button>
          <button class="danger" :disabled="deleting" @click="submitDelete">确认删除</button>
        </div>
      </div>
    </div>

    <div v-if="queueRemoveDialog" class="overlay">
      <div class="modal">
        <div class="modal-header">
          <h3>确认移除</h3>
          <button class="ghost" @click="closeQueueRemoveDialog">关闭</button>
        </div>
        <p>该词条已完成生成，确定从队列移除：<strong>{{ queueRemoveDialog.infinitive }}</strong>？</p>
        <div class="modal-actions">
          <button class="ghost" @click="closeQueueRemoveDialog">取消</button>
          <button class="danger" @click="confirmQueueRemoveDialog">确认移除</button>
        </div>
      </div>
    </div>

    <div v-if="toast.visible" class="toast" :class="toast.type">{{ toast.message }}</div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { apiRequest, ApiError } from '../utils/apiClient';
import { useAuth } from '../composables/useAuth';

const { isDev } = useAuth();

const rows = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(12);
const pageJump = ref(1);
const keyword = ref('');
const idOrder = ref('asc');
const loading = ref(false);
const error = ref('');

const drawerOpen = ref(false);
const editingId = ref(null);
const saving = ref(false);
const downloadingAll = ref(false);
const deleting = ref(false);
const deleteDialog = ref(null);
const queueRemoveDialog = ref(null);
const createDrawerView = ref('queue');

function createDefaultFormData(infinitive = '') {
  return {
    infinitive,
    meaning: '',
    conjugation_type: 1,
    is_irregular: false,
    is_reflexive: false,
    has_tr_use: false,
    has_intr_use: false,
    supports_do: false,
    supports_io: false,
    supports_do_io: false,
    lesson_number: null,
    textbook_volume: 1,
    frequency_level: 1,
    gerund: '',
    participle: '',
    participle_forms: ''
  };
}

const form = reactive(createDefaultFormData());
const formErrors = reactive({
  infinitive: '',
  meaning: '',
  gerund: '',
  participle: '',
  participle_forms: ''
});

const toast = reactive({ visible: false, message: '', type: 'info' });
const createConjDrafts = reactive({});
const createExpandedConjMoods = ref({});
const createExpandedConjTenses = ref({});
const isCreateMode = computed(() => editingId.value === null);
const queueInput = ref('');
const queueItems = ref([]);
const queueSeed = ref(1);
const queueProcessing = ref(false);
const queueSaving = ref(false);
const activeQueueItemId = ref('');
const activeQueueItem = computed(
  () => queueItems.value.find((item) => item.id === activeQueueItemId.value) || null
);
const queueSuccessItems = computed(
  () => queueItems.value.filter((item) => ['success', 'saved'].includes(item.status))
);

const CREATE_FORM_KEYS = [
  'infinitive',
  'meaning',
  'conjugation_type',
  'is_irregular',
  'is_reflexive',
  'has_tr_use',
  'has_intr_use',
  'supports_do',
  'supports_io',
  'supports_do_io',
  'lesson_number',
  'textbook_volume',
  'frequency_level',
  'gerund',
  'participle',
  'participle_forms'
];
const QUEUE_CACHE_KEY = 'admin_lexicon_create_queue_cache_v1';
const QUEUE_STATUS_VALUES = new Set(['pending', 'processing', 'success', 'error', 'saved']);

// conjugations state
const conjDrawerOpen = ref(false);
const activeVerb = ref(null);
const conjugations = ref([]);
const expandedConjMoods = ref({});
const expandedConjTenses = ref({});
const activeConjEditKey = ref('');
const activeConjDraft = ref('');
const activeConjIrregular = ref(false);
const activeConjSavingKey = ref('');

const CONJ_MOOD_ORDER = {
  '陈述式': 1,
  '虚拟式': 2,
  '条件式': 3,
  '命令式': 4
};

const CONJ_TENSE_ORDER = {
  '陈述式': {
    '现在时': 1,
    '现在完成时': 2,
    '未完成过去时': 3,
    '简单过去时': 4,
    '将来时': 5,
    '过去完成时': 6,
    '将来完成时': 7,
    '前过去时': 8
  },
  '虚拟式': {
    '虚拟现在时': 1,
    '虚拟过去时': 2,
    '虚拟现在完成时': 3,
    '虚拟过去完成时': 4,
    '虚拟将来未完成时': 5,
    '虚拟将来完成时': 6
  },
  '条件式': {
    '条件式': 1,
    '条件完成时': 2
  },
  '命令式': {
    '肯定命令式': 1,
    '否定命令式': 2
  }
};

const CONJ_MOOD_LABELS = {
  '陈述式': 'Indicativo (陈述式)',
  '虚拟式': 'Subjuntivo (虚拟式)',
  '条件式': 'Condicional (条件式)',
  '命令式': 'Imperativo (命令式)'
};

const CONJ_TENSE_DISPLAY = {
  '陈述式': {
    '现在时': { es: 'Presente', cn: '陈述式 一般现在时' },
    '现在完成时': { es: 'Pretérito Perfecto', cn: '陈述式 现在完成时' },
    '未完成过去时': { es: 'Pretérito Imperfecto', cn: '陈述式 过去未完成时' },
    '简单过去时': { es: 'Pretérito Indefinido', cn: '陈述式 简单过去时' },
    '过去完成时': { es: 'Pretérito Pluscuamperfecto', cn: '陈述式 过去完成时' },
    '将来时': { es: 'Futuro Imperfecto', cn: '陈述式 将来未完成时' },
    '将来完成时': { es: 'Futuro Perfecto', cn: '陈述式 将来完成时' },
    '前过去时': { es: 'Pretérito Anterior', cn: '陈述式 前过去时' }
  },
  '虚拟式': {
    '虚拟现在时': { es: 'Presente', cn: '虚拟式 现在时' },
    '虚拟过去时': { es: 'Pretérito Imperfecto', cn: '虚拟式 过去未完成时' },
    '虚拟现在完成时': { es: 'Pretérito Perfecto', cn: '虚拟式 现在完成时' },
    '虚拟过去完成时': { es: 'Pretérito Pluscuamperfecto', cn: '虚拟式 过去完成时' },
    '虚拟将来未完成时': { es: 'Futuro', cn: '虚拟式 将来未完成时' },
    '虚拟将来完成时': { es: 'Futuro Perfecto', cn: '虚拟式 将来完成时' }
  },
  '条件式': {
    '条件式': { es: 'Condicional Simple', cn: '简单条件式' },
    '条件完成时': { es: 'Condicional Compuesto', cn: '复合条件式' }
  },
  '命令式': {
    '肯定命令式': { es: 'Imperativo', cn: '命令式' },
    '否定命令式': { es: 'Imperativo Negativo', cn: '否定命令式' }
  }
};

const CONJ_DIMMED_KEYS = new Set([
  '陈述式|前过去时',
  '虚拟式|虚拟将来未完成时',
  '虚拟式|虚拟过去完成时',
  '虚拟式|虚拟将来完成时'
]);

const STANDARD_CONJ_PERSONS = ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes', 'vos'];
const IMPERATIVE_CONJ_PERSONS = {
  '肯定命令式': ['tú (afirmativo)', 'usted', 'nosotros/nosotras', 'vosotros/vosotras', 'ustedes', 'vos'],
  '否定命令式': ['tú (negativo)', 'usted', 'nosotros/nosotras', 'vosotros/vosotras', 'ustedes', 'vos']
};

const groupedConjugationSections = computed(() => {
  const groups = {};

  conjugations.value.forEach((item) => {
    const moodKey = getConjDisplayMoodKey(item.mood, item.tense);
    const tenseKey = getConjTenseKey(item.tense, moodKey);
    const personKey = getConjPersonKey(item.person, moodKey, tenseKey);

    if (!groups[moodKey]) groups[moodKey] = {};
    if (!groups[moodKey][tenseKey]) groups[moodKey][tenseKey] = new Map();

    const current = groups[moodKey][tenseKey].get(personKey);
    if (!current || Number(item.id) < Number(current.id)) {
      groups[moodKey][tenseKey].set(personKey, item);
    }
  });

  const allMoodKeys = Array.from(new Set([
    ...Object.keys(CONJ_TENSE_ORDER),
    ...Object.keys(groups)
  ]));

  return allMoodKeys
    .sort((a, b) => getConjMoodOrder(a) - getConjMoodOrder(b))
    .map((moodKey) => ({
      moodKey,
      tenses: [
        ...Object.keys(CONJ_TENSE_ORDER[moodKey] || {}),
        ...Object.keys(groups[moodKey] || {}).filter((tenseKey) => !(tenseKey in (CONJ_TENSE_ORDER[moodKey] || {})))
      ]
        .sort((a, b) => getConjTenseOrder(moodKey, a) - getConjTenseOrder(moodKey, b))
        .map((tenseKey) => {
          const records = groups[moodKey]?.[tenseKey] || new Map();
          const slotKeys = getConjPersonSlots(moodKey, tenseKey);
          const used = new Set();

          const rows = slotKeys.map((person) => {
            used.add(person);
            return {
              moodKey,
              tenseKey,
              person,
              isVos: person === 'vos',
              record: records.get(person) || null
            };
          });

          const extraRows = Array.from(records.keys())
            .filter((person) => !used.has(person))
            .sort((a, b) => getConjPersonOrder(a) - getConjPersonOrder(b))
            .map((person) => ({
              moodKey,
              tenseKey,
              person,
              isVos: person === 'vos',
              record: records.get(person) || null
            }));

          return {
            tenseKey,
            display: getConjTenseDisplay(tenseKey, moodKey),
            rows: [...rows, ...extraRows]
          };
        })
    }));
});

const createConjugationSections = computed(() => {
  const moodKeys = Object.keys(CONJ_TENSE_ORDER).sort((a, b) => getConjMoodOrder(a) - getConjMoodOrder(b));
  return moodKeys.map((moodKey) => ({
    moodKey,
    tenses: Object.keys(CONJ_TENSE_ORDER[moodKey] || {})
      .sort((a, b) => getConjTenseOrder(moodKey, a) - getConjTenseOrder(moodKey, b))
      .map((tenseKey) => ({
        tenseKey,
        display: getConjTenseDisplay(tenseKey, moodKey),
        rows: getConjPersonSlots(moodKey, tenseKey).map((person) => {
          const key = getConjCompositeKey(moodKey, tenseKey, person);
          return {
            key,
            moodKey,
            tenseKey,
            person,
            isVos: person === 'vos',
            draft: createConjDrafts[key]
          };
        })
      }))
  }));
});


const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

const filteredRows = computed(() => {
  const term = keyword.value.trim().toLowerCase();
  if (!term) return rows.value;
  return rows.value.filter((r) => {
    return (
      String(r.id).includes(term) ||
      (r.infinitive || '').toLowerCase().includes(term) ||
      (r.meaning || '').toLowerCase().includes(term)
    );
  });
});

function showToast(message, type = 'info') {
  toast.message = message;
  toast.type = type;
  toast.visible = true;
  setTimeout(() => (toast.visible = false), 3000);
}

function resetErrors(target) {
  Object.keys(target).forEach((k) => (target[k] = ''));
}

function handleApiError(err, targetErrors) {
  if (err instanceof ApiError) {
    if ([400, 422].includes(err.status)) {
      resetErrors(targetErrors || {});
      if (err.fieldErrors) Object.assign(targetErrors, err.fieldErrors);
      showToast(err.message || '请检查表单字段', 'error');
      return;
    }
    if (err.status === 401) {
      showToast('登录已过期', 'error');
      return;
    }
    showToast(err.message || '操作失败', 'error');
    return;
  }
  showToast('网络异常：无法连接到服务器', 'error');
}

function normalizeConjText(value) {
  return String(value || '').trim();
}

function getConjDisplayMoodKey(rawMood, rawTense) {
  const mood = normalizeConjText(rawMood);
  const tense = normalizeConjText(rawTense);
  const moodLower = mood.toLowerCase();
  const tenseLower = tense.toLowerCase();

  if (['条件式', '条件完成时', 'condicional', 'condicional_perfecto', 'conditional', 'conditional_perfect'].includes(tense) ||
      ['condicional', 'condicional_perfecto', 'conditional', 'conditional_perfect'].includes(tenseLower)) {
    return '条件式';
  }

  if (['陈述式', '复合陈述式'].includes(mood) || ['indicativo', 'indicativo_compuesto'].includes(moodLower)) {
    return '陈述式';
  }
  if (['虚拟式', '复合虚拟式'].includes(mood) || ['subjuntivo', 'subjuntivo_compuesto'].includes(moodLower)) {
    return '虚拟式';
  }
  if (mood === '命令式' || moodLower === 'imperativo') {
    return '命令式';
  }
  if (mood === '条件式' || moodLower === 'condicional') {
    return '条件式';
  }
  return mood || '未分类';
}

function getConjTenseKey(rawTense, moodKey) {
  const tense = normalizeConjText(rawTense);
  const tenseLower = tense.toLowerCase();
  const aliases = {
    '陈述式': {
      '现在时': '现在时',
      presente: '现在时',
      '现在完成时': '现在完成时',
      perfecto: '现在完成时',
      '未完成过去时': '未完成过去时',
      '过去未完成时': '未完成过去时',
      imperfecto: '未完成过去时',
      '简单过去时': '简单过去时',
      preterito: '简单过去时',
      '过去完成时': '过去完成时',
      pluscuamperfecto: '过去完成时',
      '将来时': '将来时',
      '将来未完成时': '将来时',
      futuro: '将来时',
      '将来完成时': '将来完成时',
      futuro_perfecto: '将来完成时',
      '前过去时': '前过去时',
      '先过去时': '前过去时',
      preterito_anterior: '前过去时'
    },
    '虚拟式': {
      '虚拟现在时': '虚拟现在时',
      subjuntivo_presente: '虚拟现在时',
      '虚拟过去时': '虚拟过去时',
      subjuntivo_imperfecto: '虚拟过去时',
      '虚拟现在完成时': '虚拟现在完成时',
      subjuntivo_perfecto: '虚拟现在完成时',
      '虚拟过去完成时': '虚拟过去完成时',
      subjuntivo_pluscuamperfecto: '虚拟过去完成时',
      '虚拟将来未完成时': '虚拟将来未完成时',
      '虚拟将来时': '虚拟将来未完成时',
      subjuntivo_futuro: '虚拟将来未完成时',
      '虚拟将来完成时': '虚拟将来完成时',
      subjuntivo_futuro_perfecto: '虚拟将来完成时'
    },
    '条件式': {
      '条件式': '条件式',
      condicional: '条件式',
      conditional: '条件式',
      '条件完成时': '条件完成时',
      condicional_perfecto: '条件完成时',
      conditional_perfect: '条件完成时'
    },
    '命令式': {
      '肯定命令式': '肯定命令式',
      imperativo_afirmativo: '肯定命令式',
      afirmativo: '肯定命令式',
      '否定命令式': '否定命令式',
      imperativo_negativo: '否定命令式',
      negativo: '否定命令式'
    }
  };

  const moodAliases = aliases[moodKey] || {};
  return moodAliases[tense] || moodAliases[tenseLower] || tense || '未命名时态';
}

function getConjPersonKey(rawPerson, moodKey, tenseKey) {
  const person = normalizeConjText(rawPerson);
  const personLower = person.toLowerCase();

  if (moodKey === '命令式') {
    if (['tú (afirmativo)', 'tú'].includes(person) && tenseKey === '肯定命令式') return 'tú (afirmativo)';
    if (['tú (negativo)', 'tú'].includes(person) && tenseKey === '否定命令式') return 'tú (negativo)';
    if (['usted', 'él/ella/usted'].includes(person)) return 'usted';
    if (['nosotros', 'nosotros/nosotras'].includes(person)) return 'nosotros/nosotras';
    if (['vosotros', 'vosotros/vosotras'].includes(person)) return 'vosotros/vosotras';
    if (['ustedes', 'ellos/ellas/ustedes'].includes(person)) return 'ustedes';
    if (personLower === 'vos') return 'vos';
    return person || '未命名人称';
  }

  if (personLower === 'yo') return 'yo';
  if (person === 'tú') return 'tú';
  if (['él/ella/usted', 'usted'].includes(person)) return 'él/ella/usted';
  if (['nosotros', 'nosotros/nosotras'].includes(person)) return 'nosotros';
  if (['vosotros', 'vosotros/vosotras'].includes(person)) return 'vosotros';
  if (['ellos/ellas/ustedes', 'ustedes'].includes(person)) return 'ellos/ellas/ustedes';
  if (personLower === 'vos') return 'vos';

  return person || '未命名人称';
}

function getConjMoodOrder(moodKey) {
  return CONJ_MOOD_ORDER[moodKey] || 99;
}

function getConjTenseOrder(moodKey, tenseKey) {
  return CONJ_TENSE_ORDER[moodKey]?.[tenseKey] || 99;
}

function getConjTenseDisplay(tenseKey, moodKey) {
  const display = CONJ_TENSE_DISPLAY[moodKey]?.[tenseKey];
  if (!display) {
    return { es: tenseKey, cn: tenseKey, dimmed: false };
  }
  return {
    ...display,
    dimmed: CONJ_DIMMED_KEYS.has(`${moodKey}|${tenseKey}`)
  };
}

function getConjMoodName(moodKey) {
  return CONJ_MOOD_LABELS[moodKey] || moodKey;
}

function getConjPersonLabel(personKey) {
  return personKey;
}

function getConjPersonOrder(personKey) {
  const order = {
    'yo': 1,
    'tú': 2,
    'tú (afirmativo)': 2.1,
    'tú (negativo)': 2.2,
    'él/ella/usted': 3,
    'usted': 3,
    'nosotros': 4,
    'nosotros/nosotras': 4,
    'vosotros': 5,
    'vosotros/vosotras': 5,
    'ellos/ellas/ustedes': 6,
    'ustedes': 6,
    'vos': 100
  };
  return order[personKey] || 99;
}

function getConjPersonSlots(moodKey, tenseKey) {
  if (moodKey === '命令式') {
    return IMPERATIVE_CONJ_PERSONS[tenseKey] || [];
  }
  return STANDARD_CONJ_PERSONS;
}

function getConjCompositeKey(moodKey, tenseKey, person) {
  return `${moodKey}|${tenseKey}|${person}`;
}

function buildEmptyConjugationDrafts() {
  const next = {};
  Object.keys(CONJ_TENSE_ORDER).forEach((moodKey) => {
    Object.keys(CONJ_TENSE_ORDER[moodKey] || {}).forEach((tenseKey) => {
      getConjPersonSlots(moodKey, tenseKey).forEach((person) => {
        const key = getConjCompositeKey(moodKey, tenseKey, person);
        next[key] = {
          conjugated_form: '',
          is_irregular: false
        };
      });
    });
  });
  return next;
}

function buildEmptyCreateDraft(infinitive = '') {
  return {
    form: createDefaultFormData(infinitive),
    conjugations: buildEmptyConjugationDrafts()
  };
}

function normalizeQueueStatus(status) {
  return QUEUE_STATUS_VALUES.has(status) ? status : 'pending';
}

function normalizeDraft(rawDraft, fallbackInfinitive = '') {
  const normalizedInfinitive = String(fallbackInfinitive || '').trim();
  const base = buildEmptyCreateDraft(normalizedInfinitive);
  const sourceForm = rawDraft?.form || {};

  CREATE_FORM_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(sourceForm, key)) {
      base.form[key] = sourceForm[key];
    }
  });

  const sourceConjugations = rawDraft?.conjugations || {};
  Object.keys(base.conjugations).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(sourceConjugations, key)) return;
    const row = sourceConjugations[key] || {};
    base.conjugations[key] = {
      conjugated_form: String(row.conjugated_form || ''),
      is_irregular: !!row.is_irregular
    };
  });

  if (!String(base.form.infinitive || '').trim() && normalizedInfinitive) {
    base.form.infinitive = normalizedInfinitive;
  }
  return base;
}

function snapshotQueueCacheState() {
  const items = queueItems.value
    .map((item) => {
      const id = String(item?.id || '').trim();
      const infinitive = String(item?.infinitive || '').trim();
      if (!id || !infinitive) return null;

      return {
        id,
        infinitive,
        status: normalizeQueueStatus(item?.status),
        message: String(item?.message || ''),
        draft: normalizeDraft(item?.draft, infinitive)
      };
    })
    .filter(Boolean);

  const maxSeedFromIds = items.reduce((max, item) => {
    const matched = String(item.id).match(/^queue-(\d+)$/);
    const next = matched ? Number(matched[1]) + 1 : 1;
    return Math.max(max, next);
  }, 1);

  const cachedActiveId = String(activeQueueItemId.value || '');
  return {
    version: 1,
    queueSeed: Math.max(queueSeed.value, maxSeedFromIds),
    queueInput: String(queueInput.value || ''),
    activeQueueItemId: items.some((item) => item.id === cachedActiveId) ? cachedActiveId : '',
    queueItems: items
  };
}

function persistQueueCache() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(QUEUE_CACHE_KEY, JSON.stringify(snapshotQueueCacheState()));
  } catch (error) {
    console.warn('保存词条队列缓存失败:', error);
  }
}

function restoreQueueCache() {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const raw = window.localStorage.getItem(QUEUE_CACHE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw);
    const cachedItems = Array.isArray(parsed?.queueItems) ? parsed.queueItems : [];
    const restoredItems = cachedItems
      .map((item, index) => {
        const infinitive = String(item?.infinitive || '').trim();
        if (!infinitive) return null;

        const idRaw = String(item?.id || '').trim();
        const id = idRaw || `queue-${index + 1}`;
        return {
          id,
          infinitive,
          status: normalizeQueueStatus(item?.status),
          message: String(item?.message || ''),
          draft: normalizeDraft(item?.draft, infinitive)
        };
      })
      .filter(Boolean);

    queueItems.value = restoredItems;
    const maxSeedFromIds = restoredItems.reduce((max, item) => {
      const matched = String(item.id).match(/^queue-(\d+)$/);
      const next = matched ? Number(matched[1]) + 1 : 1;
      return Math.max(max, next);
    }, 1);
    const parsedSeed = Number.parseInt(parsed?.queueSeed, 10);
    queueSeed.value = Math.max(Number.isFinite(parsedSeed) ? parsedSeed : 1, maxSeedFromIds);
    queueInput.value = String(parsed?.queueInput || '');

    const cachedActiveId = String(parsed?.activeQueueItemId || '');
    activeQueueItemId.value = restoredItems.some((item) => item.id === cachedActiveId)
      ? cachedActiveId
      : '';
    return true;
  } catch (error) {
    console.warn('恢复词条队列缓存失败:', error);
    return false;
  }
}

function resetCreateConjDrafts() {
  Object.keys(createConjDrafts).forEach((key) => {
    delete createConjDrafts[key];
  });

  Object.assign(createConjDrafts, buildEmptyConjugationDrafts());
}

function resetCreateConjExpandState() {
  const nextMoods = {};
  const nextTenses = {};
  createConjugationSections.value.forEach((group) => {
    nextMoods[group.moodKey] = false;
    nextTenses[group.moodKey] = {};
    group.tenses.forEach((tense) => {
      nextTenses[group.moodKey][tense.tenseKey] = false;
    });
  });
  createExpandedConjMoods.value = nextMoods;
  createExpandedConjTenses.value = nextTenses;
}

function switchCreateDrawerView(view) {
  if (view === 'queue') {
    syncCurrentEditorToQueue();
    createDrawerView.value = 'queue';
    return;
  }

  if (isCreateMode.value && !activeQueueItemId.value) {
    showToast('请先在队列中选择已处理成功的词条详情', 'error');
    createDrawerView.value = 'queue';
    return;
  }
  createDrawerView.value = view === 'conjugations' ? 'conjugations' : 'details';
}

function isDraftCompleteWithoutSwitches(draft) {
  const source = draft || buildEmptyCreateDraft();
  const textFields = [source.form.infinitive, source.form.meaning, source.form.gerund, source.form.participle];
  const textComplete = textFields.every((value) => String(value || '').trim());
  if (!textComplete) return false;

  return Object.values(source.conjugations || {}).every((row) =>
    String(row?.conjugated_form || '').trim()
  );
}

function applyAutoFillResultToDraft(result, targetDraft) {
  if (!targetDraft || !targetDraft.form || !targetDraft.conjugations) return;

  const targetForm = targetDraft.form;
  const targetConjugations = targetDraft.conjugations;
  const fields = result?.fields || {};
  const textFieldKeys = ['meaning', 'gerund', 'participle', 'participle_forms'];
  textFieldKeys.forEach((key) => {
    const current = String(targetForm[key] || '').trim();
    const incoming = String(fields[key] || '').trim();
    if (!current && incoming) {
      targetForm[key] = incoming;
    }
  });

  if (typeof fields.is_irregular === 'boolean') targetForm.is_irregular = fields.is_irregular;
  if (typeof fields.is_reflexive === 'boolean') targetForm.is_reflexive = fields.is_reflexive;
  if (typeof fields.has_tr_use === 'boolean') targetForm.has_tr_use = fields.has_tr_use;
  if (typeof fields.has_intr_use === 'boolean') targetForm.has_intr_use = fields.has_intr_use;
  if (typeof fields.supports_do === 'boolean') targetForm.supports_do = fields.supports_do;
  if (typeof fields.supports_io === 'boolean') targetForm.supports_io = fields.supports_io;
  if (typeof fields.supports_do_io === 'boolean') targetForm.supports_do_io = fields.supports_do_io;

  const suggestionMap = new Map(
    (Array.isArray(result?.conjugations) ? result.conjugations : []).map((item) => [
      getConjCompositeKey(item.mood, item.tense, item.person),
      item
    ])
  );

  Object.keys(targetConjugations).forEach((key) => {
    const draft = targetConjugations[key];
    const suggestion = suggestionMap.get(key);
    if (!draft || !suggestion) return;

    const currentForm = String(draft.conjugated_form || '').trim();
    const incomingForm = String(suggestion.conjugated_form || '').trim();
    if (!currentForm && incomingForm) {
      draft.conjugated_form = incomingForm;
      draft.is_irregular = !!suggestion.is_irregular;
    }
  });
}

function getActionErrorMessage(err, fallback = '操作失败') {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

async function hasDuplicateInLexicon(infinitive) {
  const target = String(infinitive || '').trim();
  if (!target) return false;
  const duplicateResult = await apiRequest('/verbs', {
    params: { q: target, limit: 100, offset: 0 },
    timeout: 20000
  });
  return !!(duplicateResult?.rows || []).find((item) =>
    String(item?.infinitive || '').trim().toLowerCase() === target.toLowerCase()
  );
}

async function runAutoFillForDraft(draft) {
  const targetDraft = draft || buildEmptyCreateDraft();
  const infinitive = String(targetDraft.form?.infinitive || '').trim();
  if (!infinitive) {
    throw new Error('未填写动词原形');
  }

  if (await hasDuplicateInLexicon(infinitive)) {
    throw new Error('已在词库中');
  }

  const validation = await apiRequest('/verbs/autofill/validate', {
    method: 'POST',
    body: { infinitive },
    timeout: 30000
  });
  if (!validation?.isValid) {
    throw new Error('生成失败，请检查是否是一个合法的西语单词。');
  }

  if (isDraftCompleteWithoutSwitches(targetDraft)) {
    return { skipped: true };
  }

  const generated = await apiRequest('/verbs/autofill', {
    method: 'POST',
    body: { infinitive },
    timeout: 120000
  });
  applyAutoFillResultToDraft(generated, targetDraft);
  return { skipped: false };
}

function getQueueStatusLabel(status) {
  const map = {
    pending: '待处理',
    processing: '处理中',
    success: '已完成',
    error: '失败',
    saved: '已入库'
  };
  return map[status] || '未知';
}

function canOpenQueueDetail(item) {
  return !!item && ['success', 'saved'].includes(item.status);
}

function createQueueItem(infinitive) {
  const normalized = String(infinitive || '').trim();
  return {
    id: `queue-${queueSeed.value++}`,
    infinitive: normalized,
    status: 'pending',
    message: '等待处理',
    draft: buildEmptyCreateDraft(normalized)
  };
}

function addQueueInfinitive() {
  const infinitive = String(queueInput.value || '').trim();
  if (!infinitive) {
    return;
  }

  const duplicatedInQueue = queueItems.value.some(
    (item) => String(item.infinitive || '').toLowerCase() === infinitive.toLowerCase()
  );
  if (duplicatedInQueue) {
    showToast('队列中已存在该动词原形', 'error');
    return;
  }

  queueItems.value.push(createQueueItem(infinitive));
  queueInput.value = '';
  persistQueueCache();
}

function removeQueueItem(queueId) {
  if (queueProcessing.value || queueSaving.value) return;
  queueItems.value = queueItems.value.filter((item) => item.id !== queueId);
  if (activeQueueItemId.value === queueId) {
    activeQueueItemId.value = '';
    createDrawerView.value = 'queue';
    resetCreateForm();
    resetErrors(formErrors);
  }
  persistQueueCache();
}

function requestRemoveQueueItem(item) {
  if (!item || queueProcessing.value || queueSaving.value) return;
  if (item.status === 'success') {
    queueRemoveDialog.value = {
      id: item.id,
      infinitive: item.infinitive || item.id
    };
    return;
  }
  removeQueueItem(item.id);
}

function closeQueueRemoveDialog() {
  queueRemoveDialog.value = null;
}

function confirmQueueRemoveDialog() {
  if (!queueRemoveDialog.value) return;
  removeQueueItem(queueRemoveDialog.value.id);
  closeQueueRemoveDialog();
}

function syncCurrentEditorToQueue() {
  if (!isCreateMode.value || !activeQueueItemId.value) return;
  const item = queueItems.value.find((entry) => entry.id === activeQueueItemId.value);
  if (!item) return;

  item.draft = snapshotCreateDraft();
  const nextInfinitive = String(item.draft.form?.infinitive || '').trim();
  if (nextInfinitive) {
    item.infinitive = nextInfinitive;
  }
  persistQueueCache();
}

function openQueueDetail(queueId) {
  const item = queueItems.value.find((entry) => entry.id === queueId);
  if (!canOpenQueueDetail(item)) {
    showToast('仅已处理成功的词条可查看详情', 'error');
    return;
  }

  syncCurrentEditorToQueue();
  activeQueueItemId.value = queueId;
  restoreCreateDraft(item.draft);
  resetErrors(formErrors);
  createDrawerView.value = 'details';
  persistQueueCache();
}

async function processQueueItem(item) {
  item.status = 'processing';
  item.message = '处理中...';

  try {
    const draft = item.draft || buildEmptyCreateDraft(item.infinitive);
    draft.form.infinitive = String(draft.form.infinitive || item.infinitive || '').trim();
    const result = await runAutoFillForDraft(draft);
    item.draft = draft;
    item.infinitive = String(draft.form.infinitive || item.infinitive || '').trim();
    item.status = 'success';
    item.message = result.skipped ? '字段已完整，跳过自动补充' : '处理完成，可点击详情调整';
    persistQueueCache();
    return true;
  } catch (err) {
    item.status = 'error';
    item.message = getActionErrorMessage(err, '处理失败');
    persistQueueCache();
    return false;
  }
}

async function runQueueGenerate() {
  if (queueProcessing.value || queueSaving.value) return;
  if (!queueItems.value.length) {
    showToast('队列为空，请先添加动词原形', 'error');
    return;
  }

  syncCurrentEditorToQueue();
  createDrawerView.value = 'queue';
  const targets = queueItems.value.filter((item) => item.status === 'pending');
  if (!targets.length) {
    showToast('队列中没有待处理项', 'info');
    return;
  }

  queueProcessing.value = true;
  let successCount = 0;
  let failedCount = 0;

  for (const item of targets) {
    const ok = await processQueueItem(item);
    if (ok) successCount += 1;
    else failedCount += 1;
  }

  queueProcessing.value = false;
  persistQueueCache();
  showToast(`队列处理完成：成功 ${successCount}，失败 ${failedCount}`, failedCount ? 'info' : 'success');
}

function findMissingConjugationsFromMap(conjugationMap) {
  const missing = [];
  Object.keys(CONJ_TENSE_ORDER).forEach((moodKey) => {
    Object.keys(CONJ_TENSE_ORDER[moodKey] || {}).forEach((tenseKey) => {
      getConjPersonSlots(moodKey, tenseKey).forEach((person) => {
        const key = getConjCompositeKey(moodKey, tenseKey, person);
        const value = String(conjugationMap?.[key]?.conjugated_form || '').trim();
        if (!value) {
          missing.push({ moodKey, tenseKey, person });
        }
      });
    });
  });
  return missing;
}

function buildConjugationPayloadFromMap(conjugationMap) {
  const rows = [];
  Object.keys(CONJ_TENSE_ORDER).forEach((moodKey) => {
    Object.keys(CONJ_TENSE_ORDER[moodKey] || {}).forEach((tenseKey) => {
      getConjPersonSlots(moodKey, tenseKey).forEach((person) => {
        const key = getConjCompositeKey(moodKey, tenseKey, person);
        rows.push({
          mood: moodKey,
          tense: tenseKey,
          person,
          conjugated_form: String(conjugationMap?.[key]?.conjugated_form || '').trim(),
          is_irregular: conjugationMap?.[key]?.is_irregular ? 1 : 0
        });
      });
    });
  });
  return rows;
}

function buildPayloadFromDraft(draft, includeConjugations = false) {
  const source = draft || buildEmptyCreateDraft();
  const sourceForm = source.form || createDefaultFormData();
  const meaning = String(sourceForm.meaning || '').trim();
  const gerund = String(sourceForm.gerund || '').trim();
  const participle = String(sourceForm.participle || '').trim();
  const participleForms = String(sourceForm.participle_forms || '').trim();

  const payload = {
    infinitive: String(sourceForm.infinitive || '').trim(),
    meaning: meaning || null,
    conjugation_type: sourceForm.conjugation_type || 1,
    is_irregular: sourceForm.is_irregular ? 1 : 0,
    is_reflexive: sourceForm.is_reflexive ? 1 : 0,
    has_tr_use: sourceForm.has_tr_use ? 1 : 0,
    has_intr_use: sourceForm.has_intr_use ? 1 : 0,
    supports_do: sourceForm.supports_do ? 1 : 0,
    supports_io: sourceForm.supports_io ? 1 : 0,
    supports_do_io: sourceForm.supports_do_io ? 1 : 0,
    gerund: gerund || null,
    participle: participle || null,
    participle_forms: participleForms || null,
    lesson_number: sourceForm.lesson_number || null,
    textbook_volume: sourceForm.textbook_volume || 1,
    frequency_level: sourceForm.frequency_level || 1
  };

  if (includeConjugations) {
    payload.conjugations = buildConjugationPayloadFromMap(source.conjugations || {});
  }
  return payload;
}

function validateDraftBeforePersist(draft) {
  const source = draft || buildEmptyCreateDraft();
  const sourceForm = source.form || {};
  if (!String(sourceForm.infinitive || '').trim()) return '未填写动词原形';
  if (!String(sourceForm.meaning || '').trim()) return '释义未填写';
  if (!String(sourceForm.gerund || '').trim()) return '副动词未填写';
  if (!String(sourceForm.participle || '').trim()) return '过去分词未填写';
  const missing = findMissingConjugationsFromMap(source.conjugations || {});
  if (missing.length) return `变位缺失（${missing.length} 项）`;
  return '';
}

function saveCurrentQueueDraft() {
  if (!activeQueueItem.value) {
    showToast('请先从队列进入一个词条详情', 'error');
    createDrawerView.value = 'queue';
    return false;
  }

  if (!validateVerbForm(true)) {
    switchCreateDrawerView('details');
    showToast('请先补全编辑字段中的全部必填项', 'error');
    return false;
  }

  const missingConjugations = findMissingCreateConjugations();
  if (missingConjugations.length) {
    const firstMissing = missingConjugations[0];
    switchCreateDrawerView('conjugations');
    revealCreateConjRow(firstMissing.moodKey, firstMissing.tenseKey);
    showToast(`请先填写全部变位（仍缺 ${missingConjugations.length} 项）`, 'error');
    return false;
  }

  syncCurrentEditorToQueue();
  if (activeQueueItem.value) {
    activeQueueItem.value.status = 'success';
    activeQueueItem.value.message = '已更新，待统一入库';
  }
  persistQueueCache();
  showToast('已保存到队列', 'success');
  return true;
}

async function saveQueueSuccessItems() {
  if (queueSaving.value || queueProcessing.value) return;
  syncCurrentEditorToQueue();

  const candidates = queueItems.value.filter((item) => item.status === 'success');
  if (!candidates.length) {
    showToast('暂无可入库的成功词条', 'info');
    return;
  }

  queueSaving.value = true;
  let savedCount = 0;
  let failedCount = 0;

  for (const item of candidates) {
    const invalidReason = validateDraftBeforePersist(item.draft);
    if (invalidReason) {
      item.status = 'error';
      item.message = invalidReason;
      failedCount += 1;
      continue;
    }

    try {
      const payload = buildPayloadFromDraft(item.draft, true);
      await apiRequest('/verbs', { method: 'POST', body: payload, timeout: 120000 });
      item.status = 'saved';
      item.message = '已保存到词库';
      savedCount += 1;
    } catch (err) {
      item.status = 'error';
      item.message = getActionErrorMessage(err, '保存失败');
      failedCount += 1;
    }
  }

  queueSaving.value = false;
  if (savedCount) {
    fetchRows();
  }
  persistQueueCache();
  showToast(`入库完成：成功 ${savedCount}，失败 ${failedCount}`, failedCount ? 'info' : 'success');
}

function toggleCreateConjMood(moodKey) {
  createExpandedConjMoods.value = {
    ...createExpandedConjMoods.value,
    [moodKey]: !createExpandedConjMoods.value[moodKey]
  };
}

function isCreateConjMoodExpanded(moodKey) {
  return !!createExpandedConjMoods.value[moodKey];
}

function toggleCreateConjTense(moodKey, tenseKey) {
  createExpandedConjTenses.value = {
    ...createExpandedConjTenses.value,
    [moodKey]: {
      ...(createExpandedConjTenses.value[moodKey] || {}),
      [tenseKey]: !createExpandedConjTenses.value[moodKey]?.[tenseKey]
    }
  };
}

function isCreateConjTenseExpanded(moodKey, tenseKey) {
  return !!createExpandedConjTenses.value[moodKey]?.[tenseKey];
}

function revealCreateConjRow(moodKey, tenseKey) {
  createExpandedConjMoods.value = {
    ...createExpandedConjMoods.value,
    [moodKey]: true
  };
  createExpandedConjTenses.value = {
    ...createExpandedConjTenses.value,
    [moodKey]: {
      ...(createExpandedConjTenses.value[moodKey] || {}),
      [tenseKey]: true
    }
  };
}

function resetConjExpandState(preserve = false) {
  const previousMoods = expandedConjMoods.value;
  const previousTenses = expandedConjTenses.value;
  const nextMoods = {};
  const nextTenses = {};

  groupedConjugationSections.value.forEach((group) => {
    nextMoods[group.moodKey] = preserve
      ? (previousMoods[group.moodKey] ?? false)
      : false;
    nextTenses[group.moodKey] = {};
    group.tenses.forEach((tense) => {
      nextTenses[group.moodKey][tense.tenseKey] = preserve
        ? (previousTenses[group.moodKey]?.[tense.tenseKey] ?? false)
        : false;
    });
  });

  expandedConjMoods.value = nextMoods;
  expandedConjTenses.value = nextTenses;
}

function toggleConjMood(moodKey) {
  expandedConjMoods.value = {
    ...expandedConjMoods.value,
    [moodKey]: !expandedConjMoods.value[moodKey]
  };
}

function isConjMoodExpanded(moodKey) {
  return !!expandedConjMoods.value[moodKey];
}

function toggleConjTense(moodKey, tenseKey) {
  expandedConjTenses.value = {
    ...expandedConjTenses.value,
    [moodKey]: {
      ...(expandedConjTenses.value[moodKey] || {}),
      [tenseKey]: !expandedConjTenses.value[moodKey]?.[tenseKey]
    }
  };
}

function isConjTenseExpanded(moodKey, tenseKey) {
  return !!expandedConjTenses.value[moodKey]?.[tenseKey];
}

function getConjRowKey(row) {
  return getConjCompositeKey(row.moodKey, row.tenseKey, row.person);
}

function isConjRowEditing(row) {
  return activeConjEditKey.value === getConjRowKey(row);
}

function startConjRowEdit(row) {
  activeConjEditKey.value = getConjRowKey(row);
  activeConjDraft.value = row.record?.conjugated_form || '';
  activeConjIrregular.value = !!row.record?.is_irregular;
}

function cancelConjRowEdit() {
  activeConjEditKey.value = '';
  activeConjDraft.value = '';
  activeConjIrregular.value = false;
  activeConjSavingKey.value = '';
}

async function submitConjRowSave(row) {
  if (!activeVerb.value) return;

  const nextValue = activeConjDraft.value.trim();
  if (!nextValue) {
    showToast('请填写变位形式', 'error');
    return;
  }

  const rowKey = getConjRowKey(row);
  activeConjSavingKey.value = rowKey;

  const payload = {
    tense: row.tenseKey,
    mood: row.moodKey,
    person: row.person,
    conjugated_form: nextValue,
    is_irregular: activeConjIrregular.value ? 1 : 0
  };

  try {
    if (row.record) {
      await apiRequest(`/conjugations/${row.record.id}`, { method: 'PUT', body: payload });
      showToast('变位已更新', 'success');
    } else {
      await apiRequest(`/verbs/${activeVerb.value.id}/conjugations`, { method: 'POST', body: payload });
      showToast('已创建变位', 'success');
    }
    await fetchConjugations(activeVerb.value.id, { preserveExpand: true });
    cancelConjRowEdit();
  } catch (err) {
    handleApiError(err);
  } finally {
    activeConjSavingKey.value = '';
  }
}

let _keywordTimer = null;
async function fetchRows() {
  loading.value = true;
  error.value = '';
  try {
    const params = {
      limit: 100000,
      offset: 0
    };
    const q = keyword.value.trim();
    if (q) params.q = q;
    const data = await apiRequest('/verbs', { params });
    const fetchedRows = Array.isArray(data.rows) ? [...data.rows] : [];
    fetchedRows.sort((a, b) => {
      const left = Number(a.id) || 0;
      const right = Number(b.id) || 0;
      return idOrder.value === 'desc' ? right - left : left - right;
    });
    total.value = Number(data.total || fetchedRows.length || 0);
    const start = (page.value - 1) * pageSize.value;
    rows.value = fetchedRows.slice(start, start + pageSize.value);
  } catch (err) {
    error.value = err.message || '加载失败';
    handleApiError(err);
  } finally {
    loading.value = false;
  }
}

// 当 keyword 改变时，重置页码并防抖触发查询
watch(keyword, (val) => {
  if (_keywordTimer) clearTimeout(_keywordTimer);
  page.value = 1;
  _keywordTimer = setTimeout(() => {
    fetchRows();
  }, 260);
});

watch(page, (value) => {
  pageJump.value = value;
}, { immediate: true });

function refresh() {
  fetchRows();
}

function toggleIdOrder() {
  idOrder.value = idOrder.value === 'asc' ? 'desc' : 'asc';
  if (page.value !== 1) {
    page.value = 1;
    return;
  }
  fetchRows();
}

function downloadJsonFile(payload, fileName) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildVerbsDownloadFileName() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
  return `verbs-${stamp}.json`;
}

async function downloadAllVerbsJson() {
  if (downloadingAll.value) return;
  downloadingAll.value = true;
  try {
    const rows = await apiRequest('/verbs/export/json', { timeout: 120000 });
    if (!Array.isArray(rows) || !rows.length) {
      showToast('没有词条可下载', 'info');
      return;
    }
    downloadJsonFile(rows, buildVerbsDownloadFileName());
    showToast('JSON 已下载', 'success');
  } catch (err) {
    handleApiError(err);
  } finally {
    downloadingAll.value = false;
  }
}

function changePage(p) {
  page.value = Math.min(Math.max(p, 1), totalPages.value);
}

function jumpToPage() {
  const target = Number(pageJump.value);
  if (!Number.isFinite(target)) {
    pageJump.value = page.value;
    return;
  }
  const nextPage = Math.min(Math.max(Math.trunc(target), 1), totalPages.value);
  pageJump.value = nextPage;
  changePage(nextPage);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function resetCreateForm() {
  const defaults = createDefaultFormData();
  CREATE_FORM_KEYS.forEach((key) => {
    form[key] = defaults[key];
  });
  resetCreateConjDrafts();
  resetCreateConjExpandState();
}

function snapshotCreateDraft() {
  const formData = {};
  CREATE_FORM_KEYS.forEach((key) => {
    formData[key] = form[key];
  });

  const conjugations = {};
  Object.keys(createConjDrafts).forEach((key) => {
    const item = createConjDrafts[key] || {};
    conjugations[key] = {
      conjugated_form: String(item.conjugated_form || ''),
      is_irregular: !!item.is_irregular
    };
  });

  return { form: formData, conjugations };
}

function restoreCreateDraft(cache) {
  resetCreateForm();
  if (!cache || typeof cache !== 'object') return;

  const formData = cache.form || {};
  CREATE_FORM_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(formData, key)) {
      form[key] = formData[key];
    }
  });

  const conjugations = cache.conjugations || {};
  Object.keys(conjugations).forEach((key) => {
    if (!createConjDrafts[key]) return;
    const item = conjugations[key] || {};
    createConjDrafts[key].conjugated_form = String(item.conjugated_form || '');
    createConjDrafts[key].is_irregular = !!item.is_irregular;
  });
}

function openCreate() {
  if (!queueItems.value.length) {
    restoreQueueCache();
  }
  editingId.value = null;
  createDrawerView.value = 'queue';
  activeQueueItemId.value = '';
  resetCreateForm();
  resetErrors(formErrors);
  drawerOpen.value = true;
}

// 变位相关方法
function openConjugations(verb) {
  activeVerb.value = verb;
  cancelConjRowEdit();
  fetchConjugations(verb.id);
  conjDrawerOpen.value = true;
}

function closeConjDrawer() {
  conjDrawerOpen.value = false;
  activeVerb.value = null;
  conjugations.value = [];
  expandedConjMoods.value = {};
  expandedConjTenses.value = {};
  cancelConjRowEdit();
}

async function fetchConjugations(verbId, options = {}) {
  try {
    const data = await apiRequest(`/verbs/${verbId}/conjugations`);
    conjugations.value = data.rows || [];
    resetConjExpandState(options.preserveExpand === true);
  } catch (err) {
    handleApiError(err);
  }
}

async function openEdit(item) {
  resetErrors(formErrors);
  try {
    const data = await apiRequest(`/verbs/${item.id}`);
    editingId.value = data.id;
    createDrawerView.value = 'details';
    form.infinitive = data.infinitive || '';
    form.meaning = data.meaning || '';
    form.conjugation_type = data.conjugation_type || 1;
    form.is_irregular = !!data.is_irregular;
    form.is_reflexive = !!data.is_reflexive;
    form.has_tr_use = !!data.has_tr_use;
    form.has_intr_use = !!data.has_intr_use;
    form.supports_do = !!data.supports_do;
    form.supports_io = !!data.supports_io;
    form.supports_do_io = !!data.supports_do_io;
    form.lesson_number = data.lesson_number || null;
    form.textbook_volume = data.textbook_volume || 1;
    form.frequency_level = data.frequency_level || 1;
    form.gerund = data.gerund || '';
    form.participle = data.participle || '';
    form.participle_forms = data.participle_forms || '';
    drawerOpen.value = true;
  } catch (err) {
    handleApiError(err);
  }
}

function closeDrawer() {
  if (isCreateMode.value) {
    syncCurrentEditorToQueue();
    activeQueueItemId.value = '';
    resetCreateForm();
    closeQueueRemoveDialog();
  }
  persistQueueCache();
  drawerOpen.value = false;
  createDrawerView.value = isCreateMode.value ? 'queue' : 'details';
}

function openDelete(item) {
  deleteDialog.value = item;
}

function confirmDelete(item) {
  deleteDialog.value = item;
}

function closeDelete() {
  deleteDialog.value = null;
}

function validateVerbForm(requireAllFields = false) {
  resetErrors(formErrors);

  if (!form.infinitive || !form.infinitive.trim()) {
    formErrors.infinitive = '请输入动词原形';
  }
  if (requireAllFields) {
    if (!form.meaning || !form.meaning.trim()) {
      formErrors.meaning = '请输入释义';
    }
    if (!form.gerund || !form.gerund.trim()) {
      formErrors.gerund = '请输入副动词';
    }
    if (!form.participle || !form.participle.trim()) {
      formErrors.participle = '请输入过去分词';
    }
  }
  return !Object.values(formErrors).some((v) => v);
}

function findMissingCreateConjugations() {
  const missing = [];
  createConjugationSections.value.forEach((group) => {
    group.tenses.forEach((tense) => {
      tense.rows.forEach((row) => {
        const value = row.draft?.conjugated_form || '';
        if (!String(value).trim()) {
          missing.push({
            moodKey: group.moodKey,
            tenseKey: tense.tenseKey,
            person: row.person
          });
        }
      });
    });
  });
  return missing;
}

async function submitSave() {
  const creating = isCreateMode.value;
  if (creating) {
    saveCurrentQueueDraft();
    return;
  }

  if (!validateVerbForm(false)) {
    return;
  }

  saving.value = true;
  const payload = buildPayloadFromDraft(snapshotCreateDraft(), false);
  try {
    await apiRequest(`/verbs/${editingId.value}`, { method: 'PUT', body: payload });
    showToast('保存成功', 'success');
    closeDrawer();
    fetchRows();
  } catch (err) {
    handleApiError(err, formErrors);
  } finally {
    saving.value = false;
  }
}

async function submitDelete() {
  if (!deleteDialog.value) return;
  deleting.value = true;
  try {
    await apiRequest(`/verbs/${deleteDialog.value.id}`, { method: 'DELETE' });
    showToast('删除成功', 'success');
    closeDelete();
    fetchRows();
  } catch (err) {
    handleApiError(err);
  } finally {
    deleting.value = false;
  }
}

watch([page, pageSize], () => {
  fetchRows();
});

fetchRows();
</script>

<style scoped>
.lexicon-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: min(calc(100vh - 110px), 860px);
  overflow: hidden;
}

.lexicon-page .header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
}

.header-copy {
  flex: 0 0 auto;
}

.header-copy h2 {
  margin: 0;
  white-space: nowrap;
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
  margin-left: auto;
  width: auto;
  min-width: 0;
}

.toolbar-left,
.toolbar-right {
  gap: 8px;
  flex-wrap: nowrap;
  min-width: 0;
}

.toolbar-left {
  flex: 0 1 auto;
}

.toolbar-left input {
  width: 220px;
  min-width: 220px;
}

.toolbar button,
.toolbar .ghost,
.toolbar-right .pagination .ghost {
  padding: 6px 10px;
  font-size: 13px;
  line-height: 1.15;
  white-space: nowrap;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.lexicon-download-button {
  padding: 7px 10px;
  font-size: 13px;
  white-space: nowrap;
  line-height: 1.2;
}

.lexicon-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.table-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
}

.lexicon-entry-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(4, minmax(0, 1fr));
  gap: 10px;
  height: 100%;
  align-items: stretch;
}

.lexicon-entry-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  height: 100%;
  min-width: 0;
  padding: 12px 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #ffffff;
}

.lexicon-entry-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.lexicon-entry-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.lexicon-entry-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.lexicon-entry-id {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
}

.lexicon-entry-verb {
  min-width: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--theme-red-dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lexicon-entry-meaning {
  margin: 0;
  min-height: 32px;
  font-size: 13px;
  color: var(--text);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.lexicon-entry-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  flex-shrink: 0;
}

.lexicon-entry-actions button {
  padding: 3px 7px;
  min-width: 0;
  font-size: 11px;
  line-height: 1.1;
  box-shadow: none;
}

.pagination-total {
  white-space: nowrap;
  font-size: 13px;
}

.pagination.inline-pagination {
  flex-wrap: nowrap;
  gap: 8px;
}

.pagination-jump {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  white-space: nowrap;
  min-width: 128px;
}

.page-number-input {
  width: 64px;
  min-width: 64px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.drawer textarea { width:100%; }
.overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:flex-start; justify-content:center; padding:40px; }
.drawer {
  background:#fff;
  width:920px;
  max-width:98%;
  border-radius:6px;
  max-height: calc(100vh - 80px);
  display:flex;
  flex-direction:column;
  overflow:hidden;
}

.drawer > header {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:16px;
  border-bottom:1px solid var(--border);
  background:#fff;
  flex-shrink:0;
}

.drawer > header h3 {
  margin:0;
}

.drawer-header-actions {
  display:flex;
  align-items:center;
  gap:8px;
}

.drawer-current-item {
  max-width:240px;
  color:#475569;
  font-size:13px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.drawer-body {
  flex:1;
  min-height:0;
  overflow:auto;
  padding:16px;
}

.drawer-view-switch {
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom:12px;
}

.drawer-view-switch-buttons {
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:nowrap;
}

.drawer-view-switch-buttons > button.active {
  color:var(--theme-red-dark);
  border-color:var(--border-strong);
  background:var(--surface);
}

.drawer-auto-fill-btn {
  border:1px solid var(--theme-red);
  background:var(--theme-red);
  color:#fff;
}

.drawer-auto-fill-btn:hover {
  border-color:var(--theme-red-dark);
  background:var(--theme-red-dark);
}

.queue-panel {
  display:flex;
  flex-direction:column;
  gap:10px;
}

.queue-input-row {
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
}

.queue-input {
  width:280px;
  max-width:100%;
}

.queue-hint {
  margin:0;
  font-size:12px;
  line-height:1.5;
  color:var(--muted);
}

.queue-table-wrap {
  border:1px solid var(--border);
  border-radius:10px;
  overflow:auto;
  max-height:420px;
}

.queue-table {
  width:100%;
  table-layout:fixed;
}

.queue-table td {
  vertical-align:top;
}

.queue-table th:nth-child(1),
.queue-table td:nth-child(1) {
  width:56px;
}

.queue-table th:nth-child(2),
.queue-table td:nth-child(2) {
  width:136px;
}

.queue-table th:nth-child(3),
.queue-table td:nth-child(3) {
  width:96px;
}

.queue-table th:nth-child(5),
.queue-table td:nth-child(5) {
  width:118px;
}

.queue-table td:nth-child(2) {
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.queue-table .queue-message {
  max-width:none;
  white-space:normal;
  overflow:visible;
  text-overflow:clip;
  word-break:break-word;
  line-height:1.5;
}

.queue-table td.queue-actions-cell {
  padding-left:6px;
  padding-right:6px;
}

.queue-table td.queue-actions-cell.actions {
  gap:6px;
  justify-content:flex-start;
  align-items:flex-start;
  flex-wrap:nowrap;
}

.queue-action-btn {
  padding:6px 10px;
  line-height:1.2;
  white-space:nowrap;
}

.queue-action-btn.danger {
  color:#fff;
  border:1px solid #dc2626;
}

.queue-status {
  display:inline-flex;
  align-items:center;
  padding:2px 8px;
  border-radius:999px;
  font-size:12px;
  font-weight:600;
}

.queue-status-pending {
  color:#6f5a4d;
  background:rgba(123, 102, 88, 0.12);
}

.queue-status-processing {
  color:var(--theme-red-dark);
  background:rgba(139, 0, 18, 0.12);
}

.queue-status-success {
  color:#166534;
  background:#dcfce7;
}

.queue-status-error {
  color:#991b1b;
  background:#fee2e2;
}

.queue-status-saved {
  color:#065f46;
  background:#d1fae5;
}

.drawer-tip {
  margin:0 0 12px;
  color:var(--muted);
  font-size:13px;
}

.create-conj-list {
  border:1px solid var(--border);
  border-radius:10px;
  padding:10px;
  background:var(--surface);
}

.lexicon-edit-drawer {
  width:920px;
  min-width:920px;
}

.drawer-inline-row {
  display:grid;
  gap:12px;
  margin-bottom:12px;
}

.drawer-field-row,
.drawer-field {
  margin:0;
}

.drawer-field-row {
  margin:0;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items:start;
}

.drawer-id-field input:disabled {
  cursor:not-allowed;
  opacity:1;
}

.drawer-flags-wrap {
  display:flex;
  flex-direction:column;
  gap:10px;
}

.drawer-flags-row {
  display:grid;
  gap:10px;
}

.drawer-flags-row-four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.drawer-flags-row-three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.drawer-flag-chip {
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  min-width:0;
  padding:10px 12px;
  border:1px solid var(--border);
  border-radius:12px;
  background:#ffffff;
  box-shadow:0 1px 2px rgba(101, 0, 13, 0.06);
}

.drawer-flag-label {
  min-width:0;
  font-size:13px;
  font-weight:600;
  line-height:1.3;
  color:var(--text);
}

.drawer-flag-control {
  position:relative;
  width:38px;
  height:22px;
  flex-shrink:0;
}

.drawer-flag-input {
  position:absolute;
  inset:0;
  margin:0;
  opacity:0;
  cursor:pointer;
}

.drawer-flag-switch {
  display:block;
  width:100%;
  height:100%;
  border-radius:999px;
  background:#d9c9b6;
  box-shadow:inset 0 0 0 1px rgba(139, 0, 18, 0.18);
  transition:background-color 0.16s ease, box-shadow 0.16s ease;
}

.drawer-flag-switch::after {
  content:'';
  position:absolute;
  top:3px;
  left:3px;
  width:16px;
  height:16px;
  border-radius:50%;
  background:#fff;
  box-shadow:0 1px 2px rgba(15, 23, 42, 0.2);
  transition:transform 0.16s ease;
}

.drawer-flag-input:checked + .drawer-flag-switch {
  background:var(--primary);
  box-shadow:inset 0 0 0 1px rgba(139, 0, 18, 0.22);
}

.drawer-flag-input:checked + .drawer-flag-switch::after {
  transform:translateX(16px);
}

.drawer-flag-input:focus-visible + .drawer-flag-switch {
  outline:2px solid rgba(139, 0, 18, 0.22);
  outline-offset:2px;
}

.conj-list {
  margin-bottom:16px;
}

.conj-groups {
  display:flex;
  flex-direction:column;
  gap:12px;
}

.conj-group {
  border:1px solid var(--border);
  border-radius:12px;
  overflow:hidden;
  background:#ffffff;
  box-shadow:0 1px 2px rgba(101, 0, 13, 0.05);
}

.conj-group-header,
.conj-tense-header {
  width:100%;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  border:0;
  border-radius:0;
  box-shadow:none;
  font:inherit;
  color:inherit;
  text-align:left;
  cursor:pointer;
}

.conj-group-header {
  padding:12px 14px;
  background:#ffffff;
  border-bottom:1px solid var(--border);
}

.conj-group-title {
  font-weight:700;
  color:var(--theme-red-dark);
}

.conj-group-meta {
  font-size:12px;
  color:var(--muted);
  white-space:nowrap;
}

.conj-tense-list {
  padding:12px;
  display:flex;
  flex-direction:column;
  gap:10px;
  background:#ffffff;
}

.conj-tense-card {
  border:1px solid var(--border);
  border-radius:10px;
  overflow:hidden;
  background:#ffffff;
  box-shadow:0 1px 2px rgba(101, 0, 13, 0.04);
}

.conj-tense-header {
  padding:10px 12px;
  background:#ffffff;
  border-bottom:1px solid var(--border);
}

.conj-tense-title {
  min-width:0;
  display:flex;
  align-items:baseline;
  flex-wrap:wrap;
  gap:4px;
}

.conj-tense-es {
  font-weight:700;
  color:var(--text);
}

.conj-tense-cn {
  color:var(--muted);
}

.conj-row-list {
  padding:8px 12px 12px;
  display:flex;
  flex-direction:column;
  gap:8px;
  background:#ffffff;
}

.conj-vos-divider {
  display:flex;
  align-items:center;
  gap:8px;
  padding:6px 0 2px;
}

.conj-divider-line {
  flex:1;
  height:1px;
  background:var(--border);
}

.conj-divider-text {
  font-size:12px;
  color:var(--muted);
  white-space:nowrap;
}

.conj-row {
  display:grid;
  grid-template-columns: 176px 220px 92px 152px;
  gap:10px;
  align-items:center;
  padding:10px 12px;
  border:1px solid var(--border);
  border-radius:10px;
  background:#fffdfa;
}

.conj-row-create {
  grid-template-columns: 176px minmax(0, 1fr) 92px;
}

.conj-row-create .conj-row-value {
  width:auto;
}

.conj-row-create .conj-inline-input {
  max-width:none;
}

.conj-row-person {
  font-weight:600;
  color:var(--text);
}

.conj-row-value {
  min-width:0;
  width:220px;
}

.conj-row-value > span {
  display:block;
  color:var(--text);
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.conj-row-empty .conj-row-value {
  color:#b19e90;
}

.conj-inline-input {
  width:100%;
  max-width:220px;
  margin:0;
}

.conj-row-flag {
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:6px;
  min-width:0;
}

.conj-row-flag-label {
  font-size:12px;
  font-weight:600;
  color:var(--muted);
  white-space:nowrap;
}

.conj-row-checkbox {
  width:16px;
  height:16px;
  margin:0;
  accent-color:var(--theme-red);
}

.conj-row-checkbox[aria-disabled='true'] {
  cursor:default;
}

.conj-row-checkbox-readonly {
  pointer-events:none;
}

.conj-row-actions {
  display:flex;
  align-items:center;
  justify-content:flex-end;
  justify-self:stretch;
  gap:8px;
  width:160px;
  min-width:160px;
}

.conj-row-actions > button {
  width:76px;
  min-width:76px;
  justify-self:end;
}

.modal { background:#fff; padding:16px; border-radius:6px; width:420px; }
.field-error { color:#c33; font-size:12px; }

@media (max-width: 960px) {
  .lexicon-page {
    height: min(72vh, 700px);
  }

  .table-scroll {
    overflow: auto;
  }

  .lexicon-entry-grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    height: auto;
  }

  .drawer-field-row,
  .drawer-inline-row,
  .drawer-flags-row-four,
  .drawer-flags-row-three {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .conj-row {
    grid-template-columns: minmax(0, 1fr) 168px 92px 144px;
    gap:8px;
  }

  .conj-row-create {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 92px;
  }

  .drawer-view-switch {
    flex-direction:column;
    align-items:flex-start;
  }

  .drawer-view-switch-buttons {
    width:100%;
    flex-wrap:wrap;
  }

  .queue-input {
    width:100%;
  }

  .lexicon-edit-drawer {
    width:100%;
    min-width:0;
  }

  .queue-table th:nth-child(2),
  .queue-table td:nth-child(2) {
    width:120px;
  }

  .queue-table th:nth-child(3),
  .queue-table td:nth-child(3) {
    width:92px;
  }

  .queue-table th:nth-child(5),
  .queue-table td:nth-child(5) {
    width:112px;
  }

  .queue-table .queue-message {
    word-break:break-all;
  }

  .lexicon-page .header-row,
  .toolbar {
    flex-wrap: wrap;
  }

  .toolbar {
    width: 100%;
  }
}
</style>
