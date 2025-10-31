# Cursor CLI 调研与应用计划

## 一、Cursor CLI 使用要点

### 1. 基本命令格式
- `cursor agent --print --output-format json "Say hello"`
  - 以单行 JSON 返回结果，字段包括 `type=result`、`subtype=success`、`result` 等，便于脚本一次性读取。
- `cursor agent --print --output-format stream-json "Say hello"`
  - 按行输出事件流，事件类型包含 `system`、`user`、`thinking`、`assistant`、`result` 等，利于前端逐条渲染。
  - `thinking` 事件会持续追加空字符串（delta），`assistant` 事件提供最终文本，`result` 标记调用结束并含耗时信息。

### 2. 会话管理机制（重要发现）
- **创建新会话**：`cursor agent create-chat` 
  - 返回一个 UUID（如 `7129401f-5fa1-438f-a7ae-4206fe055b76`），作为会话标识符（chatId/session_id）。
- **恢复会话**：`cursor agent --print --output-format stream-json --resume <chatId> <prompt>`
  - 使用 `--resume` 参数可以恢复指定会话，Cursor 会保持该会话的完整上下文。
  - 测试验证：在同一个 chatId 下连续发送多条消息，后续消息能访问之前的对话历史和文件操作。
- **默认行为**：不带 `--resume` 时，每次调用 `cursor agent` 会创建新的会话（新的 session_id）。
- **关键特性**：
  - **无需维护长期进程**：每次调用都是独立的命令执行，不需要保持进程常驻。
  - **会话状态由 Cursor 内部管理**：会话历史、上下文等存储在 Cursor 内部（可能在本地数据库或云端），通过 chatId 访问。
  - **跨命令行复用**：可以在不同的命令行调用中复用同一个 chatId，实现会话的持久化。

### 3. 输出事件格式
- 执行指令示例（创建并尝试运行 Python 脚本）：
  ```json
  {"type":"tool_call","tool_call":{"shellToolCall":{"args":{"command":"python /Users/grapeot/co/cursor_client/hello.py"},"result":{"rejected":{"command":"python /Users/grapeot/co/cursor_client/hello.py","workingDirectory":"/Users/grapeot/co/cursor_client"}}}}}
  ```
  - `tool_call.shellToolCall` 描述被代理执行的本地命令；`result.rejected` 表示命令被安全策略拦截，可据此在 UI 中提示失败原因。
- 所有事件都包含 `session_id` 字段，用于标识所属会话。

### 4. 其他选项
- 通过 `--stream-partial-output` 还可获取更细粒度的 token delta（可在后续验证）。
- 使用 `cursor agent --print --output-format stream-json <prompt>` 进行无交互任务执行。

## 二、产品需求（PRD）

### 核心目标
构建一个支持移动端友好的 React 应用，实现对 Cursor Agent CLI 的图形化封装。利用 Cursor 的会话管理机制，实现无需维护长期进程的轻量级交互体验。

### Tab 结构
- **指令对话**：
  - 类聊天界面，顶部按时间顺序展示事件（用户消息、Cursor 输出、工具调用、错误）。
  - 底部输入框发送指令；支持发送后自动滚动与节流。
  - 提供"新建会话""清空当前会话""复制输出"等操作。
  - **会话管理 UI**：在界面顶部或设置区域显示当前会话 ID，支持手动输入 chatId 切换到指定会话。
- **运行面板**：
  - 展示最近任务历史、命令模板与配置（模型选择、输出格式切换、是否启用 stream-json 等）。
  - 会话列表：显示所有已创建的会话（chatId、创建时间、最后消息时间），支持切换到任意会话。
  - 预留扩展挂件（如日志下载、统计图表）。

### 会话生命周期管理
- **默认行为**：
  - 应用启动时，如果没有当前会话，自动调用 `cursor agent create-chat` 创建新会话。
  - 用户发送消息时，默认使用当前会话 ID，通过 `--resume <currentChatId> <prompt>` 追加到现有会话。
  - 这样保证用户的所有消息都在同一个上下文中，保持对话连贯性。
