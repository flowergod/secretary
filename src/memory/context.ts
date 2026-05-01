// 上下文管理
import { TaskEntity } from '../shared/types';

interface ConversationContext {
  userId: string;
  sessionId: string;
  lastIntent?: string;
  pendingTasks: string[];        // 未完成的任务 ID 列表
  upcomingEvents: string[];     // 即将到来的事件 ID 列表
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

interface UserPreferences {
  reminderEnabled: boolean;
  morningReminderTime?: string;
  eveningReminderTime?: string;
  defaultPriority: 'high' | 'medium' | 'low';
  smartExpansionEnabled: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  reminderEnabled: true,
  defaultPriority: 'medium',
  smartExpansionEnabled: true,
};

class MemoryStore {
  private contexts: Map<string, ConversationContext> = new Map();
  private taskCache: Map<string, TaskEntity> = new Map();

  /**
   * 获取或创建会话上下文
   */
  getOrCreateContext(userId: string, sessionId: string): ConversationContext {
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

    const context = this.contexts.get(key)!;
    context.updatedAt = new Date().toISOString();
    return context;
  }

  /**
   * 更新上下文
   */
  updateContext(userId: string, sessionId: string, updates: Partial<ConversationContext>): void {
    const context = this.getOrCreateContext(userId, sessionId);
    Object.assign(context, updates);
    context.updatedAt = new Date().toISOString();
  }

  /**
   * 添加待完成任务
   */
  addPendingTask(userId: string, sessionId: string, taskId: string): void {
    const context = this.getOrCreateContext(userId, sessionId);
    if (!context.pendingTasks.includes(taskId)) {
      context.pendingTasks.push(taskId);
    }
  }

  /**
   * 移除待完成任务
   */
  removePendingTask(userId: string, sessionId: string, taskId: string): void {
    const context = this.getOrCreateContext(userId, sessionId);
    context.pendingTasks = context.pendingTasks.filter(id => id !== taskId);
  }

  /**
   * 更新用户偏好
   */
  updatePreferences(userId: string, sessionId: string, preferences: Partial<UserPreferences>): void {
    const context = this.getOrCreateContext(userId, sessionId);
    context.preferences = { ...context.preferences, ...preferences };
  }

  /**
   * 缓存任务
   */
  cacheTask(task: TaskEntity): void {
    this.taskCache.set(task.id, task);
  }

  /**
   * 获取缓存任务
   */
  getCachedTask(taskId: string): TaskEntity | undefined {
    return this.taskCache.get(taskId);
  }

  /**
   * 清除过期缓存
   */
  clearExpiredCache(maxAgeMs: number = 3600000): void { // 1 hour default
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
  clearSession(userId: string, sessionId: string): void {
    const key = `${userId}:${sessionId}`;
    this.contexts.delete(key);
  }

  /**
   * 获取用户所有会话摘要
   */
  getUserSessionSummary(userId: string): {
    sessionCount: number;
    pendingTaskCount: number;
    preferences: UserPreferences;
  } {
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

export const memoryStore = new MemoryStore();
