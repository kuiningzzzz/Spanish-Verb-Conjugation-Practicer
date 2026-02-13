FROM alpine:3.19 AS builder
RUN apk add --no-cache nodejs npm
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
ARG VUE_APP_ADMIN_API_BASE_URL
ARG NODE_ENV=production
ENV VUE_APP_ADMIN_API_BASE_URL=${VUE_APP_ADMIN_API_BASE_URL}
ENV NODE_ENV=${NODE_ENV}
RUN npm run build

FROM alpine:3.19
RUN apk add --no-cache nginx
RUN mkdir -p /run/nginx
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/http.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