- **新建会话**：
  - 用户点击"新建会话"按钮 → 调用 `cursor agent create-chat` → 获取新的 chatId → 更新当前会话 ID → 清空界面显示区域（可选，也可保留历史）。
  - 新的消息会发送到新会话，旧的会话仍可通过会话列表访问。
- **切换会话**：
  - 用户在运行面板选择会话 → 更新当前会话 ID → 界面显示该会话的历史（从本地缓存或从 Cursor 恢复）。
  - 后续消息会发送到切换后的会话。

### 交互流程
1. **初始化**：应用启动 → 检查是否有保存的会话 ID（localStorage）→ 如果没有则创建新会话 → 保存 chatId。
2. **发送消息**：
   - 用户在指令框输入文本，点击发送。
   - 前端调用后端接口，传递当前 chatId 和 prompt。
   - 后端执行 `cursor agent --print --output-format stream-json --resume <chatId> <prompt>`。
   - 后端逐行解析 JSON 事件并通过 WebSocket/SSE 推送到前端。
3. **实时渲染**：
   - user/system 事件以标签形式展示。
   - thinking 事件显示加载动画并聚合。
   - assistant/result 事件转为消息气泡；tool_call 事件显示命令、状态（成功/拒绝/错误）、stdout/stderr。
4. **会话管理**：
   - 用户可在运行面板中查看所有会话、切换到其他会话、创建新会话。
   - 每个会话的事件历史保存在前端（localStorage 或内存），刷新后可通过 chatId 恢复显示。

### 功能性需求
- **会话持久化**：chatId 保存在 localStorage，刷新后自动恢复；会话的事件历史也保存在前端，支持离线查看。
- **移动端优化**：支持手势滑动切换 Tab；响应式布局适配手机屏幕；输入框在移动端使用固定底部栏。
- **输出管理**：允许自定义最大输出长度与自动折叠长日志；支持复制、下载会话记录。
- **错误处理**：清晰提示命令被拒、会话不存在、缺少凭证等错误情况。

### 非功能性需求
- 首屏加载 < 2s（在本地 dev server 环境）。
- 流式渲染延迟 < 200ms（网络与 CLI 响应除外）。
- 错误提示清晰，包括命令被拒、缺少凭证、会话恢复失败等。

## 三、工程设计（RFC）

### 整体架构
- **前端**：React + TypeScript，使用 Vite 构建，TailwindCSS 辅助实现移动端响应式布局；状态管理使用 Zustand；WebSocket 或 Server-Sent Events (SSE) 订阅后端流式事件。
- **后端**：Node.js (Express/Koa) 提供 REST + WebSocket/SSE。
  - **关键设计**：不维护长期运行的子进程，每次请求都启动新的 `cursor agent` 命令执行。
  - 使用 `child_process.spawn` 或 `child_process.exec` 执行 `cursor agent` 命令。
  - 实时解析 stdout 的 JSON 流并通过 WebSocket/SSE 推送到前端。

### 会话生命周期管理（核心设计）

#### 会话管理 API 设计
```
后端接口：
- POST /api/chat/create → 调用 `cursor agent create-chat`，返回新 chatId
- POST /api/chat/send → 接收 {chatId, prompt}，执行 `cursor agent --print --output-format stream-json --resume <chatId> <prompt>`
- GET /api/chat/list → 返回前端保存的会话列表（从 localStorage 读取，或后端维护一个会话元数据缓存）
```

#### 实现细节
1. **创建会话**：
   ```javascript
   // 后端：执行命令并返回 chatId
   exec('cursor agent create-chat', (error, stdout, stderr) => {
     const chatId = stdout.trim(); // UUID
     // 返回给前端
   });
   ```

