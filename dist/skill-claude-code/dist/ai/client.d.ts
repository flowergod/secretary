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
export declare abstract class AIProvider {
    abstract chat(request: AIRequest): Promise<AIResponse>;
    abstract name(): string;
}
//# sourceMappingURL=client.d.ts.map