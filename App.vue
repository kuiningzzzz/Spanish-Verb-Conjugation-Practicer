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
    initApp() {
      // 不在这里做登录检查，让各个页面自己处理
    }
  }
}
</script>

<style>
/* 全局样式 */
@import url('./static/css/common.css');
</style>
