// LLM服务 - 负责调用AI接口，支持fallback和重试
import { LLMConfig, LLMRequest, LLMResponse } from './types';
import { logger } from '../shared/logger';

// OpenAI-compatible chat completions response types
interface Message {
  role: string;
  content: string;
}

interface Choice {
  message: Message;
  finish_reason: string;
  index: number;
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface ChatCompletionsResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage: Usage;
}

export class LLMService {
  private configs: LLMConfig[];
  private currentIndex: number = 0;

  constructor(configs: LLMConfig[]) {
    if (configs.length === 0) {
      throw new Error('At least one LLM config is required');
    }
    this.configs = configs;
  }

  // 主接口：完成一次LLM调用
  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const maxRetries = (this.configs[this.currentIndex].maxRetries || 3) + this.configs.length;
    const totalAttempts = Math.max(maxRetries, 3);

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      try {
        return await this.callLLM(this.currentIndex, systemPrompt, userPrompt, options);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.warn(`LLM call failed (provider ${this.currentIndex}, attempt ${attempt + 1}/${totalAttempts}): ${errorMsg}`);

        // 尝试下一个provider
        this.currentIndex = (this.currentIndex + 1) % this.configs.length;

        // 如果还没试完所有provider，等待一小段时间后重试
        if (attempt < totalAttempts - 1) {
          const delay = Math.min(500 * (attempt + 1), 2000); // 递增延迟，最多2秒
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error('All LLM providers failed');
  }

  // 调用单个LLM provider
  private async callLLM(
    configIndex: number,
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const config = this.configs[configIndex];

    const request: LLMRequest = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
    };

    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(config.timeout || 30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as ChatCompletionsResponse;

    if (!data.choices || !data.choices[0]) {
      throw new Error('Invalid LLM response: no choices');
    }

    return {
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model || config.model,
      finish_reason: data.choices[0].finish_reason,
    };
  }

  // 解析JSON响应（带错误处理）
  async completeJson<T>(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number }
  ): Promise<T> {
    const response = await this.complete(systemPrompt, userPrompt, {
      temperature: options?.temperature ?? 0.1, // JSON解析用低温
      maxTokens: 1000,
    });

    // 提取JSON（可能包裹在markdown代码块中）
    let jsonStr = response.content.trim();

    // 处理 ```json ... ``` 格式
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // 处理纯粹的JSON对象
    const parsed = JSON.parse(jsonStr);
    return parsed as T;
  }

  // 重置到第一个provider
  reset(): void {
    this.currentIndex = 0;
  }
}
