"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceLogger = void 0;
exports.getTraceLogger = getTraceLogger;
// 调用链路追踪器 - 记录原子服务调用的详细链路
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../shared/logger");
// 日志存储文件路径
function getTraceFilePath() {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    return path.join(logDir, 'traces.json');
}
function getSpanFilePath() {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    return path.join(logDir, 'spans.json');
}
// 读取追踪记录
function readTraces() {
    const filePath = getTraceFilePath();
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return [];
    }
}
// 写入追踪记录
function writeTraces(traces) {
    const filePath = getTraceFilePath();
    fs.writeFileSync(filePath, JSON.stringify(traces, null, 2), 'utf-8');
}
// 读取 Span 记录
function readSpans() {
    const filePath = getSpanFilePath();
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return [];
    }
}
// 写入 Span 记录
function writeSpans(spans) {
    const filePath = getSpanFilePath();
    fs.writeFileSync(filePath, JSON.stringify(spans, null, 2), 'utf-8');
}
class TraceLogger {
    constructor() {
        this.currentTraces = new Map();
    }
    // 开始追踪
    startTrace(operationName, inputs) {
        const traceId = `trace_${(0, uuid_1.v4)().replace(/-/g, '').substring(0, 12)}`;
        const spanId = `span_${(0, uuid_1.v4)().replace(/-/g, '').substring(0, 12)}`;
        const now = new Date().toISOString();
        const rootSpan = {
            spanId,
            traceId,
            parentSpanId: null,
            operationName,
            startTime: now,
            durationMs: null,
            inputs: inputs,
            outputs: null,
            metadata: null,
            error: null,
            links: {},
        };
        const context = {
            traceId,
            rootSpanId: spanId,
            spans: new Map([[spanId, rootSpan]]),
            operationName,
            inputs: inputs,
        };
        this.currentTraces.set(traceId, context);
        logger_1.logger.debug(`[TraceLogger] Started trace: ${traceId}, root span: ${spanId}`);
        return context;
    }
    // 开始 Span
    startSpan(traceId, operationName, parentSpanId, inputs) {
        const context = this.currentTraces.get(traceId);
        if (!context) {
            logger_1.logger.warn(`[TraceLogger] Trace not found: ${traceId}`);
            return null;
        }
        const spanId = `span_${(0, uuid_1.v4)().replace(/-/g, '').substring(0, 12)}`;
        const now = new Date().toISOString();
        const span = {
            spanId,
            traceId,
            parentSpanId: parentSpanId || context.rootSpanId,
            operationName,
            startTime: now,
            durationMs: null,
            inputs: inputs ? inputs : null,
            outputs: null,
            metadata: null,
            error: null,
            links: {},
        };
        context.spans.set(spanId, span);
        logger_1.logger.debug(`[TraceLogger] Started span: ${spanId} in trace: ${traceId}`);
        return spanId;
    }
    // 结束 Span
    endSpan(traceId, spanId, outputs, metadata, error) {
        const context = this.currentTraces.get(traceId);
        if (!context) {
            logger_1.logger.warn(`[TraceLogger] Trace not found: ${traceId}`);
            return;
        }
        const span = context.spans.get(spanId);
        if (!span) {
            logger_1.logger.warn(`[TraceLogger] Span not found: ${spanId}`);
            return;
        }
        const now = new Date();
        const startTime = new Date(span.startTime);
        span.durationMs = now.getTime() - startTime.getTime();
        span.outputs = outputs ? outputs : null;
        span.metadata = metadata ? metadata : null;
        span.error = error ? error.message : null;
        logger_1.logger.debug(`[TraceLogger] Ended span: ${spanId}, duration: ${span.durationMs}ms`);
        // 如果是根 span，结束追踪
        if (spanId === context.rootSpanId) {
            this.endTrace(traceId);
        }
    }
    // 结束追踪
    endTrace(traceId, outputs, error) {
        const context = this.currentTraces.get(traceId);
        if (!context) {
            logger_1.logger.warn(`[TraceLogger] Trace not found: ${traceId}`);
            return;
        }
        const now = new Date();
        const startTime = new Date(context.spans.get(context.rootSpanId).startTime);
        const durationMs = now.getTime() - startTime.getTime();
        // 创建 Trace 记录
        const trace = {
            traceId,
            parentTraceId: null,
            operationName: context.operationName,
            startTime: context.spans.get(context.rootSpanId).startTime,
            durationMs,
            inputs: context.inputs,
            outputs: outputs ? outputs : null,
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
        logger_1.logger.debug(`[TraceLogger] Ended trace: ${traceId}, duration: ${durationMs}ms`);
    }
    // 为 Span 添加链接
    addSpanLink(traceId, spanId, linkType, value) {
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
    getTraceContext(traceId) {
        return this.currentTraces.get(traceId) || null;
    }
    // 查询追踪
    getTrace(traceId) {
        const traces = readTraces();
        const spans = readSpans();
        const trace = traces.find(t => t.traceId === traceId) || null;
        const traceSpans = spans
            .filter(s => s.traceId === traceId)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
        return { trace, spans: traceSpans };
    }
    // 查询追踪列表
    queryTraces(operation, from, to, page = 1, pageSize = 20) {
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
    getOperationStats(operation) {
        const spans = readSpans();
        const traces = readTraces();
        // 找到该操作的所有 trace
        const operationTraces = traces.filter(t => t.operationName === operation);
        const durations = [];
        let successCount = 0;
        let failureCount = 0;
        const errorTypes = {};
        for (const trace of operationTraces) {
            if (trace.durationMs !== null) {
                durations.push(trace.durationMs);
            }
            if (trace.error) {
                failureCount++;
                errorTypes[trace.error] = (errorTypes[trace.error] || 0) + 1;
            }
            else {
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
    cleanup(olderThanDays) {
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
        logger_1.logger.info(`[TraceLogger] Cleaned up ${tracesDeleted} traces and ${spansDeleted} spans older than ${olderThanDays} days`);
        return { tracesDeleted, spansDeleted };
    }
}
exports.TraceLogger = TraceLogger;
// 导出单例
let traceLoggerInstance = null;
function getTraceLogger() {
    if (!traceLoggerInstance) {
        traceLoggerInstance = new TraceLogger();
    }
    return traceLoggerInstance;
}
//# sourceMappingURL=trace-logger.js.map