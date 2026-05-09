import { LLMConfig, LLMResponse } from './types';
export declare class LLMService {
    private configs;
    private currentIndex;
    constructor(configs: LLMConfig[]);
    complete(systemPrompt: string, userPrompt: string, options?: {
        temperature?: number;
        maxTokens?: number;
    }): Promise<LLMResponse>;
    private callLLM;
    completeJson<T>(systemPrompt: string, userPrompt: string, options?: {
        temperature?: number;
    }): Promise<T>;
    reset(): void;
}
//# sourceMappingURL=llm-service.d.ts.map