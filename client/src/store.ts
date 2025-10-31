import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatSession, ChatEvent } from './types';

interface AppState {
  currentChatId: string | null;
  sessions: ChatSession[];
  events: Map<string, ChatEvent[]>;
  
  setCurrentChatId: (chatId: string | null) => void;
  addSession: (session: ChatSession) => void;
  updateSession: (chatId: string, updates: Partial<ChatSession>) => void;
  addEvent: (chatId: string, event: ChatEvent) => void;
  getEvents: (chatId: string) => ChatEvent[];
  createChat: () => Promise<string>;
  switchChat: (chatId: string) => void;
}

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
  const apiUrl = hostname === 'localhost' || hostname === '127.0.0.1' 
    ? 'http://localhost:3001' 
    : `http://${hostname}:3001`;
  console.log('[getApiBase] hostname:', hostname, '-> API URL:', apiUrl);
  return apiUrl;
};

// Get Cursor Agent server base URL (runs on port 3002, no reload)
// Supports VITE_CURSOR_AGENT_API_URL environment variable for custom configuration
const getCursorAgentApiBase = () => {
  // Check for environment variable first
  if (import.meta.env.VITE_CURSOR_AGENT_API_URL) {
    return import.meta.env.VITE_CURSOR_AGENT_API_URL;
  }
  
  // Auto-detect based on current hostname
  if (typeof window === 'undefined') {
    return 'http://localhost:3002';
  }
  const hostname = window.location.hostname;
  const apiUrl = hostname === 'localhost' || hostname === '127.0.0.1' 
    ? 'http://localhost:3002' 
    : `http://${hostname}:3002`;
  console.log('[getCursorAgentApiBase] hostname:', hostname, '-> Cursor Agent API URL:', apiUrl);
  return apiUrl;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentChatId: null,
      sessions: [],
      events: new Map(),

      setCurrentChatId: (chatId) => set({ currentChatId: chatId }),

      addSession: (session) =>
        set((state) => ({
          sessions: [...state.sessions.filter((s) => s.chatId !== session.chatId), session],
        })),

      updateSession: (chatId, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.chatId === chatId ? { ...s, ...updates } : s
          ),
        })),

      addEvent: (chatId, event) =>
        set((state) => {
          const existingEvents = state.events.get(chatId) || [];
          const newEvents = [...existingEvents, event];
          const newEventsMap = new Map(state.events);
          newEventsMap.set(chatId, newEvents);
          return { events: newEventsMap };
        }),

      getEvents: (chatId) => {
        return get().events.get(chatId) || [];
      },

      createChat: async () => {
        try {
          // Use Cursor Agent server (port 3002) for chat creation
          const cursorAgentApiBase = getCursorAgentApiBase();
          console.log('[createChat] Using Cursor Agent API:', cursorAgentApiBase);
          
          const response = await fetch(`${cursorAgentApiBase}/api/chat/create`, {
            method: 'POST',
          });
          
          if (!response.ok) {
            throw new Error(`Failed to create chat: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          const chatId = data.chatId;
          
          const session: ChatSession = {
            chatId,
            createdAt: Date.now(),
            lastMessageAt: Date.now(),
          };
          
          get().addSession(session);
          get().setCurrentChatId(chatId);
          
          return chatId;
        } catch (error) {
          console.error('Failed to create chat:', error);
          throw error;
        }
      },

      switchChat: (chatId) => {
        get().setCurrentChatId(chatId);
      },
    }),
    {
      name: 'cursor-client-storage',
      // Custom serialization to handle Map
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // Convert events array back to Map
          if (parsed.state?.events) {
            const eventsMap = new Map();
            parsed.state.events.forEach(([key, value]: [string, ChatEvent[]]) => {
              eventsMap.set(key, value);
            });
            parsed.state.events = eventsMap;
          }
          return parsed;
        },
        setItem: (name, value) => {
          // Convert Map to array for serialization
          const toStore = { ...value };
          if (toStore.state?.events instanceof Map) {
            toStore.state.events = Array.from(toStore.state.events.entries());
          }
          localStorage.setItem(name, JSON.stringify(toStore));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);

