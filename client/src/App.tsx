import { useEffect, useState, useRef } from 'react';
import { useAppStore } from './store';
import type { ChatEvent } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

function App() {
  const { currentChatId, events, addEvent, getEvents, createChat, setCurrentChatId } = useAppStore();
  const [input, setInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 初始化：创建会话或恢复现有会话
  useEffect(() => {
    const init = async () => {
      if (!currentChatId) {
        try {
          const chatId = await createChat();
          setCurrentChatId(chatId);
        } catch (error) {
          console.error('Failed to create chat:', error);
        }
      }
    };
    init();
  }, []);

  // WebSocket 连接
  useEffect(() => {
    const newWs = new WebSocket(WS_URL);
    
    newWs.onopen = () => {
      setConnected(true);
      setWs(newWs);
      wsRef.current = newWs;
    };

    newWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          console.log('WebSocket connected:', data.wsId);
          return;
        }

        if (currentChatId) {
          const chatEvent: ChatEvent = {
            id: `${Date.now()}-${Math.random()}`,
            chatId: currentChatId,
            timestamp: Date.now(),
            type: data.type || 'unknown',
            subtype: data.subtype,
            payload: data,
            raw: event.data,
          };
          addEvent(currentChatId, chatEvent);
        }
      } catch (e) {
        console.error('Error parsing WebSocket message:', e);
      }
    };

    newWs.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    newWs.onclose = () => {
      setConnected(false);
      setWs(null);
      wsRef.current = null;
    };

    return () => {
      newWs.close();
    };
  }, [currentChatId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events, currentChatId]);

  const handleSend = () => {
    if (!input || !currentChatId || !ws || !connected) return;

    const prompt = input; // 保留原始输入，包括 tab 和换行
    setInput('');

    // 添加用户消息事件
    const userEvent: ChatEvent = {
      id: `${Date.now()}-${Math.random()}`,
      chatId: currentChatId,
      timestamp: Date.now(),
      type: 'user',
      payload: { prompt },
      raw: JSON.stringify({ type: 'user', prompt }),
    };
    addEvent(currentChatId, userEvent);

    // 通过 WebSocket 发送消息
    ws.send(JSON.stringify({
      type: 'send',
      chatId: currentChatId,
      prompt,
    }));
  };

  const handleNewChat = async () => {
    const chatId = await createChat();
    setCurrentChatId(chatId);
  };

  const currentEvents = currentChatId ? getEvents(currentChatId) : [];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Cursor Client</h1>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded ${connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {connected ? '已连接' : '未连接'}
            </span>
            <button
              onClick={handleNewChat}
              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              新建会话
            </button>
          </div>
        </div>
        {currentChatId && (
          <div className="mt-2 text-xs text-gray-500">
            Session ID: <code className="bg-gray-100 px-1 rounded">{currentChatId}</code>
          </div>
        )}
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {(() => {
          // 处理事件，过滤和合并
          const filteredEvents: ChatEvent[] = [];
          let lastThinkingIndex = -1;
          
          currentEvents.forEach((event, index) => {
            // 过滤掉不需要显示的事件
            if (event.type === 'thinking' && event.subtype === 'delta') {
              return; // 跳过思考 delta 事件
            }
            if (event.type === 'system' && event.subtype === 'init') {
              return; // 跳过系统初始化
            }
            
            // 处理思考事件：合并连续的思考事件，只显示最后一个
            if (event.type === 'thinking') {
              lastThinkingIndex = filteredEvents.length;
              // 检查下一个事件是否还是思考
              const nextEvent = currentEvents[index + 1];
              if (!nextEvent || nextEvent.type !== 'thinking' || nextEvent.subtype !== 'delta') {
                // 这是最后一个思考事件，添加它
                filteredEvents.push(event);
              }
            } else {
              // 非思考事件，直接添加
              filteredEvents.push(event);
            }
          });
          
          return filteredEvents.map((event) => {
            return (
              <div
                key={event.id}
                className={`p-3 rounded-lg ${
                  event.type === 'user'
                    ? 'bg-blue-500 text-white ml-auto max-w-[80%]'
                    : event.type === 'assistant'
                    ? 'bg-white border border-gray-200 mr-auto max-w-[80%]'
                    : event.type === 'tool_call'
                    ? 'bg-yellow-50 border border-yellow-200 mr-auto max-w-[90%]'
                    : event.type === 'error'
                    ? 'bg-red-50 border border-red-200 mr-auto max-w-[90%]'
                    : event.type === 'thinking'
                    ? 'bg-gray-100 border border-gray-200 mr-auto max-w-[80%] text-sm opacity-70'
                    : 'bg-gray-50 border border-gray-200 mr-auto max-w-[90%] text-sm'
                }`}
              >
                {event.type === 'user' && <div className="font-medium mb-1">用户:</div>}
                {event.type === 'assistant' && <div className="font-medium mb-1">助手:</div>}
                {event.type === 'tool_call' && <div className="font-medium mb-1 text-xs">工具:</div>}
                {event.type === 'error' && <div className="font-medium mb-1 text-red-600">错误:</div>}
                {event.type === 'thinking' && <div className="font-medium mb-1 text-gray-600">思考中...</div>}
                
                <div className="whitespace-pre-wrap break-words">
                  {event.type === 'user' && event.payload.prompt}
                  {event.type === 'assistant' && (
                    (() => {
                      const content = event.payload.message?.content || event.payload.content || event.payload.text;
                      if (Array.isArray(content)) {
                        return content.map((item, i) => {
                          if (item.type === 'text') {
                            return <span key={i}>{item.text}</span>;
                          }
                          return null;
                        });
                      }
                      if (typeof content === 'string') {
                        return content;
                      }
                      return null;
                    })()
                  )}
                  {event.type === 'tool_call' && (
                    event.subtype === 'started' ? (
                      <div className="text-xs text-gray-600">执行中...</div>
                    ) : event.subtype === 'completed' ? (
                      <div className="text-xs text-green-600">✓ 完成</div>
                    ) : (
                      <div className="text-xs">工具调用</div>
                    )
                  )}
                  {event.type === 'error' && event.payload.message}
                  {event.type === 'thinking' && ''}
                  {!['user', 'assistant', 'tool_call', 'error', 'thinking'].includes(event.type) && (
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  )}
                </div>
                
                {event.type !== 'thinking' && (
                  <div className="text-xs opacity-70 mt-1">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            );
          });
        })()}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入指令..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!connected || !currentChatId}
          />
          <button
            onClick={handleSend}
            disabled={!input || input.trim().length === 0 || !connected || !currentChatId}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
