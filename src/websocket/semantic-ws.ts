// WebSocket Server - 语义理解长连接
import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { getSemanticService } from '../semantic';
import { logger } from '../shared/logger';
import { SemanticResult, ParsedIntent, ConfirmationOption } from '../semantic/types';

// 客户端消息类型
interface ClientMessage {
  type: 'userInput' | 'confirm' | 'cancel' | 'ping';
  text?: string;
  selectedOption?: string;
  openText?: string;
  contextId?: string;
  cancel?: boolean;
}

// 服务端消息类型
interface ServerMessage {
  type: 'intentRecognized' | 'confirmationRequired' | 'executionResult' | 'error' | 'pong' | 'cancelled';
  intent?: ParsedIntent;
  confirmationQuestion?: string;
  confirmationOptions?: ConfirmationOption[];
  openOption?: { id: string; label: string };
  lowConfidence?: boolean;
  requiresExecution?: boolean;
  result?: {
    taskId: string;
    action: string;
    icloudEventId?: string;
  };
  message?: string;
  error?: string;
  contextId?: string;
  logId?: string;
  traceId?: string;
}

// 客户端连接映射
const clients = new Map<WebSocket, { contextId?: string; userId?: string }>();

// 创建 WebSocket 服务器
export function createWebSocketServer(server: any): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const clientId = generateId('client');
    clients.set(ws, {});

    logger.info(`[WebSocket] Client connected: ${clientId}`);

    // 发送连接成功消息
    send(ws, {
      type: 'intentRecognized',
      message: 'Connected to semantic understanding service',
    });

    ws.on('message', async (data: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        await handleMessage(ws, message);
      } catch (error) {
        logger.error('[WebSocket] Failed to parse message:', error);
        send(ws, { type: 'error', error: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info(`[WebSocket] Client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
      logger.error(`[WebSocket] Client error: ${clientId}`, error);
    });
  });

  logger.info('[WebSocket] Server started');
  return wss;
}

// 处理客户端消息
async function handleMessage(ws: WebSocket, message: ClientMessage): Promise<void> {
  const client = clients.get(ws);
  if (!client) return;

  const semanticService = getSemanticService();

  switch (message.type) {
    case 'userInput':
      if (!message.text) {
        send(ws, { type: 'error', error: 'text is required' });
        return;
      }

      try {
        const result = await semanticService.understand(message.text);
        handleSemanticResult(ws, result);
      } catch (error) {
        logger.error('[WebSocket] understand error:', error);
        send(ws, { type: 'error', error: '理解失败' });
      }
      break;

    case 'confirm':
      if (!message.contextId) {
        send(ws, { type: 'error', error: 'contextId is required' });
        return;
      }

      try {
        const result = await semanticService.confirm(
          message.contextId,
          message.selectedOption,
          message.openText,
          message.cancel
        );
        handleSemanticResult(ws, result);
      } catch (error) {
        logger.error('[WebSocket] confirm error:', error);
        send(ws, { type: 'error', error: '确认失败' });
      }
      break;

    case 'cancel':
      if (message.contextId) {
        const semanticService = getSemanticService();
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
function handleSemanticResult(ws: WebSocket, result: SemanticResult): void {
  const client = clients.get(ws);
  if (!client) return;

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
function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    // 确保所有字符串字段都不包含控制字符
    const safeMessage = sanitizeForJson(message);
    ws.send(JSON.stringify(safeMessage));
  }
}

// 清理消息中的控制字符
function sanitizeForJson(obj: unknown): unknown {
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
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = sanitizeForJson(value);
    }
    return result;
  }

  return obj;
}

// 生成唯一 ID
function generateId(prefix: string = 'id'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`;
}
