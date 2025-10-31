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
          // Dynamically calculate API base URL at runtime to ensure correct hostname
          let apiBase: string;
          
          // Check environment variable (if set to localhost, ignore it when accessing from non-localhost)
          const envApiUrl = import.meta.env.VITE_API_URL;
          const isEnvLocalhost = envApiUrl && (envApiUrl.includes('localhost') || envApiUrl.includes('127.0.0.1'));
          console.log('[createChat] env.VITE_API_URL:', envApiUrl, 'isEnvLocalhost:', isEnvLocalhost);
          
          // If environment variable is set to localhost but current access is not localhost, ignore env var and use auto-detection
          if (envApiUrl && (!isEnvLocalhost || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')))) {
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

