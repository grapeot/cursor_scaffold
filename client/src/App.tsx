import { useEffect, useState, useRef } from 'react';
import { useAppStore } from './store';
import type { ChatEvent } from './types';
import Result from './Result';

// Auto-detect API base URL: prioritize environment variable, otherwise infer from current access address
// Note: This function must be called at runtime, not at module load time
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Must get at runtime to ensure correct hostname
  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' 
    ? 'http://localhost:3001' 
    : `http://${hostname}:3001`;
};

// Note: getWsUrl is defined but not directly used in this module anymore
// WebSocket URL is calculated directly in useEffect to ensure runtime hostname

type Tab = 'chat' | 'result';

function App() {
  const { currentChatId, events, addEvent, getEvents, createChat, setCurrentChatId } = useAppStore();
  const [input, setInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Initialize: create session or restore existing session
  useEffect(() => {
    const init = async () => {
      if (!currentChatId) {
        try {
          console.log('[init] Attempting to create chat...');
          const chatId = await createChat();
          console.log('[init] Chat created successfully:', chatId);
          setCurrentChatId(chatId);
        } catch (error) {
          console.error('[init] Failed to create chat:', error);
          // If creation fails, retry (may be network issue)
          console.log('[init] Will retry when WebSocket connects...');
        }
      }
    };
    init();
  }, []);

  // When WebSocket connects successfully, if no chatId exists, try to create one
  useEffect(() => {
    if (connected && !currentChatId) {
      console.log('[WebSocket connected] No chatId, attempting to create...');
      createChat()
        .then((chatId) => {
          console.log('[WebSocket connected] Chat created:', chatId);
          setCurrentChatId(chatId);
        })
        .catch((error) => {
          console.error('[WebSocket connected] Failed to create chat:', error);
        });
    }
  }, [connected, currentChatId]);

  // WebSocket connection
  useEffect(() => {
    // Dynamically calculate WebSocket URL at runtime to ensure correct hostname
    // Calculate directly here to ensure current hostname is used
    const hostname = window.location.hostname;
    const apiBase = hostname === 'localhost' || hostname === '127.0.0.1' 
      ? 'http://localhost:3001' 
      : `http://${hostname}:3001`;
    const wsUrl = apiBase.replace(/^http/, 'ws') + '/ws';
    console.log('[WebSocket] Current hostname:', hostname);
    console.log('[WebSocket] API Base:', apiBase);
    console.log('[WebSocket] Connecting to:', wsUrl);
    
    const newWs = new WebSocket(wsUrl);
    
    newWs.onopen = () => {
      console.log('WebSocket connected successfully to:', wsUrl);
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
      console.error('Failed to connect to:', wsUrl);
      console.error('Current location:', typeof window !== 'undefined' ? window.location.href : 'N/A');
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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events, currentChatId]);

  const handleSend = () => {
    if (!input || !currentChatId || !ws || !connected) return;

    const prompt = input; // Preserve original input, including tabs and newlines
    setInput('');

    // Add user message event
    const userEvent: ChatEvent = {
      id: `${Date.now()}-${Math.random()}`,
      chatId: currentChatId,
      timestamp: Date.now(),
      type: 'user',
      payload: { prompt },
      raw: JSON.stringify({ type: 'user', prompt }),
    };
    addEvent(currentChatId, userEvent);

    // Send message via WebSocket
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
              {connected ? 'Connected' : 'Disconnected'}
            </span>
            {activeTab === 'chat' && (
              <button
                onClick={handleNewChat}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                New Session
              </button>
            )}
          </div>
        </div>
        {activeTab === 'chat' && currentChatId && (
          <div className="mt-2 text-xs text-gray-500">
            Session ID: <code className="bg-gray-100 px-1 rounded">{currentChatId}</code>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'chat'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            >
            Chat
          </button>
          <button
            onClick={() => setActiveTab('result')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'result'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Result
          </button>
        </div>
      </div>

      {/* Content Area */}
      {activeTab === 'result' ? (
        <div className="flex-1 overflow-y-auto">
          <Result />
        </div>
      ) : (
        <>
          {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {(() => {
          // Process events, filter and merge
          const filteredEvents: ChatEvent[] = [];
          
          currentEvents.forEach((event, index) => {
            // Filter out events that don't need to be displayed
            if (event.type === 'thinking' && event.subtype === 'delta') {
              return; // Skip thinking delta events
            }
            if (event.type === 'system' && event.subtype === 'init') {
              return; // Skip system initialization
            }
            
            // Handle thinking events: merge consecutive thinking events, only show the last one
            if (event.type === 'thinking') {
              lastThinkingIndex = filteredEvents.length;
              // Check if the next event is also thinking
              const nextEvent = currentEvents[index + 1];
              if (!nextEvent || nextEvent.type !== 'thinking' || nextEvent.subtype !== 'delta') {
                // This is the last thinking event, add it
                filteredEvents.push(event);
              }
            } else {
              // Non-thinking events, add directly
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
                {event.type === 'user' && <div className="font-medium mb-1">User:</div>}
                {event.type === 'assistant' && <div className="font-medium mb-1">Assistant:</div>}
                {event.type === 'tool_call' && <div className="font-medium mb-1 text-xs">Tool:</div>}
                {event.type === 'error' && <div className="font-medium mb-1 text-red-600">Error:</div>}
                {event.type === 'thinking' && <div className="font-medium mb-1 text-gray-600">Thinking...</div>}
                
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
                      <div className="text-xs text-gray-600">Executing...</div>
                    ) : event.subtype === 'completed' ? (
                      <div className="text-xs text-green-600">✓ Completed</div>
                    ) : (
                      <div className="text-xs">Tool Call</div>
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
                placeholder="Enter command..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!connected || !currentChatId}
              />
              <button
                onClick={handleSend}
                disabled={!input || input.trim().length === 0 || !connected || !currentChatId}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
