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
exports.SemanticLogger = void 0;
exports.getSemanticLogger = getSemanticLogger;
// 语义日志 - 记录每次语义理解的完整输入输出
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../shared/logger");
// 日志存储文件路径
function getLogFilePath() {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    return path.join(logDir, 'semantic_logs.json');
}
// 读取所有日志
function readLogs() {
    const filePath = getLogFilePath();
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
// 写入日志
function writeLogs(logs) {
    const filePath = getLogFilePath();
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), 'utf-8');
}
class SemanticLogger {
    // 创建日志
    createLog(input, intentRecognition, confirmation, llmMetadata) {
        const log = {
            id: `log_${(0, uuid_1.v4)().replace(/-/g, '').substring(0, 12)}`,
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
        logger_1.logger.debug(`[SemanticLogger] Created log: ${log.id}`);
        return log;
    }
    // 更新日志执行结果
    updateExecution(logId, execution, iCloudSync) {
        const logs = readLogs();
        const log = logs.find(l => l.id === logId);
        if (log) {
            log.execution = execution;
            if (iCloudSync !== undefined) {
                log.iCloudSync = iCloudSync;
            }
            writeLogs(logs);
            logger_1.logger.debug(`[SemanticLogger] Updated execution for log: ${logId}`);
        }
    }
    // 更新日志的 traceId
    updateTraceId(logId, traceId) {
        const logs = readLogs();
        const log = logs.find(l => l.id === logId);
        if (log) {
            log.traceId = traceId;
            writeLogs(logs);
        }
    }
    // 更新确认结果
    updateConfirmationResponse(logId, userResponse) {
        const logs = readLogs();
        const log = logs.find(l => l.id === logId);
        if (log && log.confirmation) {
            log.confirmation.userResponse = userResponse;
            writeLogs(logs);
        }
    }
    // 查询日志
    queryLogs(query) {
        let logs = readLogs();
        // 过滤
        if (query.intentId) {
            logs = logs.filter(l => l.intentRecognition.intentId === query.intentId);
        }
        if (query.intent) {
            logs = logs.filter(l => l.intentRecognition.intent === query.intent);
        }
        if (query.text) {
            logs = logs.filter(l => l.input.text.includes(query.text));
        }
        if (query.taskId) {
            logs = logs.filter(l => l.execution?.taskId === query.taskId);
        }
        if (query.userId) {
            logs = logs.filter(l => l.input.userId === query.userId);
        }
        if (query.from) {
            logs = logs.filter(l => l.timestamp >= query.from);
        }
        if (query.to) {
            logs = logs.filter(l => l.timestamp <= query.to);
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
    getLog(logId) {
        const logs = readLogs();
        return logs.find(l => l.id === logId) || null;
    }
    // 获取统计
    getStats(from, to) {
        let logs = readLogs();
        if (from) {
            logs = logs.filter(l => l.timestamp >= from);
        }
        if (to) {
            logs = logs.filter(l => l.timestamp <= to);
        }
        const now = new Date();
        const stats = {
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
            stats.summary.avgLlmLatencyMs = Math.round(withLlmLatency.reduce((sum, l) => sum + (l.llmMetadata?.latencyMs || 0), 0) / withLlmLatency.length);
        }
        const withExecutionDuration = logs.filter(l => l.execution?.durationMs);
        if (withExecutionDuration.length > 0) {
            stats.summary.avgExecutionDurationMs = Math.round(withExecutionDuration.reduce((sum, l) => sum + (l.execution?.durationMs || 0), 0) / withExecutionDuration.length);
        }
        // 按意图统计
        const intentGroups = new Map();
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
        const dayGroups = new Map();
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
    cleanup(olderThanDays) {
        const logs = readLogs();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - olderThanDays);
        const cutoffStr = cutoff.toISOString();
        const filtered = logs.filter(l => l.timestamp >= cutoffStr);
        const deleted = logs.length - filtered.length;
        if (deleted > 0) {
            writeLogs(filtered);
            logger_1.logger.info(`[SemanticLogger] Cleaned up ${deleted} logs older than ${olderThanDays} days`);
        }
        return deleted;
    }
    // 获取最新的 N 条日志
    getRecentLogs(count = 10) {
        const logs = readLogs();
        return logs
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .slice(0, count);
    }
}
exports.SemanticLogger = SemanticLogger;
// 导出单例
let semanticLoggerInstance = null;
function getSemanticLogger() {
    if (!semanticLoggerInstance) {
        semanticLoggerInstance = new SemanticLogger();
    }
    return semanticLoggerInstance;
}
//# sourceMappingURL=semantic-logger.js.map