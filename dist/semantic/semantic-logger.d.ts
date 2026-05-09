export interface SemanticLogInput {
    text: string;
    userId?: string;
}
export interface SemanticLogIntentRecognition {
    intentId: string;
    intent: string;
    entityType?: string;
    confidence: number;
    lowConfidence: boolean;
    reasoning: string;
    parameters: Record<string, unknown>;
}
export interface SemanticLogConfirmation {
    needsConfirmation: boolean;
    confirmationQuestion?: string;
    options?: Array<{
        id: string;
        label: string;
        type: string;
    }>;
    openOption?: {
        id: string;
        label: string;
    };
    userResponse?: {
        type: 'option' | 'openText' | 'cancel';
        selectedOption?: string;
        openText?: string;
    };
}
export interface SemanticLogExecution {
    executed: boolean;
    capabilityId?: string;
    taskId?: string;
    action?: string;
    durationMs?: number;
    error?: string;
}
export interface SemanticLogICloudSync {
    synced: boolean;
    eventId?: string;
    error?: string;
}
export interface SemanticLogLLMMetadata {
    provider?: string;
    model?: string;
    latencyMs?: number;
    tokens?: number;
}
export interface SemanticLogEntry {
    id: string;
    timestamp: string;
    input: SemanticLogInput;
    intentRecognition: SemanticLogIntentRecognition;
    confirmation: SemanticLogConfirmation | null;
    execution: SemanticLogExecution | null;
    iCloudSync: SemanticLogICloudSync | null;
    llmMetadata: SemanticLogLLMMetadata | null;
    traceId?: string;
}
export interface LogQuery {
    intentId?: string;
    intent?: string;
    text?: string;
    taskId?: string;
    userId?: string;
    from?: string;
    to?: string;
    success?: boolean;
    page?: number;
    pageSize?: number;
}
export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
export interface IntentStats {
    count: number;
    successRate: number;
}
export interface DayStats {
    date: string;
    count: number;
}
export interface LogStats {
    period: {
        from: string;
        to: string;
    };
    summary: {
        totalRequests: number;
        successfulExecutions: number;
        failedExecutions: number;
        confirmationsRequired: number;
        avgLlmLatencyMs: number;
        avgExecutionDurationMs: number;
    };
    byIntent: Record<string, IntentStats>;
    byDay: DayStats[];
}
export declare class SemanticLogger {
    createLog(input: SemanticLogInput, intentRecognition: SemanticLogIntentRecognition, confirmation?: SemanticLogConfirmation | null, llmMetadata?: SemanticLogLLMMetadata | null): SemanticLogEntry;
    updateExecution(logId: string, execution: SemanticLogExecution, iCloudSync?: SemanticLogICloudSync | null): void;
    updateTraceId(logId: string, traceId: string): void;
    updateConfirmationResponse(logId: string, userResponse: SemanticLogConfirmation['userResponse']): void;
    queryLogs(query: LogQuery): PaginatedResult<SemanticLogEntry>;
    getLog(logId: string): SemanticLogEntry | null;
    getStats(from?: string, to?: string): LogStats;
    cleanup(olderThanDays: number): number;
    getRecentLogs(count?: number): SemanticLogEntry[];
}
export declare function getSemanticLogger(): SemanticLogger;
//# sourceMappingURL=semantic-logger.d.ts.map