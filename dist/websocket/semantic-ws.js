"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebSocketServer = createWebSocketServer;
// WebSocket Server - 语义理解长连接
const ws_1 = require("ws");
const semantic_1 = require("../semantic");
const logger_1 = require("../shared/logger");
// 客户端连接映射
const clients = new Map();
// 创建 WebSocket 服务器
function createWebSocketServer(server) {
    const wss = new ws_1.WebSocketServer({ server });
    wss.on('connection', (ws, req) => {
        const clientId = generateId('client');
        clients.set(ws, {});
        logger_1.logger.info(`[WebSocket] Client connected: ${clientId}`);
        // 发送连接成功消息
        send(ws, {
            type: 'intentRecognized',
            message: 'Connected to semantic understanding service',
        });
        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());
                await handleMessage(ws, message);
            }
            catch (error) {
                logger_1.logger.error('[WebSocket] Failed to parse message:', error);
                send(ws, { type: 'error', error: 'Invalid message format' });
            }
        });
        ws.on('close', () => {
            clients.delete(ws);
            logger_1.logger.info(`[WebSocket] Client disconnected: ${clientId}`);
        });
        ws.on('error', (error) => {
            logger_1.logger.error(`[WebSocket] Client error: ${clientId}`, error);
        });
    });
    logger_1.logger.info('[WebSocket] Server started');
    return wss;
}
// 处理客户端消息
async function handleMessage(ws, message) {
    const client = clients.get(ws);
    if (!client)
        return;
    const semanticService = (0, semantic_1.getSemanticService)();
    switch (message.type) {
        case 'userInput':
            if (!message.text) {
                send(ws, { type: 'error', error: 'text is required' });
                return;
            }
            try {
                const result = await semanticService.understand(message.text);
                handleSemanticResult(ws, result);
            }
            catch (error) {
                logger_1.logger.error('[WebSocket] understand error:', error);
                send(ws, { type: 'error', error: '理解失败' });
            }
            break;
        case 'confirm':
            if (!message.contextId) {
                send(ws, { type: 'error', error: 'contextId is required' });
                return;
            }
            try {
                const result = await semanticService.confirm(message.contextId, message.selectedOption, message.openText, message.cancel);
                handleSemanticResult(ws, result);
            }
            catch (error) {
                logger_1.logger.error('[WebSocket] confirm error:', error);
                send(ws, { type: 'error', error: '确认失败' });
            }
            break;
        case 'cancel':
            if (message.contextId) {
                const semanticService = (0, semantic_1.getSemanticService)();
                const context = semanticService.getContext(message.contextId);
                if (context) {
                    semanticService.confirm(message.contextId, undefined, undefined, true);
                    send(ws, { type: 'cancelled', contextId: message.contextId, message: '已取消' });
                }
            }
            break;
        case 'ping':
            send(ws, { type: 'pong' });
            break;
        default:
            send(ws, { type: 'error', error: 'Unknown message type' });
    }
}
// 处理语义理解结果
function handleSemanticResult(ws, result) {
    const client = clients.get(ws);
    if (!client)
        return;
    if (!result.success && result.error) {
        send(ws, {
            type: 'error',
            error: result.error,
            traceId: result.traceId,
        });
        return;
    }
    // 需要确认
    if (result.intent?.needsConfirmation && result.confirmationOptions) {
        // 更新客户端的 contextId
        client.contextId = result.intent?.id;
        send(ws, {
            type: 'confirmationRequired',
            intent: result.intent,
            contextId: result.intent?.id,
            confirmationQuestion: result.confirmationQuestion,
            confirmationOptions: result.confirmationOptions,
            openOption: result.openOption,
            lowConfidence: result.lowConfidence,
            logId: result.logId,
            traceId: result.traceId,
        });
        return;
    }
    // 执行成功
    if (result.requiresExecution && result.result) {
        send(ws, {
            type: 'executionResult',
            intent: result.intent,
            requiresExecution: true,
            result: result.result,
            contextId: result.intent?.id,
            logId: result.logId,
            traceId: result.traceId,
        });
        // 清除 context
        client.contextId = undefined;
        return;
    }
    // 意图识别（无需确认）
    send(ws, {
        type: 'intentRecognized',
        intent: result.intent,
        contextId: result.intent?.id,
        logId: result.logId,
        traceId: result.traceId,
    });
}
// 发送消息到客户端
function send(ws, message) {
    if (ws.readyState === ws_1.WebSocket.OPEN) {
        // 确保所有字符串字段都不包含控制字符
        const safeMessage = sanitizeForJson(message);
        ws.send(JSON.stringify(safeMessage));
    }
}
// 清理消息中的控制字符
function sanitizeForJson(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'string') {
        // 移除控制字符（换行、制表、回车等），但保留普通空格和中文
        return obj.replace(/[\x00-\x1F\x7F]/g, '');
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeForJson);
    }
    if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = sanitizeForJson(value);
        }
        return result;
    }
    return obj;
}
// 生成唯一 ID
function generateId(prefix = 'id') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}${random}`;
}
//# sourceMappingURL=semantic-ws.js.map