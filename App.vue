<script>
export default {
  onLaunch: function() {
    console.log('App Launch')
    // 初始化全局配置
    this.initApp()
  },
  onShow: function() {
    console.log('App Show')
  },
  onHide: function() {
    console.log('App Hide')
  },
  methods: {
    async initApp() {
      // 不在这里做登录检查，让各个页面自己处理
      await this.checkForUpdates()
    },
    async checkForUpdates() {
      // #ifdef APP-PLUS
      try {
        console.log('检查应用版本更新...')
        const baseInfo = uni.getAppBaseInfo ? uni.getAppBaseInfo() : {}
        const versionCode = Number(baseInfo.appVersionCode || 0)

        const api = require('./utils/api.js').default
        const res = await api.checkAppVersion(versionCode)

        if (!res.isLatest && res.latestVersion) {
          uni.setStorageSync('pendingUpdate', res.latestVersion)
          uni.reLaunch({
            url: '/pages/update/update'
          })
        }
      } catch (error) {
        console.error('版本检查失败:', error)
      }
      // #endif
      
      // #ifdef MP-WEIXIN
      // 小程序使用微信内置的更新机制
      try {
        const updateManager = uni.getUpdateManager()
        updateManager.onCheckForUpdate((res) => {
          if (res.hasUpdate) {
            console.log('小程序有新版本')
          }
        })
        updateManager.onUpdateReady(() => {
          uni.showModal({
            title: '更新提示',
            content: '新版本已经准备好，是否重启应用？',
            success: (res) => {
              if (res.confirm) {
                updateManager.applyUpdate()
              }
            }
          })
        })
        updateManager.onUpdateFailed(() => {
          console.log('新版本下载失败')
        })
      } catch (error) {
        console.error('小程序版本检查失败:', error)
      }
      // #endif
    }
  }
}
</script>

<style>
/* 全局样式 */
@import url('./static/css/common.css');
</style>
