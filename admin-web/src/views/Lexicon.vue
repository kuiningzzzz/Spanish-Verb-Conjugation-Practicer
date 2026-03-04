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
          <form id="lexicon-edit-form" @submit.prevent="submitSave">
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
              </label>

              <label class="drawer-field">
                副动词
                <input v-model="form.gerund" />
              </label>
            </div>

            <div class="drawer-inline-row drawer-field-row">
              <label class="drawer-field">
                过去分词
                <input v-model="form.participle" />
              </label>

              <label class="drawer-field">
                过去分词其它形式
                <input v-model="form.participle_forms" />
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
            <table class="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>时态 (tense)</th>
                  <th>语气 (mood)</th>
                  <th>人称 (person)</th>
                  <th>变位形式</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in conjugations" :key="c.id">
                  <td>{{ c.id }}</td>
                  <td>{{ c.tense }}</td>
                  <td>{{ c.mood }}</td>
                  <td>{{ c.person }}</td>
                  <td class="desc">{{ c.conjugated_form }}</td>
                  <td class="actions">
                    <button class="ghost" @click="openEditConj(c)">编辑</button>
                    <button class="danger" @click="confirmDeleteConj(c)">删除</button>
                  </td>
                </tr>
                <tr v-if="!conjugations.length">
                  <td colspan="6" class="empty">暂无变位</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="conj-form">
            <h4>{{ editingConjId ? '编辑变位' : '新建变位' }}</h4>
            <form @submit.prevent="submitConjSave">
              <label>
                时态 (tense)
                <input v-model="conjForm.tense" />
              </label>
              <label>
                语气 (mood)
                <input v-model="conjForm.mood" />
              </label>
              <label>
                人称 (person)
                <input v-model="conjForm.person" />
              </label>
              <label>
                变位形式
                <input v-model="conjForm.conjugated_form" />
              </label>
              <label>
                Irreg. 不规则
                <input type="checkbox" v-model="conjForm.is_irregular" />
              </label>
              <div style="margin-top:8px;display:flex;gap:8px;">
                <button type="submit" :disabled="conjSaving">保存</button>
                <button type="button" class="ghost" @click="resetConjForm">重置</button>
              </div>
            </form>
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
const formErrors = reactive({});

const toast = reactive({ visible: false, message: '', type: 'info' });

// conjugations state
const conjDrawerOpen = ref(false);
const activeVerb = ref(null);
const conjugations = ref([]);
const editingConjId = ref(null);
const conjForm = reactive({ tense: '', mood: '', person: '', conjugated_form: '', is_irregular: false });
const conjSaving = ref(false);
const conjDeleting = ref(false);


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
  resetErrors(formErrors);
  drawerOpen.value = true;
}

// 变位相关方法
function openConjugations(verb) {
  activeVerb.value = verb;
  editingConjId.value = null;
  resetConjForm();
  fetchConjugations(verb.id);
  conjDrawerOpen.value = true;
}

function closeConjDrawer() {
  conjDrawerOpen.value = false;
  activeVerb.value = null;
  conjugations.value = [];
}

async function fetchConjugations(verbId) {
  try {
    const data = await apiRequest(`/verbs/${verbId}/conjugations`);
    conjugations.value = data.rows || [];
  } catch (err) {
    handleApiError(err);
  }
}

function resetConjForm() {
  editingConjId.value = null;
  conjForm.tense = '';
  conjForm.mood = '';
  conjForm.person = '';
  conjForm.conjugated_form = '';
  conjForm.is_irregular = false;
}

function openEditConj(c) {
  editingConjId.value = c.id;
  conjForm.tense = c.tense || '';
  conjForm.mood = c.mood || '';
  conjForm.person = c.person || '';
  conjForm.conjugated_form = c.conjugated_form || '';
  conjForm.is_irregular = !!c.is_irregular;
}

function confirmDeleteConj(c) {
  if (!confirm('确认删除该变位？')) return;
  submitDeleteConj(c.id);
}

async function submitConjSave() {
  if (!activeVerb.value) return;
  if (!conjForm.tense || !conjForm.mood || !conjForm.person || !conjForm.conjugated_form) {
    showToast('请填写时态/语气/人称/变位形式', 'error');
    return;
  }
  conjSaving.value = true;
  try {
    if (editingConjId.value) {
      await apiRequest(`/conjugations/${editingConjId.value}`, { method: 'PUT', body: conjForm });
      showToast('变位已更新', 'success');
    } else {
      await apiRequest(`/verbs/${activeVerb.value.id}/conjugations`, { method: 'POST', body: conjForm });
      showToast('已创建变位', 'success');
    }
    fetchConjugations(activeVerb.value.id);
    resetConjForm();
  } catch (err) {
    handleApiError(err);
  } finally {
    conjSaving.value = false;
  }
}

async function submitDeleteConj(conjId) {
  conjDeleting.value = true;
  try {
    await apiRequest(`/conjugations/${conjId}`, { method: 'DELETE' });
    showToast('删除成功', 'success');
    if (activeVerb.value) fetchConjugations(activeVerb.value.id);
  } catch (err) {
    handleApiError(err);
  } finally {
    conjDeleting.value = false;
  }
}

async function openEdit(item) {
  resetErrors(formErrors);
  try {
    const data = await apiRequest(`/verbs/${item.id}`);
    editingId.value = data.id;
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

function validatePayload(value) {
  if (!value) return true;
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    return false;
  }
}

async function submitSave() {
  resetErrors(formErrors);
  if (!form.infinitive || !form.infinitive.trim()) {
    formErrors.infinitive = '请输入动词原形';
  }
  if (Object.values(formErrors).some((v) => v)) return;

  saving.value = true;
  const supportsEnabled = form.has_tr_use;
  const payload = {
    infinitive: form.infinitive.trim(),
    meaning: form.meaning || null,
    conjugation_type: form.conjugation_type || 1,
    is_irregular: form.is_irregular ? 1 : 0,
    is_reflexive: form.is_reflexive ? 1 : 0,
    has_tr_use: form.has_tr_use ? 1 : 0,
    has_intr_use: form.has_intr_use ? 1 : 0,
    supports_do: supportsEnabled && form.supports_do ? 1 : 0,
    supports_io: supportsEnabled && form.supports_io ? 1 : 0,
    supports_do_io: supportsEnabled && form.supports_do_io ? 1 : 0,
    gerund: form.gerund || null,
    participle: form.participle || null,
    participle_forms: form.participle_forms || null,
    lesson_number: form.lesson_number || null,
    textbook_volume: form.textbook_volume || 1,
    frequency_level: form.frequency_level || 1
  };
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

.conj-list .table { width:100%; table-layout: fixed; border-collapse:collapse; }
.conj-list td.desc { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
/* 固定最后一列宽度，避免滚动时列错位 */
.conj-list th:nth-child(6), .conj-list td.actions { width:180px; flex-shrink:0; }
.conj-list td.actions { display:flex; gap:8px; align-items:center; justify-content:flex-start; white-space:nowrap; }
.conj-list td.actions > button { min-width:88px; padding:6px 10px; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; margin:0; }
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

  .lexicon-page .header-row,
  .toolbar {
    flex-wrap: wrap;
  }

  .toolbar {
    width: 100%;
  }
}
</style>
