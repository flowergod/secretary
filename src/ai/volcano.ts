// 火山方舟 AI Provider
import { AIProvider, AIRequest, AIResponse } from './client';
import { configManager } from '../shared/config';

export class VolcanoProvider extends AIProvider {
  name(): string {
    return 'volcano';
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const config = configManager.get();
    const { apiKey, baseUrl, model } = config.ai.primary;

    const url = baseUrl
      ? `${baseUrl}/chat/completions`
      : 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'coding-plan',
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Volcano API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      content: data.choices?.[0]?.message?.content || '',
      model: data.model || model || 'volcano',
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens || 0,
        outputTokens: data.usage.completion_tokens || 0,
      } : undefined,
    };
  }
}