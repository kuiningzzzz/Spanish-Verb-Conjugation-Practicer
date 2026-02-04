<template>
  <section class="card db-page">
    <div class="users-header">
      <div>
        <h2>数据库管理</h2>
        <p class="muted">仅 dev 可进行备份、还原与导入操作。</p>
      </div>
      <div class="toolbar">
        <div class="toggle-group">
          <span class="toggle-label" :class="{ active: activeTab === 'backup' }">备份</span>
          <label class="switch">
            <input type="checkbox" v-model="isImportMode" />
            <span class="slider"></span>
          </label>
          <span class="toggle-label" :class="{ active: activeTab === 'import' }">导入</span>
        </div>
        <button class="ghost" @click="refresh" :disabled="loading">刷新</button>
        <button v-if="activeTab === 'backup'" @click="openBackupCreate">新增备份</button>
        <button v-else @click="openImportDialog">导入 .zip</button>
      </div>
    </div>

    <div v-if="error" class="error-block">
      <p class="error">{{ error }}</p>
      <button class="ghost" @click="refresh">重试</button>
    </div>

    <div v-else>
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else>
        <div v-if="activeTab === 'backup'" class="db-panel">
          <div class="panel-header">
            <h3>备份记录</h3>
            <span class="muted">共 {{ backups.length }} 条</span>
          </div>
          <table class="table compact-table">
            <thead>
              <tr>
                <th>备份时间</th>
                <th>备份文件</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in backups" :key="record.id">
                <td>{{ record.createdAt }}</td>
                <td>
                  <div class="file-grid">
                    <span v-for="file in sortedFiles(record.files)" :key="file.key" class="list-line">
                      {{ file.label }}
                    </span>
                  </div>
                </td>
                <td class="actions">
                  <button class="ghost" @click="downloadBackup(record)">下载</button>
                  <button class="danger" @click="confirmRestore(record)">还原</button>
                  <button class="warning" @click="confirmDeleteBackup(record)">删除</button>
                </td>
              </tr>
              <tr v-if="!backups.length">
                <td colspan="3" class="empty">暂无备份记录</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="db-panel">
          <div class="panel-header">
            <h3>导入记录</h3>
            <span class="muted">共 {{ imports.length }} 条</span>
          </div>
          <table class="table compact-table">
            <thead>
              <tr>
                <th>导入时间</th>
                <th>导入文件</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="record in imports" :key="record.id">
                <td>{{ record.createdAt }}</td>
                <td>
                  <div class="file-grid">
                    <span v-for="file in sortedNames(record.files)" :key="file" class="list-line">
                      {{ file }}
                    </span>
                  </div>
                </td>
                <td class="actions">
                  <button class="warning" @click="confirmDeleteImport(record)">删除</button>
                </td>
              </tr>
              <tr v-if="!imports.length">
                <td colspan="3" class="empty">暂无导入记录</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="backupDialogOpen" class="overlay" @click.self="closeBackupCreate">
      <div class="drawer">
        <header>
          <h3>新增备份</h3>
          <button class="ghost" @click="closeBackupCreate">关闭</button>
        </header>
        <form @submit.prevent="submitBackup">
          <div class="list-editor">
            <div class="list-title">选择需要备份的文件</div>
            <label v-for="file in fileOptions" :key="file.key" class="checkbox-row">
              <input type="checkbox" v-model="backupSelection[file.key]" />
              <span>{{ file.label }}</span>
            </label>
            <div class="hint">默认全选，可根据需求调整。</div>
          </div>
          <button type="submit" :disabled="saving">保存备份</button>
        </form>
      </div>
    </div>

    <div v-if="deleteBackupDialog" class="overlay" @click.self="closeDeleteBackup">
      <div class="modal">
        <h3>确认删除备份</h3>
        <p>即将删除备份：<strong>{{ deleteBackupDialog.createdAt }}</strong></p>
        <p class="muted">此操作会同时删除备份文件，且不可恢复。</p>
        <div class="modal-actions">
          <button class="ghost" @click="closeDeleteBackup">取消</button>
          <button class="warning" :disabled="saving" @click="submitDeleteBackup">确认删除</button>
        </div>
      </div>
    </div>

    <div v-if="restoreDialog" class="overlay" @click.self="closeRestore">
      <div class="modal warning">
        <h3>确认还原备份</h3>
        <p>将使用备份覆盖当前数据：<strong>{{ restoreDialog.createdAt }}</strong></p>
        <p class="muted">还原会丢失未备份的数据，请确认无误。</p>
        <div class="modal-actions">
          <button class="ghost" @click="closeRestore">取消</button>
          <button class="danger" :disabled="saving" @click="submitRestore">确认还原</button>
        </div>
      </div>
    </div>

    <div v-if="importDialogOpen" class="overlay" @click.self="closeImportDialog">
      <div class="drawer">
        <header>
          <h3>导入数据</h3>
          <button class="ghost" @click="closeImportDialog">关闭</button>
        </header>
        <form @submit.prevent="confirmImport">
          <div class="warning-banner">
            导入会覆盖现有数据，强烈建议先进行一次备份。
          </div>
          <label>
            选择 .zip 文件
            <input type="file" accept=".zip" @change="handleImportFile" />
            <span class="hint" v-if="importFileName">已选择：{{ importFileName }}</span>
            <span v-if="formErrors.importFile" class="field-error">{{ formErrors.importFile }}</span>
          </label>
          <button type="submit" :disabled="saving">开始导入</button>
        </form>
      </div>
    </div>

    <div v-if="importConfirmDialog" class="overlay" @click.self="closeImportConfirm">
      <div class="modal warning">
        <h3>确认导入</h3>
        <p>导入将覆盖现有数据，请确认已完成备份。</p>
        <div class="modal-actions">
          <button class="ghost" @click="closeImportConfirm">取消</button>
          <button class="danger" :disabled="saving" @click="submitImport">确认导入</button>
        </div>
      </div>
    </div>

    <div v-if="deleteImportDialog" class="overlay" @click.self="closeDeleteImport">
      <div class="modal">
        <h3>确认删除导入记录</h3>
        <p>即将删除导入记录：<strong>{{ deleteImportDialog.createdAt }}</strong></p>
        <p class="muted">删除导入记录不会还原到导入前的状态，请务必在导入前进行备份。</p>
        <div class="modal-actions">
          <button class="ghost" @click="closeDeleteImport">取消</button>
          <button class="warning" :disabled="saving" @click="submitDeleteImport">确认删除</button>
        </div>
      </div>
    </div>

    <div v-if="toast.visible" class="toast" :class="toast.type">{{ toast.message }}</div>
  </section>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { apiRequest, ApiError, getApiBase } from '../utils/apiClient';
