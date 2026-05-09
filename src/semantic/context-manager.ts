// 上下文管理器 - 管理语义理解的上下文状态
import { ParsedIntent, ConfirmationOption } from './types';
import { logger } from '../shared/logger';

export type ConfirmationStatus =
  | 'pending_confirmation'
  | 'executing'
  | 'completed'
  | 'cancelled'
  | 'expired';

export interface Context {
  id: string;
  intent: ParsedIntent;
  rawInput: string;
  createdAt: Date;
  expiresAt: Date;
  status: ConfirmationStatus;
  confirmationQuestion?: string;
  confirmationOptions?: ConfirmationOption[];
  openOption?: { id: string; label: string };
}

// 近期操作类型
export type MentionOperation = 'create' | 'modify' | 'delete' | 'complete' | 'query';

// 近期操作记录
export interface MentionRecord {
  taskId: string;
  recordId: string;
  title: string;
  operation: MentionOperation;
  time: Date;
}

// 生成唯一 ID
function generateId(prefix: string = 'ctx'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`;
}

export class ContextManager {
  private contexts = new Map<string, Context>();
  private readonly TIMEOUT_MS = 5 * 60 * 1000; // 5分钟
  private cleanupTimer: NodeJS.Timeout | null = null;

  // 近期操作记录（最多20条）
  private recentMentions: MentionRecord[] = [];
  private readonly MAX_MENTIONS = 20;

  constructor(timeoutMs?: number) {
    if (timeoutMs) {
      this.TIMEOUT_MS = timeoutMs;
    }
    this.startCleanupTimer();
  }

  // 添加近期操作记录
  addMention(taskId: string, recordId: string, title: string, operation: MentionOperation): void {
    // 检查是否已存在该任务记录，存在则更新，不存在则添加
    const existingIndex = this.recentMentions.findIndex(m => m.taskId === taskId);
    const record: MentionRecord = {
      taskId,
      recordId,
      title,
      operation,
      time: new Date(),
    };

    if (existingIndex >= 0) {
      // 更新现有记录（移到最前面）
      this.recentMentions.splice(existingIndex, 1);
    }
    this.recentMentions.unshift(record);

    // 保持容量
    if (this.recentMentions.length > this.MAX_MENTIONS) {
      this.recentMentions.pop();
    }

    logger.debug(`[ContextManager] Added mention: ${title} (${operation}), total: ${this.recentMentions.length}`);
  }

  // 获取近期操作记录
  getRecentMentions(filter?: {
    operation?: MentionOperation;
    withinHours?: number;
  }): MentionRecord[] {
    let result = [...this.recentMentions];

    if (filter?.operation) {
      result = result.filter(m => m.operation === filter.operation);
    }

    if (filter?.withinHours) {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - filter.withinHours);
      result = result.filter(m => m.time >= cutoff);
    }

    return result;
  }

  // 根据操作类型获取最新记录
  getLatestByOperation(operation: MentionOperation): MentionRecord | null {
    return this.recentMentions.find(m => m.operation === operation) || null;
  }

  // 获取最近的记录
  getLatest(count: number = 1): MentionRecord[] {
    return this.recentMentions.slice(0, count);
  }

  // 创建上下文
  createContext(
    intent: ParsedIntent,
    rawInput: string,
    confirmationQuestion?: string,
    confirmationOptions?: Array<{ id: string; label: string; type: string }>,
    openOption?: { id: string; label: string }
  ): Context {
    const id = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.TIMEOUT_MS);

    const context: Context = {
      id,
      intent,
      rawInput,
      createdAt: now,
      expiresAt,
      status: confirmationQuestion ? 'pending_confirmation' : 'executing',
      confirmationQuestion,
      confirmationOptions,
      openOption,
    };

    this.contexts.set(id, context);
    logger.debug(`[ContextManager] Created context: ${id}, expires at ${expiresAt.toISOString()}`);

    return context;
  }

  // 获取上下文
  getContext(id: string): Context | null {
    const context = this.contexts.get(id);

    if (!context) {
      return null;
    }

    // 检查是否过期
    if (new Date() > context.expiresAt) {
      this.contexts.delete(id);
      logger.debug(`[ContextManager] Context expired: ${id}`);
      return null;
    }

    return context;
  }

  // 更新上下文状态
  updateStatus(id: string, status: ConfirmationStatus): boolean {
    const context = this.contexts.get(id);
    if (!context) {
      return false;
    }

    context.status = status;
    logger.debug(`[ContextManager] Updated context ${id} status to ${status}`);
    return true;
  }

  // 删除上下文
  deleteContext(id: string): boolean {
    const deleted = this.contexts.delete(id);
    if (deleted) {
      logger.debug(`[ContextManager] Deleted context: ${id}`);
    }
    return deleted;
  }

  // 取消上下文
  cancelContext(id: string): boolean {
    const context = this.contexts.get(id);
    if (!context) {
      return false;
    }

    context.status = 'cancelled';
    // 延迟删除，让用户能看到取消结果
    setTimeout(() => {
      this.contexts.delete(id);
    }, 1000);

    return true;
  }

  // 获取所有待确认的上下文
  getPendingContexts(): Context[] {
    const now = new Date();
    const pending: Context[] = [];

    for (const context of this.contexts.values()) {
      const isPending = context.status === 'pending_confirmation';
      const notExpired = context.expiresAt > now;
      logger.debug(`[ContextManager] Context ${context.id}: status=${context.status}, expired=${!notExpired}`);
      if (isPending && notExpired) {
        pending.push(context);
      }
    }

    return pending;
  }

  // 清理过期上下文
  private cleanup(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [id, context] of this.contexts.entries()) {
      if (context.expiresAt <= now) {
        this.contexts.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`[ContextManager] Cleaned up ${cleaned} expired contexts`);
    }
  }

  // 启动定期清理
  private startCleanupTimer(intervalMs: number = 60000): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, intervalMs);
  }

  // 停止清理定时器
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // 获取超时配置
  getTimeoutMs(): number {
    return this.TIMEOUT_MS;
  }

  // 获取近期操作记录数量（用于调试）
  getMentionCount(): number {
    return this.recentMentions.length;
  }
}

// 导出单例
let contextManagerInstance: ContextManager | null = null;

export function getContextManager(): ContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new ContextManager();
  }
  return contextManagerInstance;
}
