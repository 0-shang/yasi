# 1. 基础环境：使用轻量级的 Node 18
FROM node:18-alpine

# 2. 在容器里建个工作目录
WORKDIR /app

# 3. 把 package.json 复制进去，并安装依赖包
COPY package*.json ./
RUN npm install

# 4. 把你所有的代码复制进去
COPY . .

# 5. 告诉容器，启动时执行哪个命令
CMD ["npm", "run", "bot"]
