export interface Span {
    spanId: string;
    traceId: string;
    parentSpanId: string | null;
    operationName: string;
    startTime: string;
    durationMs: number | null;
    inputs: Record<string, unknown> | null;
    outputs: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    error: string | null;
    links: {
        taskId?: string;
        icloudEventId?: string;
        semanticLogId?: string;
    };
}
export interface Trace {
    traceId: string;
    parentTraceId: string | null;
    operationName: string;
    startTime: string;
    durationMs: number | null;
    inputs: Record<string, unknown> | null;
    outputs: Record<string, unknown> | null;
    error: string | null;
}
export interface TraceContext {
    traceId: string;
    rootSpanId: string;
    spans: Map<string, Span>;
    operationName: string;
    inputs: Record<string, unknown>;
}
export declare class TraceLogger {
    private currentTraces;
    startTrace(operationName: string, inputs: object): TraceContext;
    startSpan(traceId: string, operationName: string, parentSpanId?: string, inputs?: object): string | null;
    endSpan(traceId: string, spanId: string, outputs?: object, metadata?: object, error?: Error): void;
    endTrace(traceId: string, outputs?: object, error?: Error): void;
    addSpanLink(traceId: string, spanId: string, linkType: 'taskId' | 'icloudEventId' | 'semanticLogId', value: string): void;
    getTraceContext(traceId: string): TraceContext | null;
    getTrace(traceId: string): {
        trace: Trace | null;
        spans: Span[];
    };
    queryTraces(operation?: string, from?: string, to?: string, page?: number, pageSize?: number): {
        traces: Trace[];
        total: number;
    };
    getOperationStats(operation: string): {
        operation: string;
        totalCalls: number;
        successCount: number;
        failureCount: number;
        avgDuration: number;
        minDuration: number;
        maxDuration: number;
        errorTypes: Record<string, number>;
    };
    cleanup(olderThanDays: number): {
        tracesDeleted: number;
        spansDeleted: number;
    };
}
export declare function getTraceLogger(): TraceLogger;
//# sourceMappingURL=trace-logger.d.ts.map