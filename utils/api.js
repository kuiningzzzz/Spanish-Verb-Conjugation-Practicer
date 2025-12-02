// API基础配置
// 开发环境：使用 cpolar 内网穿透地址
// 生产环境：替换为实际服务器地址
const BASE_URL = 'http://7c66324f.r39.cpolar.top/api'

// 请求封装
const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token')
    
    // 调试信息
    console.log('API请求:', {
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      hasToken: !!token,
      data: options.data
    })
    
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        console.log('API响应:', {
          statusCode: res.statusCode,
          data: res.data
        })
        
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
        console.error('API请求失败:', err)
        uni.showToast({
          title: '网络请求失败: ' + (err.errMsg || '未知错误'),
          icon: 'none',
          duration: 3000
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
  getBatchExercises: (data) => request({ url: '/exercise/generate-batch', method: 'POST', data }),
  generateSingleAI: (data) => request({ url: '/exercise/generate-single-ai', method: 'POST', data }),
  submitAnswer: (data) => request({ url: '/exercise/submit', method: 'POST', data }),
  
  // 学习记录
  getStudyRecords: (params) => request({ url: '/record/list', data: params }),
  getStatistics: () => request({ url: '/record/statistics' }),
  
  // 打卡
  checkIn: () => request({ url: '/checkin', method: 'POST' }),
  getCheckInHistory: () => request({ url: '/checkin/history' }),
  
  // 排行榜
  getLeaderboard: (type) => request({ url: `/leaderboard/${type}` }),
  
  // 单词本相关
  getVocabularyStats: () => request({ url: '/vocabulary/stats' }),
  
  // 收藏
  addFavorite: (data) => request({ url: '/vocabulary/favorite/add', method: 'POST', data }),
  removeFavorite: (data) => request({ url: '/vocabulary/favorite/remove', method: 'POST', data }),
  checkFavorite: (verbId) => request({ url: `/vocabulary/favorite/check/${verbId}` }),
  getFavoriteList: () => request({ url: '/vocabulary/favorite/list' }),
  
  // 错题
  addWrongVerb: (data) => request({ url: '/vocabulary/wrong/add', method: 'POST', data }),
  removeWrongVerb: (data) => request({ url: '/vocabulary/wrong/remove', method: 'POST', data }),
  getWrongList: () => request({ url: '/vocabulary/wrong/list' }),
  
  // 题库相关
  favoriteQuestion: (data) => request({ url: '/question/favorite', method: 'POST', data }),
  unfavoriteQuestion: (data) => request({ url: '/question/unfavorite', method: 'POST', data }),
  getMyQuestions: (params) => request({ url: '/question/my-questions', data: params }),
  getQuestionStats: () => request({ url: '/question/stats' }),
  rateQuestion: (data) => request({ url: '/question/rate', method: 'POST', data }),
  
  // 课程相关
  getTextbooks: () => request({ url: '/course/textbooks' }),
  getLessonsByBook: (bookId) => request({ url: `/course/textbooks/${bookId}/lessons` }),
  getLessonVocabulary: (lessonId) => request({ url: `/course/lessons/${lessonId}/vocabulary` }),
  getLessonDetail: (lessonId) => request({ url: `/course/lessons/${lessonId}` }),
  createTextbook: (data) => request({ url: '/course/textbooks', method: 'POST', data }),
  createLesson: (data) => request({ url: '/course/lessons', method: 'POST', data }),
  addVerbsToLesson: (lessonId, data) => request({ url: `/course/lessons/${lessonId}/verbs`, method: 'POST', data })
}
