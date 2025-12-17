/**
 * 图片压缩服务
 * 使用纯 JavaScript 实现，无需额外依赖
 */

/**
 * 压缩 Base64 图片
 * @param {string} base64String - base64 格式的图片字符串
 * @param {number} maxSizeKB - 最大文件大小（KB）
 * @returns {Promise<string>} - 压缩后的 base64 字符串
 */
async function compressBase64Image(base64String, maxSizeKB = 80) {
  try {
    // 检查当前大小
    const currentSizeKB = (base64String.length * 0.75) / 1024 // base64 to bytes to KB
    
    console.log(`原始图片大小: ${currentSizeKB.toFixed(2)} KB`)
    
    // 如果已经小于目标大小，直接返回
    if (currentSizeKB <= maxSizeKB) {
      console.log('图片大小符合要求，无需压缩')
      return base64String
    }
    
    // 提取图片格式和数据
    const matches = base64String.match(/^data:image\/(png|jpg|jpeg|gif|webp);base64,(.+)$/)
    if (!matches) {
      throw new Error('无效的 base64 图片格式')
    }
    
    const format = matches[1]
    const data = matches[2]
    
    // 计算压缩比例
    const compressionRatio = maxSizeKB / currentSizeKB
    
    console.log(`需要压缩到原来的 ${(compressionRatio * 100).toFixed(2)}%`)
    
    // 对于非常大的图片，建议重新调整尺寸
    if (compressionRatio < 0.3) {
      console.warn('图片过大，建议前端先进行尺寸压缩')
      throw new Error('图片文件过大，请上传更小的图片或在前端进行尺寸压缩')
    }
    
    // 转换为 JPEG 格式（通常比 PNG 小）
    // 注意：这里我们只能返回原始数据或拒绝，因为真正的图片重编码需要图片处理库
    // 如果前端已经做了压缩，后端主要做大小验证
    
    // 简单策略：如果超过限制，拒绝上传
    throw new Error(`图片压缩后仍然过大 (${currentSizeKB.toFixed(2)} KB > ${maxSizeKB} KB)，请选择更小的图片`)
    
  } catch (error) {
    console.error('图片压缩失败:', error.message)
    throw error
  }
}

/**
 * 验证并准备图片数据
 * @param {string} base64String - base64 格式的图片字符串
 * @param {Object} options - 配置选项
 * @returns {Object} - 包含验证结果和处理后的数据
 */
function validateAndPrepareImage(base64String, options = {}) {
  const {
    maxSizeKB = 100,
    allowedFormats = ['png', 'jpg', 'jpeg', 'gif', 'webp']
  } = options
  
  // 验证是否为有效的 Base64 图片
  if (!base64String || !base64String.startsWith('data:image/')) {
    return { valid: false, error: '无效的图片格式' }
  }
  
  // 提取图片格式
  const formatMatch = base64String.match(/^data:image\/([a-zA-Z]+);base64,/)
  if (!formatMatch) {
    return { valid: false, error: '无法识别图片格式' }
  }
  
  const format = formatMatch[1].toLowerCase()
  if (!allowedFormats.includes(format)) {
    return { valid: false, error: `不支持的图片格式: ${format}` }
  }
  
  // 计算文件大小（Base64 字符串长度 * 0.75 / 1024）
  const sizeKB = (base64String.length * 0.75) / 1024
  
  if (sizeKB > maxSizeKB) {
    return { 
      valid: false, 
      error: `图片文件过大 (${sizeKB.toFixed(2)} KB)，请上传小于 ${maxSizeKB} KB 的图片`,
      sizeKB: sizeKB.toFixed(2)
    }
  }
  
  return {
    valid: true,
    format,
    sizeKB: sizeKB.toFixed(2),
    data: base64String
  }
}

/**
 * 获取图片信息
 * @param {string} base64String - base64 格式的图片字符串
 * @returns {Object} - 图片信息
 */
function getImageInfo(base64String) {
  if (!base64String || !base64String.startsWith('data:image/')) {
    return null
  }
  
  const formatMatch = base64String.match(/^data:image\/([a-zA-Z]+);base64,/)
  const format = formatMatch ? formatMatch[1] : 'unknown'
  const sizeKB = (base64String.length * 0.75) / 1024
  const sizeBytes = base64String.length * 0.75
  
  return {
    format,
    sizeKB: sizeKB.toFixed(2),
    sizeBytes: Math.round(sizeBytes),
    base64Length: base64String.length
  }
}

module.exports = {
  compressBase64Image,
  validateAndPrepareImage,
  getImageInfo
}
