const express = require('express')
const fs = require('fs')
const path = require('path')

const router = express.Router()

const VERSION_FILE = path.join(__dirname, '..', 'src', 'version.json')
const UPDATE_DIR = path.join(__dirname, '..', 'src', 'updates')

const loadVersionInfo = () => {
  const fileContent = fs.readFileSync(VERSION_FILE, 'utf-8')
  return JSON.parse(fileContent)
}

const getPackageInfo = (fileName) => {
  if (!fileName) return { filePath: null, size: 0 }

  const filePath = path.join(UPDATE_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    return { filePath: null, size: 0 }
  }

  const stats = fs.statSync(filePath)
  return { filePath, size: stats.size }
}

// 检查版本更新（与最新版本比较）
router.get('/check', (req, res) => {
  try {
    const clientVersion = Number(req.query.versionCode || 0)
    if (!clientVersion) {
      return res.status(400).json({ error: '缺少 versionCode 参数' })
    }

    const versionData = loadVersionInfo()
    
    // 获取最新版本（数组第一个）
    if (!versionData.versions || versionData.versions.length === 0) {
      return res.status(500).json({ error: '版本信息配置错误' })
    }

    const latestVersion = versionData.versions[0]
    const { filePath, size } = getPackageInfo(latestVersion.packageFileName)

    const isLatest = clientVersion >= Number(latestVersion.versionCode)
    const baseUrl = `${req.protocol}://${req.get('host')}`
    const packageUrl = latestVersion.downloadUrl || `${baseUrl}/api/version/download`

    // 判断是否为旧版本客户端（最初版本100）
    const isLegacyClient = clientVersion == 100

    if (isLegacyClient) {
      // 为旧版本客户端返回兼容的简化格式
      console.log(`[version-check] 旧版本客户端 ${clientVersion}，返回兼容格式`)
      
      // 构建简化的releaseNotes
      let releaseNotes = latestVersion.description || ''
      if (latestVersion.newFeatures && latestVersion.newFeatures.length > 0) {
        releaseNotes += '\n\n新增功能：\n' + latestVersion.newFeatures.map(f => `• ${f}`).join('\n')
      }
      if (latestVersion.improvements && latestVersion.improvements.length > 0) {
        releaseNotes += '\n\n优化改进：\n' + latestVersion.improvements.map(f => `• ${f}`).join('\n')
      }
      if (latestVersion.bugFixes && latestVersion.bugFixes.length > 0) {
        releaseNotes += '\n\nBug修复：\n' + latestVersion.bugFixes.map(f => `• ${f}`).join('\n')
      }

      return res.json({
        versionCode: Number(latestVersion.versionCode),
        versionName: latestVersion.versionName,
        releaseNotes: releaseNotes.trim() || '版本更新',
        packageFileName: latestVersion.packageFileName,
        downloadUrl: packageUrl,
        forceUpdate: Boolean(latestVersion.forceUpdate)
      })
    }

    // 为新版本客户端返回完整格式
    console.log(`[version-check] 新版本客户端 ${clientVersion}，返回完整格式`)
    
    // 构建完整的版本描述
    let releaseNotes = ''
    if (latestVersion.description) {
      releaseNotes += latestVersion.description + '\n\n'
    }
    if (latestVersion.newFeatures && latestVersion.newFeatures.length > 0) {
      releaseNotes += '【新增功能】\n' + latestVersion.newFeatures.map(f => `• ${f}`).join('\n') + '\n\n'
    }
    if (latestVersion.improvements && latestVersion.improvements.length > 0) {
      releaseNotes += '【优化改进】\n' + latestVersion.improvements.map(f => `• ${f}`).join('\n') + '\n\n'
    }
    if (latestVersion.bugFixes && latestVersion.bugFixes.length > 0) {
      releaseNotes += '【Bug修复】\n' + latestVersion.bugFixes.map(f => `• ${f}`).join('\n')
    }

    res.json({
      isLatest,
      updateRequired: !isLatest,
      latestVersion: {
        versionCode: Number(latestVersion.versionCode),
        versionName: latestVersion.versionName,
        releaseDate: latestVersion.releaseDate,
        description: latestVersion.description,
        releaseNotes: releaseNotes.trim(),
        newFeatures: latestVersion.newFeatures || [],
        improvements: latestVersion.improvements || [],
        bugFixes: latestVersion.bugFixes || [],
        packageFileName: latestVersion.packageFileName,
        packageUrl,
        packageSize: size,
        packageAvailable: Boolean(filePath),
        forceUpdate: Boolean(latestVersion.forceUpdate)
      }
    })
  } catch (error) {
    console.error('版本检查失败:', error)
    res.status(500).json({ error: '版本检查失败' })
  }
})

// 获取所有版本信息（用于更新日志页面）
router.get('/all', (req, res) => {
  try {
    const versionData = loadVersionInfo()
    
    if (!versionData.versions || versionData.versions.length === 0) {
      return res.json({ versions: [] })
    }

    // 返回所有版本的完整信息
    const versions = versionData.versions.map(version => ({
      versionCode: Number(version.versionCode),
      versionName: version.versionName,
      releaseDate: version.releaseDate,
      description: version.description || '',
      newFeatures: version.newFeatures || [],
      improvements: version.improvements || [],
      bugFixes: version.bugFixes || []
    }))

    res.json({
      versions,
      latestVersion: versions[0]
    })
  } catch (error) {
    console.error('获取版本列表失败:', error)
    res.status(500).json({ error: '获取版本列表失败' })
  }
})

// 下载最新版本安装包
router.get('/download', (req, res) => {
  try {
    const versionData = loadVersionInfo()
    
    if (!versionData.versions || versionData.versions.length === 0) {
      return res.status(500).json({ error: '版本信息配置错误' })
    }

    const latestVersion = versionData.versions[0]
    const { filePath, size } = getPackageInfo(latestVersion.packageFileName)

    console.log('[version-download] 请求下载')
    console.log('[version-download] 文件名:', latestVersion.packageFileName)
    console.log('[version-download] 文件路径:', filePath)
    console.log('[version-download] 文件大小:', size)
    console.log('[version-download] 文件是否存在:', filePath ? fs.existsSync(filePath) : false)

    if (!filePath || !fs.existsSync(filePath)) {
      console.error('[version-download] 文件不存在')
      return res.status(404).json({ error: '安装包不存在，请联系管理员' })
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.android.package-archive')
    res.setHeader('Content-Disposition', `attachment; filename="${latestVersion.packageFileName}"`)
    res.setHeader('Content-Length', size)
    
    console.log('[version-download] 开始发送文件')
    
    // 使用流式传输
    const fileStream = fs.createReadStream(filePath)
    
    fileStream.on('error', (error) => {
      console.error('[version-download] 文件流错误:', error)
      if (!res.headersSent) {
        res.status(500).json({ error: '文件读取失败' })
      }
    })
    
    fileStream.on('end', () => {
      console.log('[version-download] 文件发送完成')
    })
    
    fileStream.pipe(res)
  } catch (error) {
    console.error('[version-download] 下载失败:', error)
    res.status(500).json({ error: '下载失败，请稍后重试' })
  }
})

module.exports = router
