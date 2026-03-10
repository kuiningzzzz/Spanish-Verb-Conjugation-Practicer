<template>
  <section class="card management-page class-management-page">
    <div class="management-header">
      <div>
        <h2>班级管理</h2>
      </div>
    </div>

    <div class="management-page-body">
      <div class="class-management-placeholder">
        <div class="class-management-placeholder-inner">
          <h3>功能预留</h3>
          <p class="muted">班级管理界面将在后续版本中补充。</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.class-management-page {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.class-management-placeholder {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-strong);
  border-radius: 16px;
  background: #ffffff;
}

.class-management-placeholder-inner {
  text-align: center;
  padding: 24px;
}

.class-management-placeholder-inner h3 {
  margin: 0 0 8px;
  font-size: 20px;
}

.class-management-placeholder-inner p {
  margin: 0;
}
</style>
