<template>
  <section class="card lexicon-page">
    <div class="header-row">
      <div>
        <h2>词库条目管理</h2>
        <p class="muted">管理所有动词词库条目信息</p>
        <p class="muted total-count">共 {{ total }} 条</p>
      </div>
      <div class="toolbar">
        <input v-model.trim="keyword" placeholder="搜索动词/释义/ID" />
        <button class="ghost" @click="refresh" :disabled="loading">刷新</button>
        <button @click="openCreate">新建条目</button>
      </div>
    </div>

    <div v-if="error" class="error-block">
      <p class="error">{{ error }}</p>
      <button class="ghost" @click="refresh">重试</button>
    </div>

    <div v-else>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else>
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>原形</th>
              <th>释义</th>
              <th>变位</th>
              <th>课号</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredRows" :key="item.id">
              <td>{{ item.id }}</td>
              <td>{{ item.infinitive }}</td>
              <td class="desc">{{ item.meaning || '-' }}</td>
              <td>{{ conjugationLabel(item.conjugation_type) }}</td>
              <td>{{ item.lesson_number || '-' }}</td>
              <td class="actions">
                <button class="ghost" @click="openEdit(item)">编辑</button>
                <button class="ghost" @click="openConjugations(item)">变位</button>
                <button class="danger" @click="confirmDelete(item)">删除</button>
              </td>
            </tr>
            <tr v-if="!filteredRows.length">
              <td colspan="6" class="empty">暂无条目</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="pagination" v-if="total > pageSize">
      <button class="ghost" :disabled="page === 1 || loading" @click="changePage(page - 1)">上一页</button>
      <span>第 {{ page }} / {{ totalPages }} 页</span>
      <button class="ghost" :disabled="page === totalPages || loading" @click="changePage(page + 1)">下一页</button>
    </div>

    <div v-if="drawerOpen" class="overlay" @click.self="closeDrawer">
      <div class="drawer">
        <header>
          <h3>{{ editingId ? '编辑动词' : '新建动词' }}</h3>
          <button class="ghost" @click="closeDrawer">关闭</button>
        </header>
        <form @submit.prevent="submitSave">
          <label>
            原形 (infinitive)
            <input v-model="form.infinitive" />
            <span v-if="formErrors.infinitive" class="field-error">{{ formErrors.infinitive }}</span>
          </label>

          <label>
            释义 (meaning)
            <input v-model="form.meaning" />
          </label>

          <label>
            变位类型
            <select v-model.number="form.conjugation_type">
              <option :value="1">-ar</option>
              <option :value="2">-er</option>
              <option :value="3">-ir</option>
            </select>
          </label>

          <label>
            Irreg. 不规则
            <input type="checkbox" v-model="form.is_irregular" />
          </label>

          <label>
            Prnl. 自反
            <input type="checkbox" v-model="form.is_reflexive" />
          </label>

          <label>
            课号
            <input v-model.number="form.lesson_number" type="number" />
          </label>

          <label>
            教材卷号
            <input v-model.number="form.textbook_volume" type="number" />
          </label>

          <label>
            频率等级
            <input v-model.number="form.frequency_level" type="number" />
          </label>

          <label>
            副动词 (gerund)
            <input v-model="form.gerund" />
          </label>

          <label>
            过去分词 (participle)
            <input v-model="form.participle" />
          </label>

          <label>
            过去分词其它形式 (participle_forms)
            <input v-model="form.participle_forms" />
          </label>

          <div class="drawer-actions">
            <button type="submit" :disabled="saving">保存</button>
            <button type="button" class="ghost" @click="closeDrawer">取消</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 变位抽屉 -->
    <div v-if="conjDrawerOpen" class="overlay" @click.self="closeConjDrawer">
      <div class="drawer">
        <header>
          <h3>动词：{{ activeVerb?.infinitive || '' }} 的变位</h3>
          <button class="ghost" @click="closeConjDrawer">关闭</button>
        </header>

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

    <div v-if="deleteDialog" class="overlay" @click.self="closeDelete">
      <div class="modal">
        <h3>确认删除</h3>
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

function conjugationLabel(val) {
  if (val === 1) return '-ar';
  if (val === 2) return '-er';
  if (val === 3) return '-ir';
  return String(val || '-')
}

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

function refresh() {
  fetchRows();
}

function changePage(p) {
  page.value = Math.min(Math.max(p, 1), totalPages.value);
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
  const payload = {
    infinitive: form.infinitive.trim(),
    meaning: form.meaning || null,
    conjugation_type: form.conjugation_type || 1,
    is_irregular: form.is_irregular ? 1 : 0,
    is_reflexive: form.is_reflexive ? 1 : 0,
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
.lexicon-page .header-row { display:flex; justify-content:space-between; align-items:center; gap:16px; }
.toolbar { display:flex; gap:8px; align-items:center; }
.table td.desc { max-width:360px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.drawer textarea { width:100%; }
.drawer-actions { display:flex; gap:8px; margin-top:12px; }
.overlay { position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:flex-start; justify-content:center; padding:40px; }
.drawer { background:#fff; width:920px; max-width:98%; padding:16px; border-radius:6px; max-height: calc(100vh - 80px); overflow:auto; }
.conj-list { max-height: 55vh; overflow:auto; }
.conj-list .table { width:100%; table-layout: fixed; border-collapse:collapse; }
.conj-list td.desc { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
/* 固定最后一列宽度，避免滚动时列错位 */
.conj-list th:nth-child(6), .conj-list td.actions { width:180px; flex-shrink:0; }
.conj-list td.actions { display:flex; gap:8px; align-items:center; justify-content:flex-start; white-space:nowrap; }
.conj-list td.actions > button { min-width:88px; padding:6px 10px; white-space:nowrap; display:inline-flex; align-items:center; justify-content:center; margin:0; }
.modal { background:#fff; padding:16px; border-radius:6px; width:420px; }
.field-error { color:#c33; font-size:12px; }
</style>
