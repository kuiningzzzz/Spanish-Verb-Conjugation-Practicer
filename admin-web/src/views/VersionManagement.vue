<template>
  <section class="card version-page">
    <div class="users-header">
      <div>
        <h2>版本管理</h2>
        <p class="muted">仅 dev 可查看历史版本更新日志与发布新版本。</p>
        <p class="muted total-count">共 {{ versions.length }} 条</p>
      </div>
      <div class="toolbar">
        <button class="ghost" @click="refresh" :disabled="loading">刷新</button>
        <button @click="openCreate">发布新版本</button>
        <button class="ghost" :disabled="!latestVersion" @click="downloadLatest">下载最新版本</button>
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
              <th>版本号</th>
              <th>发布日期</th>
              <th>强制更新</th>
              <th>更新说明</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="version in sortedVersions" :key="version.versionCode">
              <td>{{ version.versionName }}</td>
              <td>{{ version.releaseDate || '-' }}</td>
              <td>
                <span class="tag" :class="version.forceUpdate ? 'error' : 'success'">
                  {{ version.forceUpdate ? '是' : '否' }}
                </span>
              </td>
              <td>
                <span class="ellipsis" :title="version.description">
                  {{ formatText(version.description, 60) }}
                </span>
              </td>
              <td class="actions">
                <button class="ghost" @click="openDetail(version)">详情</button>
              </td>
            </tr>
            <tr v-if="!sortedVersions.length">
              <td colspan="5" class="empty">暂无版本记录</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="detailOpen" class="overlay" @click.self="closeDetail">
      <div class="drawer">
        <header>
          <h3>版本详情</h3>
          <button class="ghost" @click="closeDetail">关闭</button>
        </header>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">版本号</span>
            <span class="detail-value">{{ activeVersion.versionName }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">版本码</span>
            <span class="detail-value">{{ activeVersion.versionCode }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">发布日期</span>
            <span class="detail-value">{{ activeVersion.releaseDate || '-' }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">强制更新</span>
            <span class="detail-value">{{ activeVersion.forceUpdate ? '是' : '否' }}</span>
          </div>
          <div class="detail-item detail-span">
            <span class="detail-label">更新说明</span>
            <span class="detail-value muted">{{ activeVersion.description || '-' }}</span>
          </div>
          <div class="detail-item detail-span">
            <span class="detail-label">新增功能</span>
            <span class="detail-value muted">
              <template v-if="activeVersion.newFeatures && activeVersion.newFeatures.length">
                <span v-for="(item, index) in activeVersion.newFeatures" :key="`nf-${index}`" class="list-line">
                  {{ item }}
                </span>
              </template>
              <span v-else>-</span>
            </span>
          </div>
          <div class="detail-item detail-span">
            <span class="detail-label">优化改进</span>
            <span class="detail-value muted">
              <template v-if="activeVersion.improvements && activeVersion.improvements.length">
                <span v-for="(item, index) in activeVersion.improvements" :key="`im-${index}`" class="list-line">
                  {{ item }}
                </span>
              </template>
              <span v-else>-</span>
            </span>
          </div>
          <div class="detail-item detail-span">
            <span class="detail-label">Bug 修复</span>
            <span class="detail-value muted">
              <template v-if="activeVersion.bugFixes && activeVersion.bugFixes.length">
                <span v-for="(item, index) in activeVersion.bugFixes" :key="`bf-${index}`" class="list-line">
                  {{ item }}
                </span>
              </template>
              <span v-else>-</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="createOpen" class="overlay" @click.self="closeCreate">
      <div class="drawer">
        <header>
          <h3>发布新版本</h3>
          <button class="ghost" @click="closeCreate">关闭</button>
        </header>
        <form class="scroll-form" @submit.prevent="submitCreate">
          <label>
            版本号
            <input v-model.trim="form.versionName" placeholder="例如 1.3.0" />
            <span v-if="formErrors.versionName" class="field-error">{{ formErrors.versionName }}</span>
          </label>
          <label>
            更新说明
            <textarea v-model="form.description" rows="4"></textarea>
            <span v-if="formErrors.description" class="field-error">{{ formErrors.description }}</span>
          </label>
          <label>
            强制更新
            <input type="checkbox" v-model="form.forceUpdate" />
            <span v-if="formErrors.forceUpdate" class="field-error">{{ formErrors.forceUpdate }}</span>
          </label>
          <label>
            APK 文件
            <input type="file" accept=".apk" @change="handleFileChange" />
            <span class="hint" v-if="form.fileName">已选择：{{ form.fileName }}</span>
            <span v-if="formErrors.packageFile" class="field-error">{{ formErrors.packageFile }}</span>
          </label>

          <div class="list-editor">
            <div class="list-title">新增功能（选填）</div>
            <div v-for="(item, index) in form.newFeatures" :key="`nf-${index}`" class="list-row">
              <input v-model.trim="form.newFeatures[index]" placeholder="新增功能描述" />
              <button class="ghost" type="button" @click="removeListItem(form.newFeatures, index)">删除</button>
            </div>
            <button class="ghost" type="button" @click="addListItem(form.newFeatures)">添加条目</button>
          </div>

          <div class="list-editor">
            <div class="list-title">优化改进（选填）</div>
            <div v-for="(item, index) in form.improvements" :key="`im-${index}`" class="list-row">
              <input v-model.trim="form.improvements[index]" placeholder="优化改进描述" />
              <button class="ghost" type="button" @click="removeListItem(form.improvements, index)">删除</button>
            </div>
            <button class="ghost" type="button" @click="addListItem(form.improvements)">添加条目</button>
          </div>

          <div class="list-editor">
            <div class="list-title">Bug 修复（选填）</div>
            <div v-for="(item, index) in form.bugFixes" :key="`bf-${index}`" class="list-row">
              <input v-model.trim="form.bugFixes[index]" placeholder="Bug 修复描述" />
              <button class="ghost" type="button" @click="removeListItem(form.bugFixes, index)">删除</button>
            </div>
            <button class="ghost" type="button" @click="addListItem(form.bugFixes)">添加条目</button>
          </div>

          <button type="submit" :disabled="saving">发布</button>
        </form>
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

const versions = ref([]);
const latestVersion = ref(null);
const loading = ref(false);
const error = ref('');
const saving = ref(false);

const detailOpen = ref(false);
const activeVersion = ref({});

const createOpen = ref(false);
const selectedFile = ref(null);

const form = reactive({
  versionName: '',
  description: '',
  forceUpdate: false,
  fileName: '',
  newFeatures: [],
  improvements: [],
  bugFixes: []
});

const formErrors = reactive({});

const toast = reactive({
  visible: false,
  message: '',
  type: 'info'
});

const sortedVersions = computed(() => {
  return [...versions.value].sort((a, b) => Number(b.versionCode || 0) - Number(a.versionCode || 0));
});

function showToast(message, type = 'info') {
  toast.message = message;
  toast.type = type;
  toast.visible = true;
  setTimeout(() => {
    toast.visible = false;
  }, 3000);
}

function resetErrors(target) {
  Object.keys(target).forEach((key) => {
    target[key] = '';
  });
}

function setFieldErrors(target, fieldErrors) {
  if (!fieldErrors) return;
  Object.entries(fieldErrors).forEach(([field, message]) => {
    target[field] = message;
  });
}

function handleApiError(err, targetErrors) {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      showToast('登录已过期', 'error');
      logout();
      router.push({ name: 'Login', query: { error: 'expired' } });
      return;
    }
    if ([400, 422].includes(err.status)) {
      resetErrors(targetErrors || {});
      setFieldErrors(targetErrors, err.fieldErrors);
      showToast(err.message || '请检查表单字段', 'error');
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

async function fetchVersions() {
  loading.value = true;
  error.value = '';
  try {
    const data = await apiRequest('/api/version/all', { auth: false });
    versions.value = Array.isArray(data?.versions) ? data.versions : [];
    latestVersion.value = data?.latestVersion || null;
  } catch (err) {
    error.value = err.message || '加载失败';
    handleApiError(err);
  } finally {
    loading.value = false;
  }
}

function refresh() {
  fetchVersions();
}

function openDetail(version) {
  activeVersion.value = version || {};
  detailOpen.value = true;
}

function closeDetail() {
  detailOpen.value = false;
  activeVersion.value = {};
}

function formatText(value, maxLength) {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function openCreate() {
  resetErrors(formErrors);
  form.versionName = '';
  form.description = '';
  form.forceUpdate = false;
  form.fileName = '';
  form.newFeatures = [];
  form.improvements = [];
  form.bugFixes = [];
  selectedFile.value = null;
  createOpen.value = true;
}

function closeCreate() {
  createOpen.value = false;
}

function handleFileChange(event) {
  const file = event.target.files?.[0];
  selectedFile.value = file || null;
  form.fileName = file?.name || '';
}

function addListItem(list) {
  list.push('');
}

function removeListItem(list, index) {
  list.splice(index, 1);
}

async function uploadApkFile() {
  if (!selectedFile.value) {
    throw new Error('请先选择 APK 文件');
  }
  const token = localStorage.getItem('admin_token') || '';
  const buffer = await selectedFile.value.arrayBuffer();
  const response = await fetch(`${getApiBase()}/version/upload`, {
    method: 'POST',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(selectedFile.value.name)
    },
    body: buffer
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error || data?.message || '上传失败';
    throw new ApiError(message, { status: response.status, data });
  }
  return data;
}

async function submitCreate() {
  resetErrors(formErrors);
  if (!form.versionName.trim()) {
    formErrors.versionName = '请输入版本号';
  }
  if (!form.description.trim()) {
    formErrors.description = '请输入更新说明';
  }
  if (!selectedFile.value) {
    formErrors.packageFile = '请上传 APK 文件';
  }
  if (Object.values(formErrors).some((value) => value)) {
    return;
  }

  saving.value = true;

  try {
    const uploadResult = await uploadApkFile();
    const payload = {
      versionName: form.versionName.trim(),
      description: form.description.trim(),
      forceUpdate: Boolean(form.forceUpdate),
      packageFileName: uploadResult.fileName || form.fileName,
      newFeatures: form.newFeatures.filter((item) => item && item.trim()).map((item) => item.trim()),
      improvements: form.improvements.filter((item) => item && item.trim()).map((item) => item.trim()),
      bugFixes: form.bugFixes.filter((item) => item && item.trim()).map((item) => item.trim())
    };
    await apiRequest('/versions', { method: 'POST', body: payload });
    showToast('版本发布成功', 'success');
    closeCreate();
    fetchVersions();
  } catch (err) {
    handleApiError(err, formErrors);
  } finally {
    saving.value = false;
  }
}

function downloadLatest() {
  if (!latestVersion.value) return;
  window.open('http://localhost:3000/api/version/download', '_blank');
}

onMounted(fetchVersions);
</script>
