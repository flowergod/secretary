// MiniMax AI Provider
import { AIProvider, AIRequest, AIResponse } from './client';
import { configManager } from '../shared/config';

export class MiniMaxProvider extends AIProvider {
  name(): string {
    return 'minimax';
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const config = configManager.get();
    const { apiKey, baseUrl, model } = config.ai.fallback;

    const url = baseUrl
      ? `${baseUrl}/chat/completions`
      : 'https://api.minimax.io/anthropic/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'MiniMax-Text-01',
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiniMax API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || model || 'minimax',
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens || 0,
        outputTokens: data.usage.completion_tokens || 0,
      } : undefined,
    };
  }
}