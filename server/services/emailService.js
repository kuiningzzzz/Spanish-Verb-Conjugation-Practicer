const nodemailer = require('nodemailer')

// 邮件发送服务
class EmailService {
  constructor() {
    // 检查邮箱配置是否完整
    this.isConfigured = this.checkConfiguration()
    
    if (!this.isConfigured) {
      console.log('\n' + '='.repeat(60))
      console.log('\x1b[33m⚠️  邮箱服务未配置\x1b[0m')
      console.log('='.repeat(60))
      console.log('学生邮箱认证功能需要配置邮箱服务')
      console.log('\n请在 server/.env 文件中配置以下信息：')
      console.log('  EMAIL_HOST=smtp.qq.com')
      console.log('  EMAIL_PORT=587')
      console.log('  EMAIL_USER=你的邮箱@qq.com')
      console.log('  EMAIL_PASS=邮箱授权码')
      console.log('\n📖 详细配置方法请查看: server/QUICK_START.md')
      console.log('='.repeat(60) + '\n')
      return
    }

    // 创建邮件传输对象
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.qq.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })
  }

  /**
   * 检查邮箱配置是否完整
   */
  checkConfiguration() {
    const { EMAIL_USER, EMAIL_PASS } = process.env
    
    if (!EMAIL_USER || !EMAIL_PASS) {
      return false
    }
    
    if (EMAIL_USER === 'your-email@qq.com' || EMAIL_PASS === 'your-email-authorization-code') {
      return false
    }
    
    return true
  }

  /**
   * 发送注册验证码邮件
   * @param {string} email - 收件人邮箱
   * @param {string} code - 验证码
   * @returns {Promise}
   */
  async sendVerificationCode(email, code) {
    // 检查是否已配置
    if (!this.isConfigured) {
      throw new Error('邮箱服务未配置，请先配置 .env 文件中的邮箱信息')
    }

    const mailOptions = {
      from: `"西语动词变位练习" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '【西语动词变位】注册验证码',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #8B0012; 
                     color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .code-box { background: white; border: 2px dashed #8B0012; padding: 20px; 
                       text-align: center; font-size: 32px; font-weight: bold; 
                       letter-spacing: 8px; color: #8B0012; margin: 20px 0; }
            .tips { background: #fff3cd; border-left: 4px solid #ffc107; 
                   padding: 15px; margin: 20px 0; }
            .warning { color: #d32f2f; font-weight: bold; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>学生身份认证</h2>
            </div>
            <div class="content">
              <p>您好！</p>
              <p>您正在注册西语动词变位练习的学生账号，请使用以下验证码完成认证：</p>
              
              <div class="code-box">${code}</div>
              
              <div class="tips">
                <p><span class="warning">验证码有效期为2分钟</span>，请尽快完成验证。</p>
                <p>如果这不是您本人的操作，请忽略此邮件。</p>
              </div>
            </div>
            <div class="footer">
              <p>此邮件由系统自动发送，请勿回复</p>
              <p>西语动词变位练习 © 2025</p>
            </div>
          </div>
        </body>
        </html>
      `
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('邮件发送成功:', info.messageId)
      return { success: true, messageId: info.messageId }
    } catch (error) {
      console.error('邮件发送失败:', error.message)
      
      // 根据错误类型提供更友好的提示
      let errorMessage = '邮件发送失败'
      
      if (error.code === 'EAUTH') {
        errorMessage = '邮箱认证失败，请检查邮箱授权码是否正确'
      } else if (error.code === 'ESOCKET') {
        errorMessage = '网络连接失败，请检查网络设置或SMTP服务器地址'
      } else if (error.code === 'ECONNECTION') {
        errorMessage = 'SMTP服务器连接失败，请检查服务器地址和端口'
      }
      
      throw new Error(errorMessage)
    }
  }

  /**
   * 发送登录验证码邮件
   * @param {string} email - 收件人邮箱
   * @param {string} code - 验证码
   * @returns {Promise}
   */
  async sendLoginVerificationCode(email, code) {
    if (!this.isConfigured) {
      throw new Error('邮箱服务未配置，请先配置 .env 文件中的邮箱信息')
    }

    const mailOptions = {
      from: `"西语动词变位练习" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '【西语动词变位】登录验证码',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #8B0012;
                     color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .code-box { background: white; border: 2px dashed #8B0012; padding: 20px;
                       text-align: center; font-size: 32px; font-weight: bold;
                       letter-spacing: 8px; color: #8B0012; margin: 20px 0; }
            .tips { background: #fff3cd; border-left: 4px solid #ffc107;
                   padding: 15px; margin: 20px 0; }
            .warning { color: #d32f2f; font-weight: bold; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>登录验证码</h2>
            </div>
            <div class="content">
              <p>您好！</p>
              <p>您正在登录西语动词变位练习，请使用以下验证码完成登录：</p>

              <div class="code-box">${code}</div>

              <div class="tips">
                <p><span class="warning">验证码有效期为2分钟</span>，请尽快完成验证。</p>
                <p>如果这不是您本人的操作，请忽略此邮件。</p>
              </div>
            </div>
            <div class="footer">
              <p>此邮件由系统自动发送，请勿回复</p>
              <p>西语动词变位练习 © 2025</p>
            </div>
          </div>
        </body>
        </html>
      `
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      console.log('邮件发送成功:', info.messageId)
      return { success: true, messageId: info.messageId }
    } catch (error) {
      console.error('邮件发送失败:', error.message)

      let errorMessage = '邮件发送失败'

      if (error.code === 'EAUTH') {
        errorMessage = '邮箱认证失败，请检查邮箱授权码是否正确'
      } else if (error.code === 'ESOCKET') {
        errorMessage = '网络连接失败，请检查网络设置或SMTP服务器地址'
      } else if (error.code === 'ECONNECTION') {
        errorMessage = 'SMTP服务器连接失败，请检查服务器地址和端口'
      }

      throw new Error(errorMessage)
    }
  }

  /**
   * 验证邮件服务是否可用
   * @returns {Promise}
   */
  async verifyConnection() {
    if (!this.isConfigured) {
      console.log('\x1b[33m   ⚠ 邮箱服务未配置，跳过连接测试\x1b[0m')
      return false
    }

    try {
      await this.transporter.verify()
      console.log('\x1b[32m   ✓ 邮件服务连接成功\x1b[0m')
      return true
    } catch (error) {
      console.error('\x1b[31m   ✗ 邮件服务连接失败:\x1b[0m', error.message)
      console.log('\x1b[33m   提示: 请检查 .env 文件中的邮箱配置\x1b[0m')
      console.log('\x1b[33m   详细配置方法: server/QUICK_START.md\x1b[0m')
      return false
    }
  }
}

module.exports = new EmailService()
