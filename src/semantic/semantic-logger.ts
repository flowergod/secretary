// 语义日志 - 记录每次语义理解的完整输入输出
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../shared/logger';
import { ParsedIntent } from './types';

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
  options?: Array<{ id: string; label: string; type: string }>;
  openOption?: { id: string; label: string };
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

// 日志存储文件路径
function getLogFilePath(): string {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return path.join(logDir, 'semantic_logs.json');
}

// 读取所有日志
function readLogs(): SemanticLogEntry[] {
  const filePath = getLogFilePath();
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

// 写入日志
function writeLogs(logs: SemanticLogEntry[]): void {
  const filePath = getLogFilePath();
  fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf-8');
}

export class SemanticLogger {
  // 创建日志
  createLog(
    input: SemanticLogInput,
    intentRecognition: SemanticLogIntentRecognition,
    confirmation?: SemanticLogConfirmation | null,
    llmMetadata?: SemanticLogLLMMetadata | null
  ): SemanticLogEntry {
    const log: SemanticLogEntry = {
      id: `log_${uuidv4().replace(/-/g, '').substring(0, 12)}`,
      timestamp: new Date().toISOString(),
      input,
      intentRecognition,
      confirmation: confirmation || null,
      execution: null,
      iCloudSync: null,
      llmMetadata: llmMetadata || null,
    };

    const logs = readLogs();
    logs.push(log);
    writeLogs(logs);

    logger.debug(`[SemanticLogger] Created log: ${log.id}`);
    return log;
  }

  // 更新日志执行结果
  updateExecution(
    logId: string,
    execution: SemanticLogExecution,
    iCloudSync?: SemanticLogICloudSync | null
  ): void {
    const logs = readLogs();
    const log = logs.find(l => l.id === logId);
    if (log) {
      log.execution = execution;
      if (iCloudSync !== undefined) {
        log.iCloudSync = iCloudSync;
      }
      writeLogs(logs);
      logger.debug(`[SemanticLogger] Updated execution for log: ${logId}`);
    }
  }

  // 更新日志的 traceId
  updateTraceId(logId: string, traceId: string): void {
    const logs = readLogs();
    const log = logs.find(l => l.id === logId);
    if (log) {
      log.traceId = traceId;
      writeLogs(logs);
    }
  }

  // 更新确认结果
  updateConfirmationResponse(
    logId: string,
    userResponse: SemanticLogConfirmation['userResponse']
  ): void {
    const logs = readLogs();
    const log = logs.find(l => l.id === logId);
    if (log && log.confirmation) {
      log.confirmation.userResponse = userResponse;
      writeLogs(logs);
    }
  }

  // 查询日志
  queryLogs(query: LogQuery): PaginatedResult<SemanticLogEntry> {
    let logs = readLogs();

    // 过滤
    if (query.intentId) {
      logs = logs.filter(l => l.intentRecognition.intentId === query.intentId);
    }
    if (query.intent) {
      logs = logs.filter(l => l.intentRecognition.intent === query.intent);
    }
    if (query.text) {
      logs = logs.filter(l => l.input.text.includes(query.text!));
    }
    if (query.taskId) {
      logs = logs.filter(l => l.execution?.taskId === query.taskId);
    }
    if (query.userId) {
      logs = logs.filter(l => l.input.userId === query.userId);
    }
    if (query.from) {
      logs = logs.filter(l => l.timestamp >= query.from!);
    }
    if (query.to) {
      logs = logs.filter(l => l.timestamp <= query.to!);
    }
    if (query.success !== undefined) {
      logs = logs.filter(l => l.execution?.executed === query.success);
    }

    // 排序
    logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // 分页
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 20, 100);
    const total = logs.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const items = logs.slice(start, start + pageSize);

    return { items, total, page, pageSize, totalPages };
  }

  // 获取单个日志
  getLog(logId: string): SemanticLogEntry | null {
    const logs = readLogs();
    return logs.find(l => l.id === logId) || null;
  }

  // 获取统计
  getStats(from?: string, to?: string): LogStats {
    let logs = readLogs();

    if (from) {
      logs = logs.filter(l => l.timestamp >= from);
    }
    if (to) {
      logs = logs.filter(l => l.timestamp <= to);
    }

    const now = new Date();
    const stats: LogStats = {
      period: {
        from: from || logs.length > 0 ? logs[logs.length - 1].timestamp : now.toISOString(),
        to: to || now.toISOString(),
      },
      summary: {
        totalRequests: logs.length,
        successfulExecutions: logs.filter(l => l.execution?.executed === true).length,
        failedExecutions: logs.filter(l => l.execution?.executed === false).length,
        confirmationsRequired: logs.filter(l => l.confirmation?.needsConfirmation === true).length,
        avgLlmLatencyMs: 0,
        avgExecutionDurationMs: 0,
      },
      byIntent: {},
      byDay: [],
    };

    // 计算平均延迟
    const withLlmLatency = logs.filter(l => l.llmMetadata?.latencyMs);
    if (withLlmLatency.length > 0) {
      stats.summary.avgLlmLatencyMs = Math.round(
        withLlmLatency.reduce((sum, l) => sum + (l.llmMetadata?.latencyMs || 0), 0) / withLlmLatency.length
      );
    }

    const withExecutionDuration = logs.filter(l => l.execution?.durationMs);
    if (withExecutionDuration.length > 0) {
      stats.summary.avgExecutionDurationMs = Math.round(
        withExecutionDuration.reduce((sum, l) => sum + (l.execution?.durationMs || 0), 0) / withExecutionDuration.length
      );
    }

    // 按意图统计
    const intentGroups = new Map<string, { total: number; success: number }>();
    for (const log of logs) {
      const intent = log.intentRecognition.intent;
      const group = intentGroups.get(intent) || { total: 0, success: 0 };
      group.total++;
      if (log.execution?.executed === true) {
        group.success++;
      }
      intentGroups.set(intent, group);
    }

    for (const [intent, data] of intentGroups) {
      stats.byIntent[intent] = {
        count: data.total,
        successRate: data.total > 0 ? Math.round((data.success / data.total) * 100) / 100 : 0,
      };
    }

    // 按天统计
    const dayGroups = new Map<string, number>();
    for (const log of logs) {
      const day = log.timestamp.split('T')[0];
      dayGroups.set(day, (dayGroups.get(day) || 0) + 1);
    }

    stats.byDay = Array.from(dayGroups.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return stats;
  }

  // 清理过期日志
  cleanup(olderThanDays: number): number {
    const logs = readLogs();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const cutoffStr = cutoff.toISOString();

    const filtered = logs.filter(l => l.timestamp >= cutoffStr);
    const deleted = logs.length - filtered.length;

    if (deleted > 0) {
      writeLogs(filtered);
      logger.info(`[SemanticLogger] Cleaned up ${deleted} logs older than ${olderThanDays} days`);
    }

    return deleted;
  }

  // 获取最新的 N 条日志
  getRecentLogs(count: number = 10): SemanticLogEntry[] {
    const logs = readLogs();
    return logs
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, count);
  }
}

// 导出单例
let semanticLoggerInstance: SemanticLogger | null = null;

export function getSemanticLogger(): SemanticLogger {
  if (!semanticLoggerInstance) {
    semanticLoggerInstance = new SemanticLogger();
  }
  return semanticLoggerInstance;
}