import { useAuth } from '../composables/useAuth';

const { logout } = useAuth();
const router = useRouter();

const fileOptions = ref([]);
const backups = ref([]);
const imports = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');

const backupDialogOpen = ref(false);
const backupSelection = reactive({});

const deleteBackupDialog = ref(null);
const restoreDialog = ref(null);

const importDialogOpen = ref(false);
const importConfirmDialog = ref(false);
const importFile = ref(null);
const importFileName = ref('');
const deleteImportDialog = ref(null);
const activeTab = ref('backup');
const isImportMode = computed({
  get: () => activeTab.value === 'import',
  set: (value) => {
    activeTab.value = value ? 'import' : 'backup';
  }
});

const formErrors = reactive({});

const toast = reactive({
  visible: false,
  message: '',
  type: 'info'
});

function showToast(message, type = 'info') {
  toast.message = message;
  toast.type = type;
  toast.visible = true;
  setTimeout(() => {
    toast.visible = false;
  }, 3000);
}

function resetErrors() {
  Object.keys(formErrors).forEach((key) => {
    formErrors[key] = '';
  });
}

function handleApiError(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      showToast('登录已过期', 'error');
      logout();
      router.push({ name: 'Login', query: { error: 'expired' } });
      return;
    }
    if (err.status === 403) {
      showToast(err.message || '无权限执行该操作', 'error');
      return;
    }
    if (err.isNetworkError) {
      showToast('网络异常：无法连接到服务器（检查 API_BASE_URL/代理/CORS）', 'error');
      return;
    }
    showToast(err.message || '操作失败', 'error');
    return;
  }
  showToast('网络异常：无法连接到服务器（检查 API_BASE_URL/代理/CORS）', 'error');
}

function sortedFiles(files) {
  if (!Array.isArray(files)) return [];
  return [...files].sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
}

function sortedNames(files) {
  if (!Array.isArray(files)) return [];
  return [...files].sort((a, b) => String(a).localeCompare(String(b)));
}

async function fetchFiles() {
  const data = await apiRequest('/db-files');
  fileOptions.value = Array.isArray(data?.files) ? data.files : [];
  fileOptions.value.forEach((file) => {
    if (backupSelection[file.key] === undefined) {
      backupSelection[file.key] = true;
    }
  });
}

