/**
 * API请求日志中间件
 */

/**
 * 获取当前时间字符串
 */
function getTimeString() {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${ms}`
}

/**
 * 获取API名称（从路径提取）
 */
function getApiName(path) {
  // 移除 /api 前缀
  const cleanPath = path.replace(/^\/api/, '')
  
  // 提取主要的API路径
  const parts = cleanPath.split('/').filter(p => p)
  if (parts.length === 0) return 'unknown'
  
  // 构建可读的API名称
  const apiMap = {
    'user/register': '用户注册',
    'user/login': '用户登录',
    'user/info': '获取用户信息',
    'user/update': '更新用户信息',
    'user/reset-password': '重置密码',
    
    'verb/list': '获取动词列表',
    'verb/random': '随机获取动词',
    
    'exercise/generate': '生成练习题',
    'exercise/generate-one': '生成单题',
    'exercise/generate-batch': '批量生成题目',
    'exercise/generate-single-ai': '生成单个AI题目',
    'exercise/submit': '提交答案',
    'exercise/check': '检查答案',
    
    'record/list': '获取学习记录',
    'record/statistics': '获取统计数据',
    'record/add': '添加学习记录',
    
    'checkin': '签到',
    'checkin/history': '签到历史',
    
    'leaderboard/week': '周排行榜',
    'leaderboard/month': '月排行榜',
    'leaderboard/total': '总排行榜',
    
    'vocabulary/favorite': '收藏单词',
    'vocabulary/unfavorite': '取消收藏单词',
    'vocabulary/my-favorites': '我的收藏',
    'vocabulary/wrong': '错题本',
    'vocabulary/add-wrong': '添加错题',
    'vocabulary/remove-wrong': '移除错题',
    
    'question/favorite': '收藏题目',
    'question/unfavorite': '取消收藏题目',
    'question/my-questions': '我的题库',
    'question/rate': '评价题目',
    'question/stats': '题库统计'
  }
  
  // 尝试完整匹配
  const fullPath = parts.join('/')
  if (apiMap[fullPath]) {
    return apiMap[fullPath]
  }
  
  // 尝试匹配前两级
  const shortPath = parts.slice(0, 2).join('/')
  if (apiMap[shortPath]) {
    return apiMap[shortPath]
  }
  
  // 如果有ID参数，提取主要路径
  if (parts.length >= 2 && /^\d+$/.test(parts[parts.length - 1])) {
    const pathWithoutId = parts.slice(0, -1).join('/')
    if (apiMap[pathWithoutId]) {
      return `${apiMap[pathWithoutId]} #${parts[parts.length - 1]}`
    }
    return `${parts[0]}-详情`
  }
  
  // 默认返回路径
  return parts.join('-')
}

/**
 * 获取方法颜色代码（用于终端）
 */
function getMethodColor(method) {
  const colors = {
    'GET': '\x1b[32m',     // 绿色
    'POST': '\x1b[33m',    // 黄色
    'PUT': '\x1b[36m',     // 青色
    'DELETE': '\x1b[31m',  // 红色
    'PATCH': '\x1b[35m'    // 紫色
  }
  return colors[method] || '\x1b[37m' // 默认白色
}

/**
 * API日志中间件
 */
function apiLogger(req, res, next) {
  // 只记录 /api 路径
  if (!req.path.startsWith('/api')) {
    return next()
  }
  
  const startTime = Date.now()
  const method = req.method
  const path = req.path
  const apiName = getApiName(path)
  const methodColor = getMethodColor(method)
  const resetColor = '\x1b[0m'
  
  // 记录请求开始
  const timeStr = getTimeString()
  console.log(`${methodColor}[${timeStr}] ${method}${resetColor} ${path} | ${apiName}`)
  
  // 拦截响应结束事件
  const originalSend = res.send
  res.send = function(data) {
    const duration = Date.now() - startTime
    const statusColor = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m'
    console.log(`  ${statusColor}↳ ${res.statusCode}${resetColor} | ${duration}ms`)
    
    originalSend.call(this, data)
  }
  
  next()
}

module.exports = apiLogger
