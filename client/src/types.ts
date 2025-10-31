export interface ChatSession {
  chatId: string;
  createdAt: number;
  lastMessageAt: number;
  title?: string;
}

export interface ChatEvent {
  id: string;
  chatId: string;
  timestamp: number;
  type: string;
  subtype?: string;
  payload: any;
  raw: string;
}

