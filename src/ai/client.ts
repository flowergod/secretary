// AI 客户端接口定义
export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export abstract class AIProvider {
  abstract chat(request: AIRequest): Promise<AIResponse>;
  abstract name(): string;
}