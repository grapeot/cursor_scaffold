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

// 自动检测 API 地址：优先使用环境变量，否则根据当前访问地址自动推断
// 注意：这个函数必须在运行时调用，不能在模块加载时调用
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // 必须在运行时获取，确保使用正确的 hostname
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
          // 在运行时动态计算 API 地址，确保使用正确的 hostname
          let apiBase: string;
          
          // 检查环境变量
          const envApiUrl = import.meta.env.VITE_API_URL;
          console.log('[createChat] env.VITE_API_URL:', envApiUrl);
          
          if (envApiUrl) {
            apiBase = envApiUrl;
            console.log('[createChat] Using env API URL:', apiBase);
          } else if (typeof window !== 'undefined') {
            const hostname = window.location.hostname;
            const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
            apiBase = isLocalhost 
              ? 'http://localhost:3001' 
              : `http://${hostname}:3001`;
            console.log('[createChat] Computed API from hostname:', apiBase, 'isLocalhost:', isLocalhost, 'hostname:', hostname);
          } else {
            apiBase = 'http://localhost:3001';
            console.log('[createChat] Using default API (no window):', apiBase);
          }
          
          console.log('[createChat] Final API URL:', apiBase);
          
          const response = await fetch(`${apiBase}/api/chat/create`, {
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
      // 自定义序列化，处理 Map
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          // 将 events 数组转换回 Map
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
          // 将 Map 转换为数组以便序列化
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

