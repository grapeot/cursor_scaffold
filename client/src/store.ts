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
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // 如果是网络访问，使用当前主机名；否则使用 localhost
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const apiUrl = hostname === 'localhost' || hostname === '127.0.0.1' 
    ? 'http://localhost:3001' 
    : `http://${hostname}:3001`;
  console.log('API Base URL:', apiUrl, 'hostname:', hostname);
  return apiUrl;
};

// 在运行时动态获取，而不是在模块加载时
const getApiBaseDynamic = () => getApiBase();

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
          const apiBase = getApiBaseDynamic();
          console.log('Creating chat with API:', apiBase);
          const response = await fetch(`${apiBase}/api/chat/create`, {
            method: 'POST',
          });
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

