// Add global handlers for Node.js 24 unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  if (reason instanceof Error && reason.message.includes('EADDRINUSE')) {
    console.error('[Server] Caught unhandled EADDRINUSE:', reason.message);
    // Don't exit
  }
});

process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('EADDRINUSE')) {
    console.error('[Server] Caught uncaught EADDRINUSE:', err.message);
    // Don't exit
    return;
  }
  console.error('[Server] Uncaught exception:', err);
  process.exit(1);
});

// HTTP Server
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { configManager, logger } from './shared';
import { createFeishuBotConnector, getFeishuBotConnector, FeishuBotConnector } from './connectors';
import { createFeishuBotService, FeishuBotService } from './services';
import {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  batchDeleteTasks,
  completeTask,
  transitionTask,
} from './routes';
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  syncFromICloud,
  syncToICloud,
} from './routes';
import {
  semanticUnderstand,
  semanticConfirm,
  semanticGetContext,
  getSemanticLogs,
  getSemanticLog,
  getSemanticStats,
  getTrace,
  queryTraces,
  getTraceStats,
} from './routes';
import { createWebSocketServer } from './websocket/semantic-ws';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0';

// 路由处理
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 健康检查
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } }));
    return;
  }

  // 任务路由
  try {
    // POST /api/tasks - 创建任务
    if (pathname === '/api/tasks' && req.method === 'POST') {
      return createTask(req, res);
    }

    // GET /api/tasks - 查询任务列表
    if (pathname === '/api/tasks' && req.method === 'GET') {
      return listTasks(req, res);
    }

    // POST /api/tasks/batch-delete - 批量删除
    if (pathname === '/api/tasks/batch-delete' && req.method === 'POST') {
      return batchDeleteTasks(req, res);
    }

    // GET /api/tasks/:id - 获取单个任务
    if (pathname.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'GET') {
      return getTask(req, res);
    }

    // PUT /api/tasks/:id - 更新任务
    if (pathname.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'PUT') {
      return updateTask(req, res);
    }

    // DELETE /api/tasks/:id - 删除任务
    if (pathname.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'DELETE') {
      return deleteTask(req, res);
    }

    // POST /api/tasks/:id/complete - 完成任务
    if (pathname.match(/^\/api\/tasks\/[^/]+\/complete$/) && req.method === 'POST') {
      return completeTask(req, res);
    }

    // POST /api/tasks/:id/transition - 状态变更
    if (pathname.match(/^\/api\/tasks\/[^/]+\/transition$/) && req.method === 'POST') {
      return transitionTask(req, res);
    }

    // ==================== 日程路由 ====================

    // GET /api/events - 查询日程列表
    if (pathname === '/api/events' && req.method === 'GET') {
      return listEvents(req, res);
    }

    // POST /api/events - 创建日程
    if (pathname === '/api/events' && req.method === 'POST') {
      return createEvent(req, res);
    }

    // POST /api/events/sync-from-icloud - 从 iCloud 同步
    if (pathname === '/api/events/sync-from-icloud' && req.method === 'POST') {
      return syncFromICloud(req, res);
    }

    // GET /api/events/:id - 获取单个日程
    if (pathname.match(/^\/api\/events\/[^/]+$/) && req.method === 'GET') {
      return getEvent(req, res);
    }

    // PUT /api/events/:id - 更新日程
    if (pathname.match(/^\/api\/events\/[^/]+$/) && req.method === 'PUT') {
      return updateEvent(req, res);
    }

    // DELETE /api/events/:id - 删除日程
    if (pathname.match(/^\/api\/events\/[^/]+$/) && req.method === 'DELETE') {
      return deleteEvent(req, res);
    }

    // POST /api/events/sync-to-icloud/:id - 手动同步到 iCloud
    if (pathname.match(/^\/api\/events\/sync-to-icloud\/[^/]+$/) && req.method === 'POST') {
      return syncToICloud(req, res);
    }

    // ==================== 语义理解 API ====================

    // POST /api/semantic/understand - 理解用户输入
    if (pathname === '/api/semantic/understand' && req.method === 'POST') {
      return semanticUnderstand(req, res);
    }

    // POST /api/semantic/confirm - 确认并执行
    if (pathname === '/api/semantic/confirm' && req.method === 'POST') {
      return semanticConfirm(req, res);
    }

    // GET /api/semantic/context/:contextId - 获取上下文状态
    if (pathname.match(/^\/api\/semantic\/context\/[^/]+$/) && req.method === 'GET') {
      return semanticGetContext(req, res);
    }

    // ==================== 日志 API ====================

    // GET /api/logs/semantic - 查询语义日志
    if (pathname === '/api/logs/semantic' && req.method === 'GET') {
      return getSemanticLogs(req, res);
    }

    // GET /api/logs/semantic/stats - 获取统计
    if (pathname === '/api/logs/semantic/stats' && req.method === 'GET') {
      return getSemanticStats(req, res);
    }

    // GET /api/logs/semantic/:logId - 获取单个语义日志
    if (pathname.match(/^\/api\/logs\/semantic\/[^/]+$/) && req.method === 'GET') {
      return getSemanticLog(req, res);
    }

    // GET /api/logs/trace/:traceId - 获取调用链路
    if (pathname.match(/^\/api\/logs\/trace\/[^/]+$/) && req.method === 'GET') {
      return getTrace(req, res);
    }

    // GET /api/logs/traces - 查询追踪列表
    if (pathname === '/api/logs/traces' && req.method === 'GET') {
      return queryTraces(req, res);
    }

    // GET /api/logs/traces/stats - 获取追踪统计
    if (pathname === '/api/logs/traces/stats' && req.method === 'GET') {
      return getTraceStats(req, res);
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 404, message: 'Not found' } }));
  } catch (e) {
    logger.error('[Server] Request error:', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 500, message: 'Internal error' } }));
  }
}

