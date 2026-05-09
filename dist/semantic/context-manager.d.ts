import { ParsedIntent, ConfirmationOption } from './types';
export type ConfirmationStatus = 'pending_confirmation' | 'executing' | 'completed' | 'cancelled' | 'expired';
export interface Context {
    id: string;
    intent: ParsedIntent;
    rawInput: string;
    createdAt: Date;
    expiresAt: Date;
    status: ConfirmationStatus;
    confirmationQuestion?: string;
    confirmationOptions?: ConfirmationOption[];
    openOption?: {
        id: string;
        label: string;
    };
}
export type MentionOperation = 'create' | 'modify' | 'delete' | 'complete' | 'query';
export interface MentionRecord {
    taskId: string;
    recordId: string;
    title: string;
    operation: MentionOperation;
    time: Date;
}
export declare class ContextManager {
    private contexts;
    private readonly TIMEOUT_MS;
    private cleanupTimer;
    private recentMentions;
    private readonly MAX_MENTIONS;
    constructor(timeoutMs?: number);
    addMention(taskId: string, recordId: string, title: string, operation: MentionOperation): void;
    getRecentMentions(filter?: {
        operation?: MentionOperation;
        withinHours?: number;
    }): MentionRecord[];
    getLatestByOperation(operation: MentionOperation): MentionRecord | null;
    getLatest(count?: number): MentionRecord[];
    createContext(intent: ParsedIntent, rawInput: string, confirmationQuestion?: string, confirmationOptions?: Array<{
        id: string;
        label: string;
        type: string;
    }>, openOption?: {
        id: string;
        label: string;
    }): Context;
    getContext(id: string): Context | null;
    updateStatus(id: string, status: ConfirmationStatus): boolean;
    deleteContext(id: string): boolean;
    cancelContext(id: string): boolean;
    getPendingContexts(): Context[];
    private cleanup;
    private startCleanupTimer;
    stopCleanup(): void;
    getTimeoutMs(): number;
    getMentionCount(): number;
}
export declare function getContextManager(): ContextManager;
//# sourceMappingURL=context-manager.d.ts.map