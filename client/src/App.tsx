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
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectDelay = 1000; // Start with 1 second

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

  // WebSocket connection with auto-reconnect
  useEffect(() => {
    // Dynamically calculate WebSocket URL at runtime to ensure correct hostname
    // Use Cursor Agent server (port 3002) for WebSocket connections
    const hostname = window.location.hostname;
    const cursorAgentApiBase = hostname === 'localhost' || hostname === '127.0.0.1' 
      ? 'http://localhost:3002' 
      : `http://${hostname}:3002`;
    
    const connectWebSocket = () => {
      // Build WebSocket URL with chatId query parameter if available
      // Connect to Cursor Agent server (port 3002, no reload)
      let wsUrl = cursorAgentApiBase.replace(/^http/, 'ws') + '/ws';
      if (currentChatId) {
        wsUrl += `?chatId=${encodeURIComponent(currentChatId)}`;
      }
      
      console.log('[WebSocket] Current hostname:', hostname);
      console.log('[WebSocket] Cursor Agent API Base:', cursorAgentApiBase);
      console.log('[WebSocket] Connecting to:', wsUrl);
      console.log('[WebSocket] With chatId:', currentChatId);
      
      const newWs = new WebSocket(wsUrl);
      
      newWs.onopen = () => {
        console.log('WebSocket connected successfully to:', wsUrl);
        setConnected(true);
        setWs(newWs);
        wsRef.current = newWs;
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
      };

      newWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            console.log('WebSocket connected:', data.wsId, 'chatId:', data.chatId);
            // If backend returned a chatId and we don't have one, restore it
            if (data.chatId && !currentChatId) {
              console.log('[WebSocket] Restoring chatId from server:', data.chatId);
              setCurrentChatId(data.chatId);
            }
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

      newWs.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnected(false);
        setWs(null);
        wsRef.current = null;
        
        // Only attempt reconnect if it wasn't a manual close (code 1000) and we haven't exceeded max attempts
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const delay = reconnectDelay * Math.min(reconnectAttemptsRef.current, 5); // Exponential backoff, max 5 seconds
          console.log(`[WebSocket] Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('[WebSocket] Max reconnect attempts reached. Please refresh the page.');
        }
      };

      return newWs;
    };

    const ws = connectWebSocket();

    return () => {
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Close WebSocket connection
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(1000, 'Component unmounting'); // Normal closure
      }
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
    // Use wsRef.current to ensure we have the latest WebSocket connection
    const currentWs = wsRef.current;
    
    console.log('[handleSend] Called with:', {
      hasInput: !!input,
      inputLength: input?.length || 0,
      currentChatId,
      hasWs: !!currentWs,
      hasWsState: !!ws,
      connected,
      wsReadyState: currentWs?.readyState,
      wsReadyStateText: currentWs ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][currentWs.readyState] : 'N/A'
    });

    if (!input || !currentChatId) {
      console.warn('[handleSend] Cannot send: missing input or chatId', {
        hasInput: !!input,
        currentChatId
      });
      return;
    }

    if (!currentWs) {
      console.error('[handleSend] No WebSocket connection available');
      return;
    }

    // Check WebSocket ready state
    if (currentWs.readyState !== WebSocket.OPEN) {
      console.error('[handleSend] WebSocket not open, readyState:', currentWs.readyState, {
        stateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][currentWs.readyState]
      });
      return;
    }

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

    // Prepare message to send
    const message = {
      type: 'send',
      chatId: currentChatId,
      prompt,
    };
    const messageStr = JSON.stringify(message);
    
    console.log('[handleSend] Sending message:', {
      messageType: message.type,
      chatId: message.chatId,
      promptLength: prompt.length,
      promptPreview: prompt.substring(0, 50),
      messageSize: messageStr.length,
      wsUrl: (currentWs as any).url || 'N/A'
    });

    try {
      currentWs.send(messageStr);
      console.log('[handleSend] Message sent successfully via WebSocket');
    } catch (error) {
      console.error('[handleSend] Error sending message:', error);
    }
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
            // Format reference: docs/cursor_agent_format.md
            if (event.type === 'tool_call') {
              // Extract tool identifier according to documented format:
              // payload.toolCall.id is the primary identifier
              let toolId: string;
              if (event.payload?.toolCall?.id) {
                // Primary: use toolCall.id as specified in documentation
                toolId = String(event.payload.toolCall.id);
              } else if (event.payload?.id) {
                // Fallback: use payload.id if toolCall.id is missing
                toolId = String(event.payload.id);
              } else {
                // Last resort: generate a unique ID based on timestamp and event ID
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
          
          // Collect result events separately to show only the latest one
          const resultEvents = filteredEvents.filter(e => e.type === 'result');
          const latestResult = resultEvents.length > 0 ? resultEvents[resultEvents.length - 1] : null;
          const nonResultEvents = filteredEvents.filter(e => e.type !== 'result');
          
          // Find the last user message to limit tool call counting to current conversation turn
          // Only count tool calls from the most recent user message onwards
          const userMessages = currentEvents.filter(e => e.type === 'user');
          const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;
          const lastUserTimestamp = lastUserMessage?.timestamp || 0;
          
          // Filter tool calls to only include those from the current conversation turn
          // (i.e., tool calls that occurred after the last user message)
          const currentTurnToolCalls = Array.from(toolCallMap.entries())
            .map(([id, tool]) => ({
              id,
              ...tool,
            }))
            .filter(tool => {
              // Only include tools that started after the last user message
              if (!tool.started) return false;
              return tool.started.timestamp >= lastUserTimestamp;
            });
          
          const totalToolCalls = currentTurnToolCalls.length;
          const completedToolCalls = currentTurnToolCalls.filter(tool => tool.completed).length;
          const hasActiveToolCalls = totalToolCalls > 0 && completedToolCalls < totalToolCalls;
          const allToolCallsFinished = totalToolCalls > 0 && completedToolCalls === totalToolCalls;
          
          // Find the latest tool call event to check if it's still the most recent
          const toolCallEvents = currentEvents.filter(e => e.type === 'tool_call' && e.timestamp >= lastUserTimestamp);
          const latestToolCallEvent = toolCallEvents.length > 0 ? toolCallEvents[toolCallEvents.length - 1] : null;
          const latestNonToolCallEvent = nonResultEvents.length > 0 ? nonResultEvents[nonResultEvents.length - 1] : null;
          
          // Show tool call status only if:
          // 1. There are active tool calls (in progress), OR
          // 2. All are finished AND it's still the latest event (no new messages after completion)
          const shouldShowToolCallStatus = hasActiveToolCalls || 
            (allToolCallsFinished && latestToolCallEvent && 
             (!latestNonToolCallEvent || latestToolCallEvent.timestamp > latestNonToolCallEvent.timestamp));
          
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
                      // Parse assistant message according to cursor_agent_format.md
                      // Format: payload.message.content (array of content blocks or string)
                      const content = chatEvent.payload.message?.content || 
                                     chatEvent.payload.content || 
                                     chatEvent.payload.text;
                      if (Array.isArray(content)) {
                        // Array of content blocks: each has type and text fields
                        return content.map((item, i) => {
                          if (item.type === 'text') {
                            return <span key={i}>{item.text}</span>;
                          }
                          // Handle other content types (e.g., code blocks) if needed
                          return null;
                        });
                      }
                      if (typeof content === 'string') {
                        // Direct string content
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
                tools={currentTurnToolCalls}
              />
            );
          }
          
          // Add latest result event if exists (after messages and tool call status)
          // Format reference: docs/cursor_agent_format.md
          if (latestResult) {
            // Result event format: subtype can be 'success' or 'error'
            // Also check exitCode (0 for success) or is_error flag
            const exitCode = latestResult.payload?.exitCode ?? (latestResult.payload as any)?.exitCode;
            const isSuccess = latestResult.subtype === 'success' || 
                              (latestResult.subtype !== 'error' &&
                               (exitCode === 0 || latestResult.payload?.is_error === false));
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
