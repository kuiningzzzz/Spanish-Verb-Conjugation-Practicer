FROM alpine:3.19

RUN apk add --no-cache nginx wget

# 创建必要的目录
RUN mkdir -p /run/nginx /var/log/nginx

# 清理默认配置
RUN rm -f /etc/nginx/http.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
