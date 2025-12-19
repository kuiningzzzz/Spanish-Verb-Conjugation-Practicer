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

router.get('/check', (req, res) => {
  try {
    const clientVersion = Number(req.query.versionCode || 0)
    if (!clientVersion) {
      return res.status(400).json({ error: '缺少 versionCode 参数' })
    }

    const versionInfo = loadVersionInfo()
    const { filePath, size } = getPackageInfo(versionInfo.packageFileName)

    const isLatest = clientVersion >= Number(versionInfo.versionCode)
    const baseUrl = `${req.protocol}://${req.get('host')}`
    const packageUrl = versionInfo.downloadUrl || `${baseUrl}/api/version/download`

    res.json({
      isLatest,
      updateRequired: !isLatest,
      latestVersion: {
        versionCode: Number(versionInfo.versionCode),
        versionName: versionInfo.versionName,
        releaseNotes: versionInfo.releaseNotes || '',
        packageFileName: versionInfo.packageFileName,
        packageUrl,
        packageSize: size,
        packageAvailable: Boolean(filePath),
        forceUpdate: Boolean(versionInfo.forceUpdate)
      }
    })
  } catch (error) {
    console.error('版本检查失败:', error)
    res.status(500).json({ error: '版本检查失败' })
  }
})

router.get('/download', (req, res) => {
  try {
    const versionInfo = loadVersionInfo()
    const { filePath, size } = getPackageInfo(versionInfo.packageFileName)

    console.log('[version-download] 请求下载')
    console.log('[version-download] 文件名:', versionInfo.packageFileName)
    console.log('[version-download] 文件路径:', filePath)
    console.log('[version-download] 文件大小:', size)
    console.log('[version-download] 文件是否存在:', filePath ? fs.existsSync(filePath) : false)

    if (!filePath || !fs.existsSync(filePath)) {
      console.error('[version-download] 文件不存在')
      return res.status(404).json({ error: '安装包不存在，请联系管理员' })
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.android.package-archive')
    res.setHeader('Content-Disposition', `attachment; filename="${versionInfo.packageFileName}"`)
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
