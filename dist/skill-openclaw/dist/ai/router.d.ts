import { AIProvider, AIRequest, AIResponse } from './client';
export declare class AIRouter {
    private primary;
    private fallback;
    constructor();
    chat(request: AIRequest): Promise<AIResponse>;
    getPrimaryProvider(): AIProvider;
    getFallbackProvider(): AIProvider;
}
export declare const aiRouter: AIRouter;
//# sourceMappingURL=router.d.ts.map