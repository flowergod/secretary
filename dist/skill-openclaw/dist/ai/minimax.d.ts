import { AIProvider, AIRequest, AIResponse } from './client';
export declare class MiniMaxProvider extends AIProvider {
    name(): string;
    chat(request: AIRequest): Promise<AIResponse>;
}
//# sourceMappingURL=minimax.d.ts.map