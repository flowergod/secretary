import { SemanticResult } from './types';
import { Context } from './context-manager';
import { SemanticLogger } from './semantic-logger';
import { TraceLogger } from './trace-logger';
export declare class SemanticService {
    private llmService;
    private promptManager;
    private intentParser;
    private dispatcher;
    private contextManager;
    private semanticLogger;
    private traceLogger;
    constructor();
    private loadLLMConfigs;
    understand(userInput: string, userId?: string): Promise<SemanticResult>;
    confirm(contextId: string, selectedOption?: string, openText?: string, cancel?: boolean): Promise<SemanticResult>;
    getContext(contextId: string): Context | null;
    private findMatchingTasks;
    private findSimilarTasksByLLM;
    private findEventsForDate;
    private findEventsForDateRange;
    private findTasksForConfirmation;
    private resolveReference;
    private understandContextualInput;
    private classifyIntent;
    private generateConfirmation;
    getCapabilities(): import("./types").Capability[];
    private formatParametersWithDate;
    private recordRecentMention;
    getSemanticLogger(): SemanticLogger;
    getTraceLogger(): TraceLogger;
}
export declare function getSemanticService(): SemanticService;
//# sourceMappingURL=semantic-service.d.ts.map