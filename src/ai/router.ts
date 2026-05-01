// AI 双链路路由
import { AIProvider, AIRequest, AIResponse } from './client';
import { VolcanoProvider } from './volcano';
import { MiniMaxProvider } from './minimax';

export class AIRouter {
  private primary: AIProvider;
  private fallback: AIProvider;

  constructor() {
    this.primary = new VolcanoProvider();
    this.fallback = new MiniMaxProvider();
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    try {
      console.log(`[AIRouter] Using primary provider: ${this.primary.name()}`);
      return await this.primary.chat(request);
    } catch (error) {
      console.warn(`[AIRouter] Primary provider failed, trying fallback: ${error}`);
      return this.fallback.chat(request);
    }
  }

  getPrimaryProvider(): AIProvider {
    return this.primary;
  }

  getFallbackProvider(): AIProvider {
    return this.fallback;
  }
}

export const aiRouter = new AIRouter();