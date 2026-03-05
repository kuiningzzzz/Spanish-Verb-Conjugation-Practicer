<template>
  <section class="card lexicon-page">
    <div class="header-row">
      <div class="header-copy">
        <h2>词库条目管理</h2>
      </div>
      <div class="toolbar">
        <div class="toolbar-left">
          <input v-model.trim="keyword" placeholder="搜索动词/释义/ID" />
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
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>原形</th>
              <th>释义</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredRows" :key="item.id">
              <td>{{ item.id }}</td>
              <td>{{ item.infinitive }}</td>
              <td class="desc">{{ item.meaning || '-' }}</td>
              <td class="actions">
                <button class="ghost" @click="openEdit(item)">编辑</button>
                <button class="ghost" @click="openConjugations(item)">变位</button>
                <button class="danger" @click="confirmDelete(item)">删除</button>
              </td>
            </tr>
            <tr v-if="!filteredRows.length">
              <td colspan="4" class="empty">暂无条目</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="drawerOpen" class="overlay">
      <div class="drawer lexicon-edit-drawer">
        <header>
          <h3>{{ editingId ? '编辑动词' : '新建动词' }}</h3>
          <div class="drawer-header-actions">
            <button type="submit" form="lexicon-edit-form" :disabled="saving">保存</button>
            <button class="ghost" @click="closeDrawer">关闭</button>
          </div>
        </header>
        <div class="drawer-body">
          <div v-if="isCreateMode" class="drawer-view-switch" role="tablist" aria-label="新建动词内容切换">
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
              <button type="button" class="drawer-auto-fill-btn" @click="handleAutoFillPlaceholder">自动补充</button>
            </div>
            <p class="drawer-ai-note">
              <span>输入动词原型后，点击自动补充按钮由AI自动补充各字段。</span>
              <span>AI可能会犯错，请核查相关信息。</span>
            </p>
          </div>

          <form id="lexicon-edit-form" @submit.prevent="submitSave">
            <template v-if="!isCreateMode || createDrawerView === 'details'">
              <div class="drawer-inline-row drawer-field-row">
                <label class="drawer-field drawer-id-field">
                  动词ID
                  <input :value="editingId || '自动生成'" disabled />
                </label>

                <label class="drawer-field">
                  原形
                  <input v-model="form.infinitive" />
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

            <template v-else>
              <p class="drawer-tip">请填写全部语气、时态、人称的变位后再保存词条。</p>
              <div class="conj-list create-conj-list">
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

    <div v-if="toast.visible" class="toast" :class="toast.type">{{ toast.message }}</div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue';
import { apiRequest, ApiError } from '../utils/apiClient';

const rows = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const pageJump = ref(1);
const keyword = ref('');
const loading = ref(false);
const error = ref('');

const drawerOpen = ref(false);
const editingId = ref(null);
const saving = ref(false);
const deleting = ref(false);
const deleteDialog = ref(null);
const createDrawerView = ref('details');

