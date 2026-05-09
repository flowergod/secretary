// 语义理解 API 路由
import { IncomingMessage, ServerResponse } from 'http';
import { getSemanticService } from '../semantic';
import { getSemanticLogger, getTraceLogger } from '../semantic';
import { logger } from '../shared/logger';

// 解析请求体
async function parseBody<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      } else {
        chunks.push(Buffer.from(chunk));
      }
    });
    req.on('end', () => {
      try {
        if (chunks.length === 0) {
          resolve(null);
          return;
        }
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(body ? JSON.parse(body) : null);
      } catch {
        resolve(null);
      }
    });
  });
}

// 发送 JSON 响应
function sendJson(res: ServerResponse, statusCode: number, data: object): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ==================== 语义理解 API ====================

// POST /api/semantic/understand
export async function semanticUnderstand(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await parseBody<{ text: string; userId?: string }>(req);

    if (!body || !body.text) {
      sendJson(res, 400, { success: false, error: { code: 'INVALID_REQUEST', message: 'text is required' } });
      return;
    }

    const service = getSemanticService();
    const result = await service.understand(body.text, body.userId);

    sendJson(res, 200, result);
  } catch (error) {
    logger.error('[SemanticRoute] understand error:', error);
    sendJson(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
}

// POST /api/semantic/confirm
export async function semanticConfirm(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await parseBody<{
      contextId: string;
      selectedOption?: string;
      openText?: string;
      cancel?: boolean;
    }>(req);

    if (!body || !body.contextId) {
      sendJson(res, 400, { success: false, error: { code: 'INVALID_REQUEST', message: 'contextId is required' } });
      return;
    }

    const service = getSemanticService();
    const result = await service.confirm(
      body.contextId,
      body.selectedOption,
      body.openText,
      body.cancel
    );

    sendJson(res, 200, result);
  } catch (error) {
    logger.error('[SemanticRoute] confirm error:', error);
    sendJson(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
}

// GET /api/semantic/context/:contextId
export async function semanticGetContext(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const contextId = url.pathname.split('/').pop();

    if (!contextId) {
      sendJson(res, 400, { success: false, error: { code: 'INVALID_REQUEST', message: 'contextId is required' } });
      return;
    }

    const service = getSemanticService();
    const context = service.getContext(contextId);

    if (!context) {
      sendJson(res, 404, { success: false, error: { code: 'CONTEXT_NOT_FOUND', message: '上下文不存在或已过期' } });
      return;
    }

    sendJson(res, 200, { success: true, context });
  } catch (error) {
    logger.error('[SemanticRoute] getContext error:', error);
    sendJson(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
}

// ==================== 日志 API ====================

// GET /api/logs/semantic
export async function getSemanticLogs(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const query = {
      intentId: url.searchParams.get('intentId') || undefined,
      intent: url.searchParams.get('intent') || undefined,
      text: url.searchParams.get('text') || undefined,
      taskId: url.searchParams.get('taskId') || undefined,
      userId: url.searchParams.get('userId') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      success: url.searchParams.get('success') ? url.searchParams.get('success') === 'true' : undefined,
      page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : undefined,
      pageSize: url.searchParams.get('pageSize') ? parseInt(url.searchParams.get('pageSize')!) : undefined,
    };

    const semanticLogger = getSemanticLogger();
    const result = semanticLogger.queryLogs(query);

    sendJson(res, 200, { success: true, data: result });
  } catch (error) {
    logger.error('[LogRoute] getSemanticLogs error:', error);
    sendJson(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
}

// GET /api/logs/semantic/:logId
export async function getSemanticLog(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const logId = url.pathname.split('/').pop();

    if (!logId) {
      sendJson(res, 400, { success: false, error: { code: 'INVALID_REQUEST', message: 'logId is required' } });
      return;
    }

    const semanticLogger = getSemanticLogger();
    const log = semanticLogger.getLog(logId);

    if (!log) {
      sendJson(res, 404, { success: false, error: { code: 'LOG_NOT_FOUND', message: '日志不存在' } });
      return;
    }

    sendJson(res, 200, { success: true, data: log });
  } catch (error) {
    logger.error('[LogRoute] getSemanticLog error:', error);
    sendJson(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
}

// GET /api/logs/semantic/stats
export async function getSemanticStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const from = url.searchParams.get('from') || undefined;
    const to = url.searchParams.get('to') || undefined;

    const semanticLogger = getSemanticLogger();
    const stats = semanticLogger.getStats(from, to);

    sendJson(res, 200, { success: true, data: stats });
  } catch (error) {
    logger.error('[LogRoute] getSemanticStats error:', error);
    sendJson(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
}

// GET /api/logs/trace/:traceId
export async function getTrace(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const traceId = url.pathname.split('/').pop();

    if (!traceId) {
      sendJson(res, 400, { success: false, error: { code: 'INVALID_REQUEST', message: 'traceId is required' } });
      return;
    }

    const traceLogger = getTraceLogger();
    const result = traceLogger.getTrace(traceId);

    if (!result.trace) {
      sendJson(res, 404, { success: false, error: { code: 'TRACE_NOT_FOUND', message: '追踪不存在' } });
      return;
    }

    sendJson(res, 200, { success: true, data: result });
  } catch (error) {
    logger.error('[LogRoute] getTrace error:', error);
    sendJson(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
}

// GET /api/logs/traces
export async function queryTraces(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const query = {
      operation: url.searchParams.get('operation') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!) : 1,
      pageSize: url.searchParams.get('pageSize') ? parseInt(url.searchParams.get('pageSize')!) : 20,
    };

    const traceLogger = getTraceLogger();
    const result = traceLogger.queryTraces(query.operation, query.from, query.to, query.page, query.pageSize);

    sendJson(res, 200, { success: true, data: result });
  } catch (error) {
    logger.error('[LogRoute] queryTraces error:', error);
    sendJson(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
}

// GET /api/logs/traces/stats
export async function getTraceStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const operation = url.searchParams.get('operation');

    if (!operation) {
      sendJson(res, 400, { success: false, error: { code: 'INVALID_REQUEST', message: 'operation is required' } });
      return;
    }

    const traceLogger = getTraceLogger();
    const stats = traceLogger.getOperationStats(operation);

    sendJson(res, 200, { success: true, data: stats });
  } catch (error) {
    logger.error('[LogRoute] getTraceStats error:', error);
    sendJson(res, 500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' } });
  }
}
