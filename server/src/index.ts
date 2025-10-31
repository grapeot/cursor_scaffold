import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { exec, spawn } from 'child_process';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// 创建新会话
app.post('/api/chat/create', async (req, res) => {
  try {
    exec('cursor agent create-chat', (error, stdout, stderr) => {
      if (error) {
        console.error('Error creating chat:', error);
        return res.status(500).json({ error: 'Failed to create chat' });
      }
      const chatId = stdout.trim();
      res.json({ chatId });
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WebSocket 连接管理
const wsConnections = new Map<string, WebSocket & { isAlive?: boolean }>();

wss.on('connection', (ws, req) => {
  const wsId = `${Date.now()}-${Math.random()}`;
  wsConnections.set(wsId, ws);
  
  // 发送连接成功消息，包含 wsId
  ws.send(JSON.stringify({ type: 'connected', wsId }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'send' && data.chatId && data.prompt) {
        // 通过 WebSocket 接收发送消息的请求
        const { chatId, prompt } = data;
        
        const cmd = 'cursor';
        const args = [
          'agent',
          '--print',
          '--output-format',
          'stream-json',
          '--resume',
          chatId,
          prompt
        ];

        const process = spawn(cmd, args);
        
        process.stdout.on('data', (data) => {
          const lines = data.toString().split('\n');
          lines.forEach((line: string) => {
            if (line.trim()) {
              try {
                const event = JSON.parse(line);
                ws.send(JSON.stringify(event));
              } catch (e) {
                // 如果解析失败，发送原始文本
                ws.send(JSON.stringify({
                  type: 'raw',
                  data: line
                }));
              }
            }
          });
        });

        process.stderr.on('data', (data) => {
          ws.send(JSON.stringify({
            type: 'error',
            message: data.toString()
          }));
        });

        process.on('close', (code) => {
          ws.send(JSON.stringify({
            type: 'result',
            subtype: code === 0 ? 'success' : 'error',
            exitCode: code
          }));
        });

        process.on('error', (error) => {
          ws.send(JSON.stringify({
            type: 'error',
            message: error.message
          }));
        });
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    wsConnections.delete(wsId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    wsConnections.delete(wsId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

