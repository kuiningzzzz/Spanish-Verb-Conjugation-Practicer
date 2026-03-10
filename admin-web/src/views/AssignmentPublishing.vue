<template>
  <section class="card management-page assignment-publishing-page">
    <div class="management-header">
      <div>
        <h2>发布作业</h2>
      </div>
    </div>

    <div class="management-page-body">
      <div class="assignment-publishing-placeholder">
        <div class="assignment-publishing-placeholder-inner">
          <h3>功能预留</h3>
          <p class="muted">发布作业界面将在后续版本中补充。</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.assignment-publishing-page {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.assignment-publishing-placeholder {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-strong);
  border-radius: 16px;
  background: #ffffff;
}

.assignment-publishing-placeholder-inner {
  text-align: center;
  padding: 24px;
}

.assignment-publishing-placeholder-inner h3 {
  margin: 0 0 8px;
  font-size: 20px;
}

.assignment-publishing-placeholder-inner p {
  margin: 0;
}
</style>
