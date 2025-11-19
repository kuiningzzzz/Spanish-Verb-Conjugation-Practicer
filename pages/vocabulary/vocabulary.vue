<template>
  <view class="container">
    <view class="placeholder-content">
      <text class="placeholder-icon">📚</text>
      <text class="placeholder-title">单词本</text>
      <text class="placeholder-desc">功能开发中，敬请期待...</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {}
  },
  onLoad() {
    console.log('单词本页面加载')
  }
}
</script>

<style scoped>
.container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 40rpx;
  background: #f8f8f8;
}

.placeholder-content {
  text-align: center;
  padding: 80rpx 40rpx;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  width: 100%;
}

.placeholder-icon {
  display: block;
  font-size: 120rpx;
  margin-bottom: 30rpx;
}

.placeholder-title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.placeholder-desc {
  display: block;
  font-size: 28rpx;
  color: #999;
  line-height: 1.6;
}
</style>