const form = reactive({
  infinitive: '',
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
});
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
    '前过去时': 8,
    '先过去时': 8
  },
  '虚拟式': {
    '虚拟现在时': 1,
    '虚拟过去时': 2,
    '虚拟现在完成时': 3,
    '虚拟过去完成时': 4,
    '虚拟将来未完成时': 5,
    '虚拟将来时': 5,
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
    '前过去时': { es: 'Pretérito Anterior', cn: '陈述式 前过去时' },
    '先过去时': { es: 'Pretérito Anterior', cn: '陈述式 前过去时' }
  },
  '虚拟式': {
    '虚拟现在时': { es: 'Presente', cn: '虚拟式 现在时' },
    '虚拟过去时': { es: 'Pretérito Imperfecto', cn: '虚拟式 过去未完成时' },
    '虚拟现在完成时': { es: 'Pretérito Perfecto', cn: '虚拟式 现在完成时' },
    '虚拟过去完成时': { es: 'Pretérito Pluscuamperfecto', cn: '虚拟式 过去完成时' },
    '虚拟将来未完成时': { es: 'Futuro', cn: '虚拟式 将来未完成时' },
    '虚拟将来时': { es: 'Futuro', cn: '虚拟式 将来未完成时' },
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
  '陈述式|先过去时',
  '虚拟式|虚拟将来未完成时',
  '虚拟式|虚拟将来时',
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
      '先过去时': '先过去时',
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
      '虚拟将来时': '虚拟将来时',
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

function resetCreateConjDrafts() {
  Object.keys(createConjDrafts).forEach((key) => {
    delete createConjDrafts[key];
  });

  Object.keys(CONJ_TENSE_ORDER).forEach((moodKey) => {
    Object.keys(CONJ_TENSE_ORDER[moodKey] || {}).forEach((tenseKey) => {
      getConjPersonSlots(moodKey, tenseKey).forEach((person) => {
        const key = getConjCompositeKey(moodKey, tenseKey, person);
        createConjDrafts[key] = {
          conjugated_form: '',
          is_irregular: false
        };
      });
    });
  });
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
  createDrawerView.value = view === 'conjugations' ? 'conjugations' : 'details';
}

function handleAutoFillPlaceholder() {
  showToast('自动补充功能暂未接入', 'info');
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
    const params = { limit: pageSize.value, offset: (page.value - 1) * pageSize.value };
    const q = keyword.value.trim();
    if (q) params.q = q;
    const data = await apiRequest('/verbs', { params });
    rows.value = data.rows || [];
    total.value = data.total || 0;
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

watch(() => form.has_tr_use, (enabled) => {
  if (enabled) return;
  form.supports_do = false;
  form.supports_io = false;
  form.supports_do_io = false;
});

function refresh() {
  fetchRows();
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

function openCreate() {
  editingId.value = null;
  createDrawerView.value = 'details';
  form.infinitive = '';
  form.meaning = '';
  form.conjugation_type = 1;
  form.is_irregular = false;
  form.is_reflexive = false;
  form.has_tr_use = false;
  form.has_intr_use = false;
  form.supports_do = false;
  form.supports_io = false;
  form.supports_do_io = false;
  form.lesson_number = null;
  form.textbook_volume = 1;
  form.frequency_level = 1;
  form.gerund = '';
  form.participle = '';
  form.participle_forms = '';
  resetCreateConjDrafts();
  resetCreateConjExpandState();
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
    if (!form.has_tr_use) {
      form.supports_do = false;
      form.supports_io = false;
      form.supports_do_io = false;
    }
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
  drawerOpen.value = false;
  createDrawerView.value = 'details';
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
    if (!form.participle_forms || !form.participle_forms.trim()) {
      formErrors.participle_forms = '请输入过去分词其它形式';
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

function buildCreateConjugationPayloads() {
  const rows = [];
  createConjugationSections.value.forEach((group) => {
    group.tenses.forEach((tense) => {
      tense.rows.forEach((row) => {
        rows.push({
          mood: group.moodKey,
          tense: tense.tenseKey,
          person: row.person,
          conjugated_form: String(row.draft?.conjugated_form || '').trim(),
          is_irregular: row.draft?.is_irregular ? 1 : 0
        });
      });
    });
  });
  return rows;
}

async function submitSave() {
  const creating = isCreateMode.value;
  if (!validateVerbForm(creating)) {
    if (creating) {
      switchCreateDrawerView('details');
      showToast('请先补全编辑字段中的全部必填项', 'error');
    }
    return;
  }

  let createConjugations = [];
  if (creating) {
    const missingConjugations = findMissingCreateConjugations();
    if (missingConjugations.length) {
      const firstMissing = missingConjugations[0];
      switchCreateDrawerView('conjugations');
      revealCreateConjRow(firstMissing.moodKey, firstMissing.tenseKey);
      showToast(`请先填写全部变位（仍缺 ${missingConjugations.length} 项）`, 'error');
      return;
    }
    createConjugations = buildCreateConjugationPayloads();
  }

  saving.value = true;
  const supportsEnabled = form.has_tr_use;
  const meaning = String(form.meaning || '').trim();
  const gerund = String(form.gerund || '').trim();
  const participle = String(form.participle || '').trim();
  const participleForms = String(form.participle_forms || '').trim();
  const payload = {
    infinitive: form.infinitive.trim(),
    meaning: meaning || null,
    conjugation_type: form.conjugation_type || 1,
    is_irregular: form.is_irregular ? 1 : 0,
    is_reflexive: form.is_reflexive ? 1 : 0,
    has_tr_use: form.has_tr_use ? 1 : 0,
    has_intr_use: form.has_intr_use ? 1 : 0,
    supports_do: supportsEnabled && form.supports_do ? 1 : 0,
    supports_io: supportsEnabled && form.supports_io ? 1 : 0,
    supports_do_io: supportsEnabled && form.supports_do_io ? 1 : 0,
    gerund: gerund || null,
    participle: participle || null,
    participle_forms: participleForms || null,
    lesson_number: form.lesson_number || null,
    textbook_volume: form.textbook_volume || 1,
    frequency_level: form.frequency_level || 1
  };
  if (creating) {
    payload.conjugations = createConjugations;
  }
  try {
    if (editingId.value) {
      await apiRequest(`/verbs/${editingId.value}`, { method: 'PUT', body: payload });
      showToast('保存成功', 'success');
    } else {
      await apiRequest('/verbs', { method: 'POST', body: payload });
      showToast('创建成功', 'success');
    }
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
  gap: 12px;
  flex-wrap: nowrap;
}

.header-copy h2 {
  margin: 0;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: nowrap;
  margin-left: auto;
  width: auto;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
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
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.table-scroll .table th {
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}

.pagination-total {
  white-space: nowrap;
}

.pagination.inline-pagination {
  flex-wrap: nowrap;
}

.pagination-jump {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  white-space: nowrap;
  min-width: 160px;
}

.page-number-input {
  width: 88px;
  min-width: 88px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.table td.desc { max-width:360px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
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
  color:#1d4ed8;
  border-color:#3b82f6;
  background:#eff6ff;
}

.drawer-auto-fill-btn {
  border:1px solid #2563eb;
  background:#2563eb;
  color:#fff;
}

.drawer-auto-fill-btn:hover {
  border-color:#1d4ed8;
  background:#1d4ed8;
}

.drawer-ai-note {
  margin:4px 0 0;
  max-width:340px;
  font-size:12px;
  line-height:1.5;
  color:#64748b;
  text-align:right;
}

.drawer-ai-note > span {
  display:block;
}

.drawer-tip {
  margin:0 0 12px;
  color:#475569;
  font-size:13px;
}

.create-conj-list {
  border:1px solid var(--border);
  border-radius:10px;
  padding:10px;
  background:#f8fafc;
}

.lexicon-edit-drawer {
  width:700px;
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
  background:linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  box-shadow:0 1px 2px rgba(15, 23, 42, 0.04);
}

.drawer-flag-label {
  min-width:0;
  font-size:13px;
  font-weight:600;
  line-height:1.3;
  color:#334155;
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
  background:#d7dee8;
  box-shadow:inset 0 0 0 1px rgba(148, 163, 184, 0.35);
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
  box-shadow:inset 0 0 0 1px rgba(37, 99, 235, 0.18);
}

.drawer-flag-input:checked + .drawer-flag-switch::after {
  transform:translateX(16px);
}

.drawer-flag-input:focus-visible + .drawer-flag-switch {
  outline:2px solid rgba(37, 99, 235, 0.25);
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
  border:1px solid #c7d7eb;
  border-radius:12px;
  overflow:hidden;
  background:#eef4fb;
  box-shadow:0 1px 2px rgba(15, 23, 42, 0.04);
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
  background:linear-gradient(180deg, #dcecff 0%, #e7f1ff 100%);
  border-bottom:1px solid #c8d9ef;
}

.conj-group-title {
  font-weight:700;
  color:#1e293b;
}

.conj-group-meta {
  font-size:12px;
  color:#64748b;
  white-space:nowrap;
}

.conj-tense-list {
  padding:12px;
  display:flex;
  flex-direction:column;
  gap:10px;
  background:#f4f8fc;
}

.conj-tense-card {
  border:1px solid #d7e3ef;
  border-radius:10px;
  overflow:hidden;
  background:#fbfdff;
  box-shadow:0 1px 2px rgba(15, 23, 42, 0.03);
}

.conj-tense-header {
  padding:10px 12px;
  background:#f8fbff;
  border-bottom:1px solid #e1eaf3;
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
  color:#0f172a;
}

.conj-tense-cn {
  color:#475569;
}

.conj-row-list {
  padding:8px 12px 12px;
  display:flex;
  flex-direction:column;
  gap:8px;
  background:#edf3f8;
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
  background:#e2e8f0;
}

.conj-divider-text {
  font-size:12px;
  color:#64748b;
  white-space:nowrap;
}

.conj-row {
  display:grid;
  grid-template-columns: 176px 220px 92px 152px;
  gap:10px;
  align-items:center;
  padding:10px 12px;
  border:1px solid #dbe6f1;
  border-radius:10px;
  background:#fff;
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
  color:#334155;
}

.conj-row-value {
  min-width:0;
  width:220px;
}

.conj-row-value > span {
  display:block;
  color:#0f172a;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.conj-row-empty .conj-row-value {
  color:#94a3b8;
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
  color:#64748b;
  white-space:nowrap;
}

.conj-row-checkbox {
  width:16px;
  height:16px;
  margin:0;
  accent-color:#2563eb;
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

  .drawer-ai-note {
    max-width:none;
    text-align:left;
    margin-top:0;
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
