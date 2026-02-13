const target = process.env.VUE_APP_ADMIN_PROXY_TARGET || 'http://localhost:3000'

module.exports = {
  publicPath: '/admin/',
  devServer: {
    proxy: {
      '/admin': {
        target,
        changeOrigin: true
      }
    }
  }
}
