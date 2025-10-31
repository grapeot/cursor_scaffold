# Cursor Client

一个支持移动端友好的 React 应用，实现对 Cursor Agent CLI 的图形化封装。

## 项目结构

```
cursor_client/
├── client/              # React 前端应用
│   ├── src/             # 源代码
│   ├── .env.example     # 环境变量示例文件
│   └── ...
├── server/              # Node.js 后端服务
│   ├── src/             # 源代码
│   ├── .env.example     # 环境变量示例文件
│   └── ...
├── start_frontend.sh    # 前端启动脚本
├── start_backend.sh     # 后端启动脚本
├── design.md            # 产品设计文档
└── README.md            # 本文件
```

## 前置要求

- Node.js (推荐 v18+)
- npm 或 yarn
- Cursor CLI (已安装并可在命令行访问 `cursor` 命令)
- Cursor 账户已登录并配置

## 快速开始

### 方法一：使用启动脚本（推荐）

项目提供了便捷的启动脚本，会自动安装依赖和配置环境变量：

#### 启动后端服务器

```bash
./start_backend.sh
```

或：

```bash
bash start_backend.sh
```

脚本会自动：
- 检查并安装后端依赖
- 配置环境变量（从 `.env.example` 复制到 `.env`）
- 检查 Cursor CLI 是否可用
- 启动开发服务器

#### 启动前端开发服务器

```bash
./start_frontend.sh
```

或：

```bash
bash start_frontend.sh
```

脚本会自动：
- 检查并安装前端依赖
- 配置环境变量（从 `.env.example` 复制到 `.env`）
- 启动开发服务器

### 方法二：手动安装

#### 1. 安装依赖

**前端依赖**
```bash
cd client
npm install
```

**后端依赖**
```bash
cd server
npm install
```

#### 2. 配置环境变量

**前端环境变量**（`client/.env`）

如果 `.env` 文件不存在，可以从 `.env.example` 复制：

```bash
cd client
cp .env.example .env
```

或手动创建 `client/.env`：

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

**后端环境变量**（`server/.env`）

如果 `.env` 文件不存在，可以从 `.env.example` 复制：

```bash
cd server
cp .env.example .env
```

或手动创建 `server/.env`：

```env
PORT=3001
NODE_ENV=development
```

## 本地开发

### 使用启动脚本启动

**终端 1 - 启动后端**：
```bash
./start_backend.sh
```

后端默认运行在 `http://localhost:3001`

**终端 2 - 启动前端**：
```bash
./start_frontend.sh
```

前端默认运行在 `http://localhost:5173`（或 Vite 自动选择的端口）

### 手动启动

**启动后端服务器**

在 `server/` 目录下运行：

```bash
npm run dev
```

**启动前端开发服务器**

在 `client/` 目录下运行：

```bash
npm run dev
```

### 访问应用

打开浏览器访问前端地址（通常是 `http://localhost:5173`）

## 测试

### 功能测试

1. **会话创建测试**
   - 打开应用，应自动创建一个新会话
   - 检查顶部是否显示会话 ID

2. **消息发送测试**
   - 在输入框输入一条消息（例如："Say hello"）
   - 点击发送按钮
   - 应看到消息显示在界面上，并收到 Cursor 的响应

3. **会话切换测试**
   - 点击"新建会话"按钮
   - 应创建新会话并切换上下文
   - 新会话的消息不应包含旧会话的历史

4. **WebSocket 连接测试**
   - 检查顶部连接状态显示为"已连接"
   - 如果显示"未连接"，检查后端是否正常运行

### 端到端测试流程

使用启动脚本（推荐）：

```bash
# 终端 1: 启动后端
./start_backend.sh

# 终端 2: 启动前端
./start_frontend.sh

# 浏览器: 访问 http://localhost:5173
# 1. 验证自动创建会话
# 2. 发送测试消息："Say hello"
# 3. 验证收到响应
# 4. 创建新会话
# 5. 验证会话切换成功
```

或手动启动：

