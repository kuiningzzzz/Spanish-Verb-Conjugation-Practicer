const target = process.env.VUE_APP_ADMIN_PROXY_TARGET || 'http://localhost:3000'

module.exports = {
  devServer: {
    proxy: {
      '/admin': {
        target,
        changeOrigin: true
      }
    }
  }
}
