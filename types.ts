
export type AspectRatio = '1:1' | '9:16';

export type ChatMode = 'generator' | 'iteration' | 'fashion';

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  originalIdea: string;
  aspectRatio: AspectRatio;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status?: 'processing' | 'generating' | 'done' | 'error';
  mode?: ChatMode;
}
