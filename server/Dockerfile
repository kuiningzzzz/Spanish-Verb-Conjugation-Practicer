# 使用 Alpine 基础镜像并安装 Node.js
FROM alpine:3.19

# 设置工作目录
WORKDIR /app

# 更换为阿里云镜像源并安装 Node.js 和依赖
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache nodejs npm python3 make g++ tzdata

# 设置时区为上海
ENV TZ=Asia/Shanghai
RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 复制package.json（项目根目录的）
COPY package.json ./

# 安装项目依赖
RUN npm install --production

# 复制server文件夹的所有文件到容器
COPY server/ ./server/

# 设置工作目录到server
WORKDIR /app/server

# 暴露端口
EXPOSE 3000

# 设置健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "index.js"]