2. **发送消息**：
   ```javascript
   // 后端：每次请求都启动新进程
   const cmd = `cursor agent --print --output-format stream-json --resume ${chatId} "${prompt}"`;
   const process = spawn('cursor', ['agent', '--print', '--output-format', 'stream-json', '--resume', chatId, prompt]);
   
   // 逐行读取 stdout，解析 JSON 并推送
   process.stdout.on('data', (data) => {
     const lines = data.toString().split('\n');
     lines.forEach(line => {
       if (line.trim()) {
         const event = JSON.parse(line);
         ws.send(JSON.stringify(event)); // 或通过 SSE
       }
     });
   });
   ```

3. **会话状态管理**：
   - 前端维护当前 `chatId`（Zustand store + localStorage）。
   - 每个会话的事件历史保存在前端（localStorage，key: `chat:${chatId}`）。
   - 后端不需要维护会话状态，每次都是无状态的命令执行。

### 数据模型

#### 会话数据结构
```typescript
interface ChatSession {
  chatId: string;           // UUID
  createdAt: number;        // 时间戳
  lastMessageAt: number;    // 最后消息时间
  title?: string;           // 可选的会话标题（从第一条消息生成）
}

interface ChatEvent {
  id: string;              // 前端生成的唯一 ID
  chatId: string;          // 所属会话 ID
  timestamp: number;       // 时间戳
  type: string;           // system | user | assistant | tool_call | result | error
  subtype?: string;       // init | delta | completed | success | rejected 等
  payload: any;           // 事件负载（根据 type 变化）
  raw: string;            // 原始 JSON 字符串
}
```

#### 前端状态结构（Zustand）
```typescript
interface AppState {
  currentChatId: string | null;
  sessions: ChatSession[];
  events: Map<string, ChatEvent[]>; // chatId -> events
  createChat: () => Promise<string>;
  sendMessage: (chatId: string, prompt: string) => Promise<void>;
  switchChat: (chatId: string) => void;
}
```

### UI/UX 设计要点

1. **会话管理界面**：
   - 顶部栏显示当前会话 ID（可点击复制）。
   - "新建会话"按钮：创建新会话并切换。
   - 运行面板中的会话列表：显示所有会话，支持切换、删除（仅删除本地记录）。

2. **消息显示区域**：
   - 按时间顺序显示所有事件。
   - 用户消息显示在右侧，助手回复显示在左侧。
   - Tool call 事件以卡片形式展示，可展开查看详细信息。

3. **输入区域**：
   - 固定底部输入框（移动端适配）。
   - 发送按钮、新建会话按钮。
   - 显示当前使用的会话 ID（可选）。

### 错误与恢复

1. **会话不存在**：如果使用 `--resume` 指定的 chatId 不存在，Cursor 可能会创建新会话或返回错误。需要处理这种情况，提示用户或自动创建新会话。
2. **命令执行失败**：捕获子进程的错误和 stderr，以 error 事件通知前端。
3. **JSON 解析失败**：当解析 stdout 行失败时，将原始文本显示在"原始流"区域以便调试。
4. **网络中断**：前端检测到连接断开时，提示用户并允许重连。事件历史保存在本地，不会丢失。

### 开发计划（概略）

1. **Phase 1：基础架构**
   - 搭建前后端骨架（Vite + React + Express）。
   - 实现后端会话管理 API（create-chat, send-message）。
   - 实现命令执行和 JSON 流解析。
   - 建立 WebSocket/SSE 连接。

2. **Phase 2：核心功能**
   - 实现前端会话状态管理（Zustand）。
   - 实现指令对话 UI（消息列表、输入框）。
   - 实现事件渲染组件（用户消息、助手回复、tool call）。
   - 实现新建会话、切换会话功能。

3. **Phase 3：完善功能**
   - 实现运行面板（配置、会话列表、历史记录）。
   - 实现会话持久化（localStorage）。
   - 优化移动端体验。

4. **Phase 4：优化与测试**
   - 错误处理和用户提示优化。
   - 性能优化（虚拟滚动、事件去重等）。
   - 编写自动化测试。


