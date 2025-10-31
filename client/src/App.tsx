import { useEffect, useState, useRef } from 'react';
import { useAppStore } from './store';
import type { ChatEvent } from './types';
import Result from './Result';
import ToolCallStatus from './ToolCallStatus';

// Note: API and WebSocket URLs are calculated directly in useEffect to ensure runtime hostname

type Tab = 'chat' | 'result';

function App() {
  const { currentChatId, events, addEvent, getEvents, createChat, setCurrentChatId } = useAppStore();
  const [input, setInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          // Skip user events from server - we already add them manually in handleSend
          if (data.type === 'user') {
            return;
          }
          
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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input || !currentChatId || !ws || !connected) return;

    const prompt = input; // Preserve original input, including tabs and newlines
    setInput('');
    
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }

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
          <h1 className="text-xl font-semibold">Cursor Scaffold</h1>
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
          
          // Track tool calls in the background
          const toolCallMap = new Map<string, { started?: ChatEvent; completed?: ChatEvent }>();
          
          currentEvents.forEach((event) => {
            // Filter out events that don't need to be displayed
            if (event.type === 'thinking' && event.subtype === 'delta') {
              return; // Skip thinking delta events
            }
            if (event.type === 'system' && event.subtype === 'init') {
              return; // Skip system initialization
            }
            
            // Track tool calls in background but don't display them individually
            if (event.type === 'tool_call') {
              // Extract tool identifier
              let toolId: string;
              if (event.payload?.toolCall?.id) {
                toolId = String(event.payload.toolCall.id);
              } else if (event.payload?.id) {
                toolId = String(event.payload.id);
              } else if (event.payload?.toolCall?.shellToolCall?.args?.command) {
                toolId = String(event.payload.toolCall.shellToolCall.args.command);
              } else {
                toolId = `tool-${event.timestamp}-${event.id}`;
              }
              
              if (!toolCallMap.has(toolId)) {
                toolCallMap.set(toolId, {});
              }
              
              const tool = toolCallMap.get(toolId)!;
              if (event.subtype === 'started') {
                tool.started = event;
              } else if (event.subtype === 'completed') {
                tool.completed = event;
              }
              return; // Don't add to filteredEvents
            }
            
            // Skip empty user messages
            if (event.type === 'user' && (!event.payload.prompt || event.payload.prompt.trim() === '')) {
              return;
            }
            
            // Skip thinking events - we'll handle them separately as transient
            if (event.type === 'thinking') {
              return; // Don't add thinking events to filteredEvents
            }
            
            // All other events (except tool_call and thinking which are already filtered), add directly
            filteredEvents.push(event);
          });
          
          // Calculate tool call status: count total started and completed
          const toolCalls = Array.from(toolCallMap.entries()).map(([id, tool]) => ({
            id,
            ...tool,
          })).filter(tool => tool.started); // Only include tools that have started
          const totalToolCalls = toolCalls.length;
          const completedToolCalls = toolCalls.filter(tool => tool.completed).length;
          const hasActiveToolCalls = totalToolCalls > 0 && completedToolCalls < totalToolCalls;
          const allToolCallsFinished = totalToolCalls > 0 && completedToolCalls === totalToolCalls;
          const shouldShowToolCallStatus = hasActiveToolCalls || allToolCallsFinished;
          
          // Collect result events separately to show only the latest one
          const resultEvents = filteredEvents.filter(e => e.type === 'result');
          const latestResult = resultEvents.length > 0 ? resultEvents[resultEvents.length - 1] : null;
          const nonResultEvents = filteredEvents.filter(e => e.type !== 'result');
          
          // Check for the latest thinking event - only show if it's the most recent event
          // (transient: disappears when next message arrives)
          const thinkingEvents = currentEvents.filter(e => e.type === 'thinking' && e.subtype !== 'delta');
          const latestThinking = thinkingEvents.length > 0 ? thinkingEvents[thinkingEvents.length - 1] : null;
          const latestNonThinkingEvent = nonResultEvents.length > 0 ? nonResultEvents[nonResultEvents.length - 1] : null;
          const shouldShowThinking = latestThinking && (!latestNonThinkingEvent || latestThinking.timestamp > latestNonThinkingEvent.timestamp);
          
          const elements: React.ReactNode[] = [];
          
          // Add filtered events (excluding result events, we already handled them)
          nonResultEvents.forEach((chatEvent) => {
            
            // Regular chat messages
            elements.push(
              <div
                key={chatEvent.id}
                className={`p-3 rounded-lg ${
                  chatEvent.type === 'user'
                    ? 'bg-blue-500 text-white ml-auto max-w-[80%]'
                    : chatEvent.type === 'assistant'
                    ? 'bg-white border border-gray-200 mr-auto max-w-[80%]'
                    : chatEvent.type === 'error'
                    ? 'bg-red-50 border border-red-200 mr-auto max-w-[90%]'
                    : 'bg-gray-50 border border-gray-200 mr-auto max-w-[90%] text-sm'
                }`}
              >
                {chatEvent.type === 'user' && <div className="font-medium mb-1">User:</div>}
                {chatEvent.type === 'assistant' && <div className="font-medium mb-1">Assistant:</div>}
                {chatEvent.type === 'error' && <div className="font-medium mb-1 text-red-600">Error:</div>}
                
                <div className="whitespace-pre-wrap break-words">
                  {chatEvent.type === 'user' && chatEvent.payload.prompt}
                  {chatEvent.type === 'assistant' && (
                    (() => {
                      const content = chatEvent.payload.message?.content || chatEvent.payload.content || chatEvent.payload.text;
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
                  {chatEvent.type === 'error' && chatEvent.payload.message}
                  {!['user', 'assistant', 'error', 'result'].includes(chatEvent.type) && (
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(chatEvent.payload, null, 2)}
                    </pre>
                  )}
                </div>
                
                <div className="text-xs opacity-70 mt-1">
                  {new Date(chatEvent.timestamp).toLocaleTimeString()}
                </div>
              </div>
            );
          });
          
          // Add thinking indicator (transient) - shown only when it's the latest event
          if (shouldShowThinking) {
            elements.push(
              <div
                key="thinking-indicator"
                className="text-gray-400 italic text-xs py-1 mr-auto"
              >
                thinking...
              </div>
            );
          }
          
          // Add unified tool call status if there are any tool calls (after messages)
          if (shouldShowToolCallStatus) {
            elements.push(
              <ToolCallStatus
                key="tool-call-status"
                total={totalToolCalls}
                completed={completedToolCalls}
                tools={toolCalls}
              />
            );
          }
          
          // Add latest result event if exists (after messages and tool call status)
          if (latestResult) {
            const isSuccess = latestResult.subtype === 'success' || 
                              (latestResult.payload.exitCode === 0) || 
                              (latestResult.payload.is_error === false);
            elements.push(
              <div
                key={latestResult.id}
                className="text-gray-400 italic text-xs text-center py-1"
              >
                {isSuccess ? '✓ Completed' : '✗ Failed'}
              </div>
            );
          }
          
          return elements;
        })()}
        <div ref={messagesEndRef} />
      </div>

          {/* Input Area */}
          <div className="bg-white border-t border-gray-200 px-4 py-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Enter command... (Shift+Enter for new line)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[40px] max-h-[200px] overflow-y-auto"
                rows={1}
                disabled={!connected || !currentChatId}
              />
              <button
                onClick={handleSend}
                disabled={!input || input.trim().length === 0 || !connected || !currentChatId}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed h-[40px]"
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
