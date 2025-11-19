<template>
  <view class="container">
    <view class="login-header">
      <text class="logo">西语动词变位</text>
      <text class="slogan">让学习变得更简单</text>
    </view>

    <view class="card login-card">
      <view class="tab-header">
        <view :class="['tab-item', isLogin ? 'active' : '']" @click="switchTab(true)">
          <text>登录</text>
        </view>
        <view :class="['tab-item', !isLogin ? 'active' : '']" @click="switchTab(false)">
          <text>注册</text>
        </view>
      </view>

      <view class="form-container">
        <view class="form-item">
          <text class="label">用户名</text>
          <input class="input" v-model="formData.username" placeholder="请输入用户名" />
        </view>

        <view class="form-item">
          <text class="label">密码</text>
          <input class="input" type="password" v-model="formData.password" placeholder="请输入密码" />
        </view>

        <view v-if="!isLogin">
          <view class="form-item">
            <text class="label">邮箱</text>
            <input class="input" v-model="formData.email" placeholder="请输入邮箱（选填）" />
          </view>

          <view class="form-item">
            <text class="label">学校</text>
            <input class="input" v-model="formData.school" placeholder="请输入学校（选填）" />
          </view>

          <view class="form-item">
            <text class="label">入学年份</text>
            <input class="input" type="number" v-model="formData.enrollmentYear" placeholder="请输入入学年份（选填）" />
          </view>

          <view class="form-item">
            <text class="label">用户类型</text>
            <picker @change="onUserTypeChange" :value="userTypeIndex" :range="userTypes" range-key="label">
              <view class="picker">
                {{ userTypes[userTypeIndex].label }}
              </view>
            </picker>
          </view>
        </view>

        <button class="btn-primary mt-20" @click="handleSubmit">
          {{ isLogin ? '登录' : '注册' }}
        </button>

        <view class="tips mt-20">
          <text class="tip-text" v-if="isLogin">学生用户免费使用教材内容</text>
          <text class="tip-text" v-else>社会人士 ¥38/年，享受全部功能</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import api from '@/utils/api.js'
import { showToast, showLoading, hideLoading } from '@/utils/common.js'

export default {
  data() {
    return {
      isLogin: true,
      formData: {
        username: '',
        password: '',
        email: '',
        school: '',
        enrollmentYear: '',
        userType: 'student'
      },
      userTypes: [
        { value: 'student', label: '学生' },
        { value: 'public', label: '社会人士' }
      ],
      userTypeIndex: 0
    }
  },
  methods: {
    switchTab(isLogin) {
      this.isLogin = isLogin
      this.formData = {
        username: '',
        password: '',
        email: '',
        school: '',
        enrollmentYear: '',
        userType: 'student'
      }
    },
    onUserTypeChange(e) {
      this.userTypeIndex = e.detail.value
      this.formData.userType = this.userTypes[e.detail.value].value
    },
    async handleSubmit() {
      if (!this.formData.username || !this.formData.password) {
        showToast('请填写用户名和密码')
        return
      }

      showLoading(this.isLogin ? '登录中...' : '注册中...')

      try {
        const apiMethod = this.isLogin ? api.login : api.register
        const res = await apiMethod(this.formData)

        hideLoading()

        if (res.success) {
          // 保存token和用户信息
          uni.setStorageSync('token', res.token)
          uni.setStorageSync('userInfo', res.user)

          showToast(this.isLogin ? '登录成功' : '注册成功', 'success')

          setTimeout(() => {
            uni.switchTab({
              url: '/pages/index/index'
            })
          }, 1000)
        } else {
          showToast(res.error || '操作失败')
        }
      } catch (error) {
        hideLoading()
        showToast(error.error || '网络错误')
      }
    }
  }
}
</script>

<style scoped>
.login-header {
  text-align: center;
  padding: 100rpx 0 60rpx;
}

.logo {
  display: block;
  font-size: 52rpx;
  font-weight: bold;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 20rpx;
}

.slogan {
  display: block;
  font-size: 28rpx;
  color: #999;
}

.login-card {
  padding: 0;
  overflow: hidden;
}

.tab-header {
  display: flex;
  border-bottom: 1rpx solid #f0f0f0;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 30rpx 0;
  font-size: 32rpx;
  color: #999;
  position: relative;
}

.tab-item.active {
  color: #667eea;
  font-weight: bold;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60rpx;
  height: 4rpx;
  background: #667eea;
  border-radius: 2rpx;
}

.form-container {
  padding: 30rpx;
}

.form-item {
  margin-bottom: 30rpx;
}

.label {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 15rpx;
}

.input {
  width: 100%;
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
}

.picker {
  height: 80rpx;
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 0 20rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}

.tips {
  text-align: center;
}

.tip-text {
  font-size: 24rpx;
  color: #999;
}
</style>