export function startServer(): void {
  // 加载配置
  try {
    configManager.load();
    logger.info('[Server] Config loaded');
  } catch (e) {
    console.error('[Server] Failed to load config:', e);
    process.exit(1);
  }

  // 创建服务器
  const server = createServer(handleRequest);

  // 启动飞书机器人服务（长连接模式）
  const feishuConfig = configManager.get().feishu;
  if (feishuConfig?.appId && feishuConfig?.appSecret) {
    try {
      const connector = createFeishuBotConnector({
        appId: feishuConfig.appId,
        appSecret: feishuConfig.appSecret,
        botName: '秘书',
      });

      const botService = createFeishuBotService(connector);

      // 异步启动，不阻塞服务器
      botService.start().catch((err) => {
        logger.error('[Server] Failed to start Feishu bot:', err);
      });

      logger.info('[Server] Feishu bot service initialized');
    } catch (err) {
      logger.error('[Server] Failed to initialize Feishu bot:', err);
    }
  } else {
    logger.warn('[Server] Feishu bot not configured (missing appId or appSecret)');
  }

  // 启动 WebSocket 服务器
  createWebSocketServer(server);

  // Wrap listen in a promise to properly handle errors
  new Promise<void>((resolve, reject) => {
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error('[Server] Port', PORT, 'is already in use');
        reject(err);
      } else {
        logger.error('[Server] Error:', err.message, 'Code:', err.code);
        console.error('[Server] Error:', err.message, 'Code:', err.code);
        reject(err);
      }
    });

    server.listen(PORT, HOST, () => {
      console.log(`========================================`);
      console.log(`Server running at http://${HOST}:${PORT}`);
      console.log(`WebSocket running at ws://${HOST}:${PORT}`);
      console.log(`========================================`);
      logger.info(`[Server] Started on ${HOST}:${PORT}`);
      resolve();
    });
  }).catch((err) => {
    console.error('[Server] Failed to start due to error:', err.message);
    // Don't exit, just log
  });
}

startServer();
