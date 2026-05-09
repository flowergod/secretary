export declare enum IntentType {
    CREATE_TASK = "create_task",
    CREATE_EVENT = "create_event",
    QUERY_TASKS = "query_tasks",
    QUERY_EVENTS = "query_events",
    UPDATE_TASK = "update_task",
    UPDATE_EVENT = "update_event",
    COMPLETE_TASK = "complete_task",
    DELETE_TASK = "delete_task",
    DELETE_EVENT = "delete_event",
    EXPAND_TASK = "expand_task",// 智能规划
    OTHER = "other"
}
export type EntityType = 'task' | 'event' | 'calendar';
export interface ParsedIntent {
    id?: string;
    intent: IntentType;
    entityType: EntityType;
    parameters: Record<string, unknown>;
    confidence: number;
    needsConfirmation: boolean;
    lowConfidence: boolean;
    reasoning: string;
    rawInput: string;
}
export interface ConfirmationOption {
    id: string;
    label: string;
    type: string;
    taskId?: string;
}
export interface SemanticResult {
    success: boolean;
    intent?: ParsedIntent;
    confirmationQuestion?: string;
    confirmationOptions?: ConfirmationOption[];
    openOption?: {
        id: string;
        label: string;
    };
    lowConfidence?: boolean;
    requiresExecution?: boolean;
    result?: {
        taskId: string;
        action: string;
        icloudEventId?: string;
    };
    cancelled?: boolean;
    message?: string;
    logId?: string;
    traceId?: string;
    error?: string;
}
export interface Capability {
    id: string;
    name: string;
    intent: IntentType;
    requiredParams: string[];
    optionalParams: string[];
    description: string;
    examples: string[];
}
export interface PromptTemplate {
    id: string;
    version: string;
    description: string;
    systemPrompt: string;
    userPromptTemplate: string;
    examples?: Array<{
        input: string;
        output: Record<string, unknown>;
    }>;
}
export interface LLMRequest {
    model: string;
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    temperature?: number;
    max_tokens?: number;
}
export interface LLMResponse {
    content: string;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
    model: string;
    finish_reason?: string;
}
export interface LLMConfig {
    provider: 'volcano' | 'minimax' | 'openai';
    apiKey: string;
    model: string;
    baseUrl: string;
    timeout?: number;
    maxRetries?: number;
}
export interface DispatchResult {
    success: boolean;
    data?: unknown;
    error?: string;
    capabilityId?: string;
}
export interface ReferenceResolutionResult {
    found: boolean;
    resolvedTask: {
        taskId: string;
        recordId: string;
        title: string;
    } | null;
    resolvedUserInput: string;
}
//# sourceMappingURL=types.d.ts.map