async function fetchBackups() {
  const data = await apiRequest('/db-backups');
  backups.value = Array.isArray(data?.records) ? data.records : [];
}

async function fetchImports() {
  const data = await apiRequest('/db-imports');
  imports.value = Array.isArray(data?.records) ? data.records : [];
}

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    await Promise.all([fetchFiles(), fetchBackups(), fetchImports()]);
  } catch (err) {
    error.value = err.message || '加载失败';
    handleApiError(err);
  } finally {
    loading.value = false;
  }
}

function openBackupCreate() {
  backupDialogOpen.value = true;
}

function closeBackupCreate() {
  backupDialogOpen.value = false;
}

async function submitBackup() {
  resetErrors();
  const selected = fileOptions.value.filter((file) => backupSelection[file.key]).map((file) => file.key);
  if (!selected.length) {
    formErrors.backup = '请选择至少一个文件';
    showToast('请选择至少一个文件', 'error');
    return;
  }
  saving.value = true;
  try {
    await apiRequest('/db-backups', {
      method: 'POST',
      body: { files: selected }
    });
    showToast('备份已创建', 'success');
    closeBackupCreate();
    fetchBackups();
  } catch (err) {
    handleApiError(err);
  } finally {
    saving.value = false;
  }
}

function confirmDeleteBackup(record) {
  deleteBackupDialog.value = record;
}

function closeDeleteBackup() {
  deleteBackupDialog.value = null;
}

async function submitDeleteBackup() {
  if (!deleteBackupDialog.value) return;
  saving.value = true;
  try {
    await apiRequest(`/db-backups/${deleteBackupDialog.value.id}`, { method: 'DELETE' });
    showToast('备份记录已删除', 'success');
    closeDeleteBackup();
    fetchBackups();
  } catch (err) {
    handleApiError(err);
  } finally {
    saving.value = false;
  }
}

async function downloadBackup(record) {
  if (!record) return;
  try {
    const data = await apiRequest(`/db-backups/${record.id}/download-link`);
    if (!data?.url) {
      showToast('下载链接获取失败', 'error');
      return;
    }
    window.open(data.url, '_blank');
  } catch (err) {
    handleApiError(err);
  }
}

function confirmRestore(record) {
  restoreDialog.value = record;
}

function closeRestore() {
  restoreDialog.value = null;
}

async function submitRestore() {
  if (!restoreDialog.value) return;
  saving.value = true;
  try {
    await apiRequest(`/db-backups/${restoreDialog.value.id}/restore`, { method: 'POST' });
    showToast('备份已还原', 'success');
    closeRestore();
  } catch (err) {
    handleApiError(err);
  } finally {
    saving.value = false;
  }
}

function openImportDialog() {
  resetErrors();
  importFile.value = null;
  importFileName.value = '';
  importDialogOpen.value = true;
}

function closeImportDialog() {
  importDialogOpen.value = false;
}

function handleImportFile(event) {
  const file = event.target.files?.[0];
  importFile.value = file || null;
  importFileName.value = file?.name || '';
}

function confirmImport() {
  resetErrors();
  if (!importFile.value) {
    formErrors.importFile = '请选择 .zip 文件';
    return;
  }
  importConfirmDialog.value = true;
}

function closeImportConfirm() {
  importConfirmDialog.value = false;
}

async function submitImport() {
  if (!importFile.value) return;
  saving.value = true;
  try {
    const token = localStorage.getItem('admin_token') || '';
    const buffer = await importFile.value.arrayBuffer();
    const response = await fetch(`${getApiBase()}/db-imports`, {
      method: 'POST',
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/zip'
      },
      body: buffer
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data?.error || data?.message || '导入失败';
      throw new ApiError(message, { status: response.status, data });
    }

    showToast('导入成功', 'success');
    closeImportConfirm();
    closeImportDialog();
    fetchImports();
  } catch (err) {
    handleApiError(err);
  } finally {
    saving.value = false;
  }
}

function confirmDeleteImport(record) {
  deleteImportDialog.value = record;
}

function closeDeleteImport() {
  deleteImportDialog.value = null;
}

async function submitDeleteImport() {
  if (!deleteImportDialog.value) return;
  saving.value = true;
  try {
    await apiRequest(`/db-imports/${deleteImportDialog.value.id}`, { method: 'DELETE' });
    showToast('导入记录已删除', 'success');
    closeDeleteImport();
    fetchImports();
  } catch (err) {
    handleApiError(err);
  } finally {
    saving.value = false;
  }
}

onMounted(refresh);
</script>
