export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamToken {
  content: string;
  done?: boolean;
}

export interface StreamChatResult {
  promptTokens: number;
  completionTokens: number;
}

export interface LLMProviderAdapter {
  readonly name: string;
  readonly defaultModel: string;
  isAvailable(): boolean;
  streamChat(
    messages: ChatMessage[],
    opts?: StreamChatOptions,
  ): AsyncIterable<StreamToken>;
  estimateTokens(text: string): number;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