```bash
# 终端 1: 启动后端
cd server
npm run dev

# 终端 2: 启动前端
cd client
npm run dev

# 浏览器: 访问 http://localhost:5173
```

### 命令行测试

你也可以直接测试后端 API：

```bash
# 创建新会话
curl -X POST http://localhost:3001/api/chat/create

# 应该返回类似：{"chatId":"7129401f-5fa1-438f-a7ae-4206fe055b76"}
```

## 构建生产版本

### 构建前端

```bash
cd client
npm run build
```

构建产物在 `client/dist/` 目录

### 构建后端

```bash
cd server
npm run build
```

构建产物在 `server/dist/` 目录

## 部署

### 前端部署

前端可以部署到任何静态文件服务器：

1. **使用 Vite Preview**（本地测试）
   ```bash
   cd client
   npm run build
   npm run preview
   ```

2. **部署到 Vercel**
   - 连接 GitHub 仓库
   - 设置构建目录为 `client`
   - 设置构建命令为 `cd client && npm install && npm run build`
   - 设置输出目录为 `client/dist`

3. **部署到 Netlify**
   - 类似 Vercel 的配置

4. **部署到传统服务器**
   - 将 `client/dist/` 目录内容上传到 Web 服务器（Nginx、Apache 等）
   - 配置服务器支持单页应用路由

### 后端部署

后端需要部署到支持 Node.js 的服务器：

1. **使用 PM2**（推荐）
   ```bash
   cd server
   npm run build
   pm2 start dist/index.js --name cursor-server
   ```

2. **使用 systemd**（Linux）
   - 创建 systemd service 文件
   - 设置工作目录和执行命令

3. **部署到云平台**
   - **Heroku**: 设置 `package.json` 的 `start` 脚本，Heroku 会自动运行
   - **Railway**: 类似配置
   - **Render**: 设置构建和启动命令

### 环境变量配置

生产环境需要设置正确的环境变量：

**前端**（构建时注入）：
```env
VITE_API_URL=https://your-backend-domain.com
VITE_WS_URL=wss://your-backend-domain.com
```

**后端**：
```env
PORT=3001
NODE_ENV=production
```

### 完整部署示例（本地服务器）

假设你将前端部署到 Nginx，后端部署到同一服务器：

1. **构建前端**
   ```bash
   cd client
   npm run build
   ```

2. **复制前端文件**
   ```bash
   sudo cp -r client/dist/* /var/www/html/
   ```

3. **配置 Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       root /var/www/html;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       location /api {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
       
       location /ws {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

4. **启动后端服务**
   ```bash
   cd server
   npm run build
   pm2 start dist/index.js --name cursor-server
   ```

5. **配置 SSL（推荐）**
   - 使用 Let's Encrypt 配置 HTTPS
   - 更新前端环境变量为 `wss://` 和 `https://`

## 故障排查

### 后端无法启动

- 检查 Node.js 版本是否满足要求
- 检查 `cursor` 命令是否在 PATH 中：运行 `which cursor`
- 检查 Cursor 是否已登录：运行 `cursor agent create-chat` 测试

### 前端无法连接后端

- 检查后端是否正在运行
- 检查环境变量 `VITE_API_URL` 和 `VITE_WS_URL` 是否正确
- 检查浏览器控制台的网络错误
- 如果是跨域问题，检查后端 CORS 配置

### WebSocket 连接失败

- 检查后端 WebSocket 服务器是否正常运行
- 检查防火墙是否允许 WebSocket 连接
- 检查代理服务器配置（如果使用 Nginx 等）

### 会话创建失败

- 确认 Cursor CLI 已正确安装和配置
- 检查 `cursor agent create-chat` 命令是否可以直接运行
- 查看后端日志获取详细错误信息

## 开发注意事项

- 前端使用 Zustand 进行状态管理，会话数据保存在 localStorage
- 后端每次请求都启动新的 `cursor agent` 进程，不维护长期运行的子进程
- 会话状态由 Cursor 内部管理，通过 chatId 访问
- 前端的事件历史保存在本地，刷新页面不会丢失

## 许可证

ISC

