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
        <template v-if="isLogin">
          <view class="login-mode-toggle">
            <view
              :class="['mode-item', loginMethod === 'password' ? 'active' : '']"
              @click="switchLoginMethod('password')"
            >
              账号密码登录
            </view>
            <view
              :class="['mode-item', loginMethod === 'emailCode' ? 'active' : '']"
              @click="switchLoginMethod('emailCode')"
            >
              邮箱验证码登录
            </view>
          </view>

          <template v-if="loginMethod === 'password'">
            <view class="form-item">
              <text class="label">用户名/邮箱</text>
              <input
                class="input"
                v-model="formData.username"
                placeholder="请输入用户名或邮箱"
              />
              <text v-if="fieldErrors.username" class="error-text">{{ fieldErrors.username }}</text>
            </view>

            <view class="form-item">
              <text class="label">密码</text>
              <input
                class="input"
                type="password"
                v-model="formData.password"
                placeholder="请输入密码"
              />
              <text v-if="fieldErrors.password" class="error-text">{{ fieldErrors.password }}</text>
            </view>
          </template>

          <template v-else>
            <view class="form-item">
              <text class="label">邮箱</text>
              <view class="input-with-button">
                <input
                  class="input flex-input"
                  v-model="formData.loginEmail"
                  placeholder="请输入注册邮箱"
                  :disabled="codeCountdown > 0"
                />
                <button
                  class="code-button"
                  @click="sendLoginCode"
                  :disabled="codeCountdown > 0 || !loginEmailValid"
                >
                  {{ codeButtonText }}
                </button>
              </view>
              <text v-if="fieldErrors.loginEmail" class="error-text">{{ fieldErrors.loginEmail }}</text>
            </view>

            <view class="form-item">
              <text class="label">邮箱验证码</text>
              <input
                class="input"
                type="number"
                maxlength="6"
                v-model="formData.loginVerificationCode"
                placeholder="请输入6位验证码"
              />
              <text v-if="fieldErrors.loginVerificationCode" class="error-text">{{ fieldErrors.loginVerificationCode }}</text>
            </view>
          </template>
        </template>

        <view v-else>
          <view class="form-item">
            <text class="label">用户名</text>
            <input
              :class="['input', inputStatus('username')]"
              v-model="formData.username"
              placeholder="请输入6-15位字母或数字"
              maxlength="15"
            />
            <text v-if="fieldErrors.username" class="error-text">{{ fieldErrors.username }}</text>
          </view>

          <view class="form-item">
            <text class="label">密码</text>
            <input
              :class="['input', inputStatus('password')]"
              type="password"
              v-model="formData.password"
              placeholder="请输入密码"
            />
            <text v-if="fieldErrors.password" class="error-text">{{ fieldErrors.password }}</text>
          </view>

          <view class="form-item">
            <text class="label">确认密码</text>
            <input
              :class="['input', inputStatus('confirmPassword')]"
              type="password"
              v-model="formData.confirmPassword"
              placeholder="请再次输入密码"
            />
            <text v-if="fieldErrors.confirmPassword" class="error-text">{{ fieldErrors.confirmPassword }}</text>
          </view>

          <view class="form-item" v-if="formData.userType === 'student'">
            <text class="label required">认证邮箱（必填）</text>
            <view class="input-with-button">
              <input 
                class="input flex-input" 
                v-model="formData.email" 
                placeholder="请输入edu.cn结尾的学生邮箱" 
                :disabled="codeCountdown > 0"
              />
              <button 
                class="code-button"
                @click="sendCode"
                :disabled="codeCountdown > 0 || !isValidEmail || hasCredentialError"
              >
                {{ codeButtonText }}
              </button>
            </view>
            <text class="hint-text">学生身份需要edu.cn邮箱认证</text>
            <text v-if="fieldErrors.email" class="error-text">{{ fieldErrors.email }}</text>
          </view>

          <view class="form-item" v-if="formData.userType === 'student'">
            <text class="label required">邮箱验证码</text>
            <input
              class="input"
              type="number"
              maxlength="6"
              v-model="formData.verificationCode"
              placeholder="请输入6位验证码"
            />
            <text class="hint-text">验证码有效期2分钟</text>
            <text v-if="fieldErrors.verificationCode" class="error-text">{{ fieldErrors.verificationCode }}</text>
          </view>

          <view class="form-item" v-if="formData.userType === 'public'">
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
            <text class="label required">用户类型</text>
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
      loginMethod: 'password',
      formData: {
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
        school: '',
        enrollmentYear: '',
        userType: 'student',
        verificationCode: '',
        loginEmail: '',
        loginVerificationCode: ''
      },
      fieldErrors: {
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
        verificationCode: '',
        loginEmail: '',
        loginVerificationCode: ''
      },
      userTypes: [
        { value: 'student', label: '学生/教师' },
        { value: 'public', label: '社会人士' }
      ],
      userTypeIndex: 0,
      codeCountdown: 0,
      countdownTimer: null
    }
  },
  computed: {
    hasCredentialError() {
      if (this.isLogin) return false
      return Boolean(this.fieldErrors.username || this.fieldErrors.password || this.fieldErrors.confirmPassword)
    },
    isValidEmail() {
      const email = this.formData.email
      return email && email.trim().toLowerCase().endsWith('edu.cn')
    },
    loginEmailValid() {
      const email = this.formData.loginEmail
      const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return Boolean(email && pattern.test(email.trim()))
    },
    codeButtonText() {
      if (this.codeCountdown > 0) {
        return `${this.codeCountdown}秒后重试`
      }
      return '发送验证码'
    }
  },
  watch: {
    'formData.username'(val) {
      if (!this.isLogin) {
        this.validateUsername(val)
      } else {
        this.fieldErrors.username = ''
      }
    },
    'formData.password'(val) {
      if (!this.isLogin) {
        this.validatePassword(val)
      } else {
        this.fieldErrors.password = ''
      }
    },
    'formData.confirmPassword'() {
      if (!this.isLogin) {
        this.validateConfirmPassword()
      } else {
        this.fieldErrors.confirmPassword = ''
      }
    },
    isLogin(newVal) {
      if (newVal) {
        this.fieldErrors.username = ''
        this.fieldErrors.password = ''
        this.fieldErrors.confirmPassword = ''
      }
    }
  },
  beforeDestroy() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer)
    }
  },
  methods: {
    switchTab(isLogin) {
      this.isLogin = isLogin
      this.loginMethod = 'password'
      this.formData = {
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
        school: '',
        enrollmentYear: '',
        userType: 'student',
        verificationCode: '',
        loginEmail: '',
        loginVerificationCode: ''
      }
      this.fieldErrors = {
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
        verificationCode: '',
        loginEmail: '',
        loginVerificationCode: ''
      }
      this.codeCountdown = 0
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer)
      }
    },
    switchLoginMethod(method) {
      this.loginMethod = method
      this.fieldErrors.loginEmail = ''
      this.fieldErrors.loginVerificationCode = ''
      this.codeCountdown = 0
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer)
      }
    },
    isUsernameValid(value = this.formData.username) {
      const usernamePattern = /^[A-Za-z0-9]{6,15}$/
      const trimmed = value.trim()
      return Boolean(trimmed && usernamePattern.test(trimmed))
    },
    validateUsername(value = this.formData.username) {
      if (this.isLogin) return true

      if (!this.isUsernameValid(value)) {
        this.fieldErrors.username = '用户名需为6-15位字母或数字组合'
        return false
      }

      this.fieldErrors.username = ''
      return true
    },
    isPasswordValid(value = this.formData.password) {
      const passwordPattern = /^[A-Za-z0-9!@#$%^&*()_+\-.]{8,20}$/
      const trimmed = value.trim()
      const hasLetter = /[A-Za-z]/.test(trimmed)
      const hasNumber = /\d/.test(trimmed)
      const hasSymbol = /[!@#$%^&*()_+\-.]/.test(trimmed)
      const categoryCount = [hasLetter, hasNumber, hasSymbol].filter(Boolean).length
      return Boolean(trimmed && passwordPattern.test(trimmed) && categoryCount >= 2)
    },
    validatePassword(value = this.formData.password) {
      if (this.isLogin) return true

      if (!this.isPasswordValid(value)) {
        this.fieldErrors.password = '密码需为8-20位，包含字母、数字、特殊符号中的至少两种'
        return false
      }

      this.fieldErrors.password = ''
      return true
    },
    validateConfirmPassword() {
      if (this.isLogin) return true

      if (!this.formData.confirmPassword) {
        this.fieldErrors.confirmPassword = '请再次输入密码'
        return false
      }

      if (this.formData.password !== this.formData.confirmPassword) {
        this.fieldErrors.confirmPassword = '两次输入的密码不一致'
        return false
      }

      this.fieldErrors.confirmPassword = ''
      return true
    },
    inputStatus(field) {
      if (this.isLogin) return ''

      const error = this.fieldErrors[field]
      if (error) return 'input-error'

      const value = this.formData[field]
      if (field === 'username' && value && this.isUsernameValid(value)) return 'input-success'
      if (field === 'password' && value && this.isPasswordValid(value)) return 'input-success'
      if (field === 'confirmPassword' && value && this.validateConfirmPassword()) return 'input-success'

      return ''
    },
    onUserTypeChange(e) {
      this.userTypeIndex = e.detail.value
      this.formData.userType = this.userTypes[e.detail.value].value
      // 切换用户类型时清空验证码相关
      if (this.formData.userType === 'public') {
        this.formData.verificationCode = ''
        this.codeCountdown = 0
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer)
        }
      }
    },
    async sendCode() {
      this.validateUsername()
      this.validatePassword()
      this.validateConfirmPassword()

      if (this.hasCredentialError) {
        showToast('请先修正用户名和密码')
        return
      }

      if (this.fieldErrors.confirmPassword) {
        showToast('请确认两次输入的密码一致')
        return
      }

      if (!this.isValidEmail) {
        showToast('请输入edu.cn结尾的学生邮箱')
        return
      }

      if (this.codeCountdown > 0) {
        return
      }

      showLoading('发送中...')

      try {
        const res = await api.sendVerificationCode({
          email: this.formData.email.trim(),
          username: this.formData.username.trim(),
          password: this.formData.password
        })

        hideLoading()

        if (res.success) {
          showToast('验证码已发送', 'success')
          
          // 开始倒计时
          this.codeCountdown = 60
          this.countdownTimer = setInterval(() => {
            this.codeCountdown--
            if (this.codeCountdown <= 0) {
              clearInterval(this.countdownTimer)
              this.countdownTimer = null
            }
          }, 1000)
        } else {
          this.handleFieldError(res.error)
        }
      } catch (error) {
        hideLoading()
        console.error('发送验证码错误:', error)
        if (error.waitTime) {
          showToast(`请${error.waitTime}秒后再试`)
        } else {
          this.handleFieldError(error.error)
        }
      }
    },
    handleFieldError(message) {
      if (!message) {
        showToast('操作失败')
        return
      }

      if (message.includes('用户名')) {
        this.fieldErrors.username = message
      } else if (message.includes('密码')) {
        this.fieldErrors.password = message
      } else if (message.includes('邮箱')) {
        this.fieldErrors.email = message
        this.fieldErrors.loginEmail = message
      } else if (message.includes('验证码')) {
        this.fieldErrors.verificationCode = message
        this.fieldErrors.loginVerificationCode = message
      } else {
        showToast(message)
      }
    },
    async sendLoginCode() {
      this.fieldErrors.loginEmail = ''

      if (!this.loginEmailValid) {
        this.fieldErrors.loginEmail = '请输入有效的邮箱地址'
        showToast('请输入有效的邮箱地址')
        return
      }

      if (this.codeCountdown > 0) {
        return
      }

      showLoading('发送中...')

      try {
        const res = await api.sendLoginCode({
          email: this.formData.loginEmail.trim()
        })

        hideLoading()

        if (res.success) {
          showToast('验证码已发送', 'success')

          this.codeCountdown = 60
          this.countdownTimer = setInterval(() => {
            this.codeCountdown--
            if (this.codeCountdown <= 0) {
              clearInterval(this.countdownTimer)
              this.countdownTimer = null
            }
          }, 1000)
        } else {
          this.handleFieldError(res.error)
        }
      } catch (error) {
        hideLoading()
        console.error('发送登录验证码错误:', error)
        if (error.waitTime) {
          showToast(`请${error.waitTime}秒后再试`)
        } else {
          this.handleFieldError(error.error)
        }
      }
    },
    async handleSubmit() {
      this.fieldErrors = {
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
        verificationCode: '',
        loginEmail: '',
        loginVerificationCode: ''
      }

      if (this.isLogin) {
        if (this.loginMethod === 'password') {
          if (!this.formData.username || !this.formData.password) {
            const baseError = '请填写用户名和密码'
            this.fieldErrors.username = baseError
            this.fieldErrors.password = baseError
            showToast(baseError)
            return
          }

          showLoading('登录中...')

          try {
            const payload = {
              username: this.formData.username.trim(),
              password: this.formData.password
            }
            const res = await api.login(payload)

            hideLoading()

            if (res.success) {
              uni.setStorageSync('token', res.token)
              uni.setStorageSync('userInfo', res.user)

              showToast('登录成功', 'success')

              setTimeout(() => {
                uni.switchTab({
                  url: '/pages/index/index'
                })
              }, 1000)
            } else {
              this.handleFieldError(res.error)
            }
          } catch (error) {
            hideLoading()
            showToast(error.error || '网络错误')
          }
        } else {
          if (!this.loginEmailValid) {
            this.fieldErrors.loginEmail = '请输入有效的邮箱地址'
            showToast('请输入有效的邮箱地址')
            return
          }

          if (!this.formData.loginVerificationCode) {
            this.fieldErrors.loginVerificationCode = '请输入邮箱验证码'
            showToast('请输入邮箱验证码')
            return
          }

          if (this.formData.loginVerificationCode.length !== 6) {
            this.fieldErrors.loginVerificationCode = '验证码应为6位数字'
            showToast('验证码应为6位数字')
            return
          }

          showLoading('登录中...')

          try {
            const res = await api.loginWithEmailCode({
              email: this.formData.loginEmail.trim(),
              verificationCode: this.formData.loginVerificationCode
            })

            hideLoading()

            if (res.success) {
              uni.setStorageSync('token', res.token)
              uni.setStorageSync('userInfo', res.user)

              showToast('登录成功', 'success')

              setTimeout(() => {
                uni.switchTab({
                  url: '/pages/index/index'
                })
              }, 1000)
            } else {
              this.handleFieldError(res.error)
            }
          } catch (error) {
            hideLoading()
            showToast(error.error || '网络错误')
          }
        }

        return
      }

      if (!this.formData.username || !this.formData.password) {
        const baseError = '请填写用户名和密码'
        this.fieldErrors.username = baseError
        this.fieldErrors.password = baseError
        showToast(baseError)
        return
      }

      const usernameValid = this.validateUsername()
      const passwordValid = this.validatePassword()
      const confirmValid = this.validateConfirmPassword()

      if (this.formData.userType === 'student') {
        if (!this.isValidEmail) {
          this.fieldErrors.email = '学生身份需要edu.cn结尾的邮箱'
        }
        if (!this.formData.verificationCode) {
          this.fieldErrors.verificationCode = '请输入邮箱验证码'
        } else if (this.formData.verificationCode.length !== 6) {
          this.fieldErrors.verificationCode = '验证码应为6位数字'
        }
      }

      const hasError = Object.values(this.fieldErrors).some((v) => v)
      if (hasError || !usernameValid || !passwordValid || !confirmValid) {
        showToast('请修正标红提示后再提交')
        return
      }

      showLoading('注册中...')

      try {
        const payload = {
          ...this.formData,
          username: this.formData.username.trim(),
          email: this.formData.email ? this.formData.email.trim() : ''
        }
        const res = await api.register(payload)

        hideLoading()

        if (res.success) {
          uni.setStorageSync('token', res.token)
          uni.setStorageSync('userInfo', res.user)

          showToast('注册成功', 'success')

          setTimeout(() => {
            uni.switchTab({
              url: '/pages/index/index'
            })
          }, 1000)
        } else {
          this.handleFieldError(res.error)
        }
      } catch (error) {
        hideLoading()
        this.handleFieldError(error.error)
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

.login-mode-toggle {
  display: flex;
  background: #f7f7f7;
  border-radius: 12rpx;
  padding: 8rpx;
  margin-bottom: 20rpx;
  gap: 12rpx;
}

.mode-item {
  flex: 1;
  text-align: center;
  padding: 18rpx 0;
  border-radius: 10rpx;
  font-size: 28rpx;
  color: #666;
  background: #fff;
}

.mode-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-weight: bold;
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

.label.required::after {
  content: ' *';
  color: #ff4d4f;
}

.input-with-button {
  display: flex;
  gap: 15rpx;
  align-items: center;
}

.flex-input {
  flex: 1;
}

.input {
  width: 100%;
  height: 80rpx;
  background: #f5f5f5;
  border: 2rpx solid transparent;
  border-radius: 12rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
}

.input-success {
  border-color: #52c41a;
  background: #f6ffed;
}

.input-error {
  border-color: #ff4d4f;
  background: #fff2f0;
}

.code-button {
  height: 80rpx;
  padding: 0 25rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 12rpx;
  font-size: 24rpx;
  white-space: nowrap;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.code-button[disabled] {
  background: #ccc;
  color: #999;
}

.hint-text {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-top: 10rpx;
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

.error-text {
  display: block;
  font-size: 24rpx;
  color: #ff4d4f;
  margin-top: 8rpx;
}
</style>
