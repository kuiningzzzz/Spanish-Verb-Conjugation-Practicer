<template>
  <section class="card management-page course-materials-page">
    <div class="management-header">
      <div>
        <h2>课程教材管理</h2>
      </div>
    </div>

    <div class="management-page-body">
      <div class="course-materials-placeholder">
        <div class="course-materials-placeholder-inner">
          <h3>功能预留</h3>
          <p class="muted">课程教材管理界面将在后续版本中补充。</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.course-materials-page {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.course-materials-placeholder {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-strong);
  border-radius: 16px;
  background: #ffffff;
}

.course-materials-placeholder-inner {
  text-align: center;
  padding: 24px;
}

.course-materials-placeholder-inner h3 {
  margin: 0 0 8px;
  font-size: 20px;
}

.course-materials-placeholder-inner p {
  margin: 0;
}
</style>
