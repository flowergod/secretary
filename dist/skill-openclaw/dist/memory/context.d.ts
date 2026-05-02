import { TaskEntity } from '../shared/types';
interface ConversationContext {
    userId: string;
    sessionId: string;
    lastIntent?: string;
    pendingTasks: string[];
    upcomingEvents: string[];
    preferences: UserPreferences;
    createdAt: string;
    updatedAt: string;
}
interface UserPreferences {
    reminderEnabled: boolean;
    morningReminderTime?: string;
    eveningReminderTime?: string;
    defaultPriority: '高' | '中' | '低';
    smartExpansionEnabled: boolean;
}
declare class MemoryStore {
    private contexts;
    private taskCache;
    /**
     * 获取或创建会话上下文
     */
    getOrCreateContext(userId: string, sessionId: string): ConversationContext;
    /**
     * 更新上下文
     */
    updateContext(userId: string, sessionId: string, updates: Partial<ConversationContext>): void;
    /**
     * 添加待完成任务
     */
    addPendingTask(userId: string, sessionId: string, taskId: string): void;
    /**
     * 移除待完成任务
     */
    removePendingTask(userId: string, sessionId: string, taskId: string): void;
    /**
     * 更新用户偏好
     */
    updatePreferences(userId: string, sessionId: string, preferences: Partial<UserPreferences>): void;
    /**
     * 缓存任务
     */
    cacheTask(task: TaskEntity): void;
    /**
     * 获取缓存任务
     */
    getCachedTask(taskId: string): TaskEntity | undefined;
    /**
     * 清除过期缓存
     */
    clearExpiredCache(maxAgeMs?: number): void;
    /**
     * 清除会话
     */
    clearSession(userId: string, sessionId: string): void;
    /**
     * 获取用户所有会话摘要
     */
    getUserSessionSummary(userId: string): {
        sessionCount: number;
        pendingTaskCount: number;
        preferences: UserPreferences;
    };
}
export declare const memoryStore: MemoryStore;
export {};
//# sourceMappingURL=context.d.ts.map