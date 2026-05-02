"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryStore = void 0;
const DEFAULT_PREFERENCES = {
    reminderEnabled: true,
    defaultPriority: '中',
    smartExpansionEnabled: true,
};
class MemoryStore {
    constructor() {
        this.contexts = new Map();
        this.taskCache = new Map();
    }
    /**
     * 获取或创建会话上下文
     */
    getOrCreateContext(userId, sessionId) {
        const key = `${userId}:${sessionId}`;
        if (!this.contexts.has(key)) {
            this.contexts.set(key, {
                userId,
                sessionId,
                pendingTasks: [],
                upcomingEvents: [],
                preferences: { ...DEFAULT_PREFERENCES },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
        }
        const context = this.contexts.get(key);
        context.updatedAt = new Date().toISOString();
        return context;
    }
    /**
     * 更新上下文
     */
    updateContext(userId, sessionId, updates) {
        const context = this.getOrCreateContext(userId, sessionId);
        Object.assign(context, updates);
        context.updatedAt = new Date().toISOString();
    }
    /**
     * 添加待完成任务
     */
    addPendingTask(userId, sessionId, taskId) {
        const context = this.getOrCreateContext(userId, sessionId);
        if (!context.pendingTasks.includes(taskId)) {
            context.pendingTasks.push(taskId);
        }
    }
    /**
     * 移除待完成任务
     */
    removePendingTask(userId, sessionId, taskId) {
        const context = this.getOrCreateContext(userId, sessionId);
        context.pendingTasks = context.pendingTasks.filter(id => id !== taskId);
    }
    /**
     * 更新用户偏好
     */
    updatePreferences(userId, sessionId, preferences) {
        const context = this.getOrCreateContext(userId, sessionId);
        context.preferences = { ...context.preferences, ...preferences };
    }
    /**
     * 缓存任务
     */
    cacheTask(task) {
        this.taskCache.set(task.id, task);
    }
    /**
     * 获取缓存任务
     */
    getCachedTask(taskId) {
        return this.taskCache.get(taskId);
    }
    /**
     * 清除过期缓存
     */
    clearExpiredCache(maxAgeMs = 3600000) {
        const now = Date.now();
        for (const [id, task] of this.taskCache.entries()) {
            const updatedAt = new Date(task.updated_at).getTime();
            if (now - updatedAt > maxAgeMs) {
                this.taskCache.delete(id);
            }
        }
    }
    /**
     * 清除会话
     */
    clearSession(userId, sessionId) {
        const key = `${userId}:${sessionId}`;
        this.contexts.delete(key);
    }
    /**
     * 获取用户所有会话摘要
     */
    getUserSessionSummary(userId) {
        let sessionCount = 0;
        let pendingTaskCount = 0;
        let preferences = DEFAULT_PREFERENCES;
        for (const context of this.contexts.values()) {
            if (context.userId === userId) {
                sessionCount++;
                pendingTaskCount += context.pendingTasks.length;
                preferences = context.preferences;
            }
        }
        return {
            sessionCount,
            pendingTaskCount,
            preferences,
        };
    }
}
exports.memoryStore = new MemoryStore();
//# sourceMappingURL=context.js.map