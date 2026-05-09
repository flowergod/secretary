// 调用链路追踪器 - 记录原子服务调用的详细链路
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../shared/logger';

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

// 日志存储文件路径
function getTraceFilePath(): string {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return path.join(logDir, 'traces.json');
}

function getSpanFilePath(): string {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return path.join(logDir, 'spans.json');
}

// 读取追踪记录
function readTraces(): Trace[] {
  const filePath = getTraceFilePath();
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

// 写入追踪记录
function writeTraces(traces: Trace[]): void {
  const filePath = getTraceFilePath();
  fs.writeFileSync(filePath, JSON.stringify(traces, null, 2), 'utf-8');
}

// 读取 Span 记录
function readSpans(): Span[] {
  const filePath = getSpanFilePath();
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

// 写入 Span 记录
function writeSpans(spans: Span[]): void {
  const filePath = getSpanFilePath();
  fs.writeFileSync(filePath, JSON.stringify(spans, null, 2), 'utf-8');
}

export class TraceLogger {
  private currentTraces = new Map<string, TraceContext>();

  // 开始追踪
  startTrace(operationName: string, inputs: object): TraceContext {
    const traceId = `trace_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    const spanId = `span_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    const now = new Date().toISOString();

    const rootSpan: Span = {
      spanId,
      traceId,
      parentSpanId: null,
      operationName,
      startTime: now,
      durationMs: null,
      inputs: inputs as Record<string, unknown>,
      outputs: null,
      metadata: null,
      error: null,
      links: {},
    };

    const context: TraceContext = {
      traceId,
      rootSpanId: spanId,
      spans: new Map([[spanId, rootSpan]]),
      operationName,
      inputs: inputs as Record<string, unknown>,
    };

    this.currentTraces.set(traceId, context);
    logger.debug(`[TraceLogger] Started trace: ${traceId}, root span: ${spanId}`);

    return context;
  }

  // 开始 Span
  startSpan(traceId: string, operationName: string, parentSpanId?: string, inputs?: object): string | null {
    const context = this.currentTraces.get(traceId);
    if (!context) {
      logger.warn(`[TraceLogger] Trace not found: ${traceId}`);
      return null;
    }

    const spanId = `span_${uuidv4().replace(/-/g, '').substring(0, 12)}`;
    const now = new Date().toISOString();

    const span: Span = {
      spanId,
      traceId,
      parentSpanId: parentSpanId || context.rootSpanId,
      operationName,
      startTime: now,
      durationMs: null,
      inputs: inputs ? inputs as Record<string, unknown> : null,
      outputs: null,
      metadata: null,
      error: null,
      links: {},
    };

    context.spans.set(spanId, span);
    logger.debug(`[TraceLogger] Started span: ${spanId} in trace: ${traceId}`);

    return spanId;
  }

  // 结束 Span
  endSpan(
    traceId: string,
    spanId: string,
    outputs?: object,
    metadata?: object,
    error?: Error
  ): void {
    const context = this.currentTraces.get(traceId);
    if (!context) {
      logger.warn(`[TraceLogger] Trace not found: ${traceId}`);
      return;
    }

    const span = context.spans.get(spanId);
    if (!span) {
      logger.warn(`[TraceLogger] Span not found: ${spanId}`);
      return;
    }

    const now = new Date();
    const startTime = new Date(span.startTime);
    span.durationMs = now.getTime() - startTime.getTime();
    span.outputs = outputs ? outputs as Record<string, unknown> : null;
    span.metadata = metadata ? metadata as Record<string, unknown> : null;
    span.error = error ? error.message : null;

    logger.debug(`[TraceLogger] Ended span: ${spanId}, duration: ${span.durationMs}ms`);

    // 如果是根 span，结束追踪
    if (spanId === context.rootSpanId) {
      this.endTrace(traceId);
    }
  }

  // 结束追踪
  endTrace(traceId: string, outputs?: object, error?: Error): void {
    const context = this.currentTraces.get(traceId);
    if (!context) {
      logger.warn(`[TraceLogger] Trace not found: ${traceId}`);
      return;
    }

    const now = new Date();
    const startTime = new Date(context.spans.get(context.rootSpanId)!.startTime);
    const durationMs = now.getTime() - startTime.getTime();

    // 创建 Trace 记录
    const trace: Trace = {
      traceId,
      parentTraceId: null,
      operationName: context.operationName,
      startTime: context.spans.get(context.rootSpanId)!.startTime,
      durationMs,
      inputs: context.inputs,
      outputs: outputs ? outputs as Record<string, unknown> : null,
      error: error ? error.message : null,
    };

    // 持久化
    const traces = readTraces();
    traces.push(trace);
    writeTraces(traces);

    const spans = readSpans();
    for (const span of context.spans.values()) {
      spans.push(span);
    }
    writeSpans(spans);

    // 清理内存中的追踪
    this.currentTraces.delete(traceId);
    logger.debug(`[TraceLogger] Ended trace: ${traceId}, duration: ${durationMs}ms`);
  }

  // 为 Span 添加链接
  addSpanLink(traceId: string, spanId: string, linkType: 'taskId' | 'icloudEventId' | 'semanticLogId', value: string): void {
    const context = this.currentTraces.get(traceId);
    if (!context) {
      return;
    }

    const span = context.spans.get(spanId);
    if (!span) {
      return;
    }

    span.links[linkType] = value;
  }

  // 获取追踪上下文（用于在追踪中添加 link）
  getTraceContext(traceId: string): TraceContext | null {
    return this.currentTraces.get(traceId) || null;
  }

  // 查询追踪
  getTrace(traceId: string): { trace: Trace | null; spans: Span[] } {
    const traces = readTraces();
    const spans = readSpans();

    const trace = traces.find(t => t.traceId === traceId) || null;
    const traceSpans = spans
      .filter(s => s.traceId === traceId)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return { trace, spans: traceSpans };
  }

  // 查询追踪列表
  queryTraces(
    operation?: string,
    from?: string,
    to?: string,
    page: number = 1,
    pageSize: number = 20
  ): { traces: Trace[]; total: number } {
    let traces = readTraces();

    if (operation) {
      traces = traces.filter(t => t.operationName.includes(operation));
    }
    if (from) {
      traces = traces.filter(t => t.startTime >= from);
    }
    if (to) {
      traces = traces.filter(t => t.startTime <= to);
    }

    traces.sort((a, b) => b.startTime.localeCompare(a.startTime));

    const total = traces.length;
    const start = (page - 1) * pageSize;
    const items = traces.slice(start, start + pageSize);

    return { traces: items, total };
  }

  // 获取操作统计
  getOperationStats(operation: string): {
    operation: string;
    totalCalls: number;
    successCount: number;
    failureCount: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    errorTypes: Record<string, number>;
  } {
    const spans = readSpans();
    const traces = readTraces();

    // 找到该操作的所有 trace
    const operationTraces = traces.filter(t => t.operationName === operation);

    const durations: number[] = [];
    let successCount = 0;
    let failureCount = 0;
    const errorTypes: Record<string, number> = {};

    for (const trace of operationTraces) {
      if (trace.durationMs !== null) {
        durations.push(trace.durationMs);
      }
      if (trace.error) {
        failureCount++;
        errorTypes[trace.error] = (errorTypes[trace.error] || 0) + 1;
      } else {
        successCount++;
      }
    }

    return {
      operation,
      totalCalls: operationTraces.length,
      successCount,
      failureCount,
      avgDuration: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      errorTypes,
    };
  }

  // 清理过期追踪
  cleanup(olderThanDays: number): { tracesDeleted: number; spansDeleted: number } {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const cutoffStr = cutoff.toISOString();

    let traces = readTraces();
    const tracesBefore = traces.length;
    traces = traces.filter(t => t.startTime >= cutoffStr);
    writeTraces(traces);
    const tracesDeleted = tracesBefore - traces.length;

    let spans = readSpans();
    const spansBefore = spans.length;
    spans = spans.filter(s => s.startTime >= cutoffStr);
    writeSpans(spans);
    const spansDeleted = spansBefore - spans.length;

    logger.info(`[TraceLogger] Cleaned up ${tracesDeleted} traces and ${spansDeleted} spans older than ${olderThanDays} days`);

    return { tracesDeleted, spansDeleted };
  }
}

// 导出单例
let traceLoggerInstance: TraceLogger | null = null;

export function getTraceLogger(): TraceLogger {
  if (!traceLoggerInstance) {
    traceLoggerInstance = new TraceLogger();
  }
  return traceLoggerInstance;
}
