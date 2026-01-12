module.exports = {
  transpileDependencies: ['uni-app'],
  
  // 小程序编译配置
  chainWebpack: config => {
    // 针对微信小程序的优化
    config.optimization.minimize(false)
  }
}
