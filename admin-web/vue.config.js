const target = process.env.VUE_APP_ADMIN_PROXY_TARGET || 'http://localhost:3000'

module.exports = {
  // 生产环境使用 /admin/，开发环境使用 /
  publicPath: process.env.NODE_ENV === 'production' ? '/admin/' : '/',
  devServer: {
    proxy: {
      '/admin': {
        target,
        changeOrigin: true
      }
    }
  }
}
