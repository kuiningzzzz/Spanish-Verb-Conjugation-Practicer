# 西班牙语动词变位学习软件

## 如何启动

> 注：目前后端运行在 `192.144.253.40:3000`

### 一、本地直接运行

要求本地具有22.10.0版本的node.js环境。出现环境问题可以参考下面第二个后端运行方式。

在根目录运行以下命令：

```
npm install
cd server
cp .env.example .env
```

而后填写好刚复制的.env文件。运行：

```
npm start
```

看到后端启动的日志输出即可

本地直接运行会在server文件夹中产生三个.db数据库

### 二、本地容器运行

如果有docker，先在电脑上打开docker，而后运行：

```
cd server
cp .env.example .env
```

而后填写好刚复制的.env文件。运行：

```
docker-compose up -d
```

运行起来之后可以进行如下操作：
```
# 查看日志
docker-compose logs -f
# 停止服务
docker-compose down
# 重启服务
docker-compose restart
# 验证后端是否成功部署（换成你后端实际运行的域名和端口）
curl http://localhost:3000/api/health
```

如果3000端口被占用了，可以修改docker-compose.yml文件中的port，如`8080:3000`，将8080端口映射为3000端口进行使用

Docker Compose 配置会自动挂载以下数据库文件到宿主机：

- `vocabulary.db` - 词汇数据库
- `user_data.db` - 用户数据库
- `questions.db` - 题目数据库

这些文件会保存在 `server/` 目录下，即使容器被删除，数据也不会丢失

### 三、前端配置与运行

在utils目录下复制example文件为base_url.js，地址修改为`后端提供的地址端口/api`即可，比如`http://localhost:3000/api`

前端运行使用uni-app开发工具HbuildX自带的运行功能即可，这里不做过多介绍。

