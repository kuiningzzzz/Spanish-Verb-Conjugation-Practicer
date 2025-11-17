// API基础配置
const BASE_URL = 'http://3111933e.r39.cpolar.top/api'

// 请求封装
const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token')
    
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          // 未授权，跳转到登录页
          uni.removeStorageSync('token')
          uni.removeStorageSync('userInfo')
          uni.navigateTo({
            url: '/pages/login/login'
          })
          reject(res.data)
        } else {
          reject(res.data)
        }
      },
      fail: (err) => {
        uni.showToast({
          title: '网络请求失败',
          icon: 'none'
        })
        reject(err)
      }
    })
  })
}

// API接口
export default {
  // 用户相关
  register: (data) => request({ url: '/user/register', method: 'POST', data }),
  login: (data) => request({ url: '/user/login', method: 'POST', data }),
  getUserInfo: () => request({ url: '/user/info' }),
  updateProfile: (data) => request({ url: '/user/profile', method: 'PUT', data }),
  
  // 动词相关
  getVerbList: (params) => request({ url: '/verb/list', data: params }),
  getVerbDetail: (id) => request({ url: `/verb/${id}` }),
  
  // 练习相关
  getExercise: (data) => request({ url: '/exercise/generate', method: 'POST', data }),
  getOneExercise: (data) => request({ url: '/exercise/generate-one', method: 'POST', data }),
  submitAnswer: (data) => request({ url: '/exercise/submit', method: 'POST', data }),
  
  // 学习记录
  getStudyRecords: (params) => request({ url: '/record/list', data: params }),
  getStatistics: () => request({ url: '/record/statistics' }),
  
  // 打卡
  checkIn: () => request({ url: '/checkin', method: 'POST' }),
  getCheckInHistory: () => request({ url: '/checkin/history' }),
  
  // 排行榜
  getLeaderboard: (type) => request({ url: `/leaderboard/${type}` })
}
