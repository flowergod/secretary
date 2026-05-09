"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
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
const http_1 = require("http");
const shared_1 = require("./shared");
const connectors_1 = require("./connectors");
const services_1 = require("./services");
const routes_1 = require("./routes");
const routes_2 = require("./routes");
const routes_3 = require("./routes");
const semantic_ws_1 = require("./websocket/semantic-ws");
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0';
// 路由处理
async function handleRequest(req, res) {
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
            return (0, routes_1.createTask)(req, res);
        }
        // GET /api/tasks - 查询任务列表
        if (pathname === '/api/tasks' && req.method === 'GET') {
            return (0, routes_1.listTasks)(req, res);
        }
        // POST /api/tasks/batch-delete - 批量删除
        if (pathname === '/api/tasks/batch-delete' && req.method === 'POST') {
            return (0, routes_1.batchDeleteTasks)(req, res);
        }
        // GET /api/tasks/:id - 获取单个任务
        if (pathname.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'GET') {
            return (0, routes_1.getTask)(req, res);
        }
        // PUT /api/tasks/:id - 更新任务
        if (pathname.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'PUT') {
            return (0, routes_1.updateTask)(req, res);
        }
        // DELETE /api/tasks/:id - 删除任务
        if (pathname.match(/^\/api\/tasks\/[^/]+$/) && req.method === 'DELETE') {
            return (0, routes_1.deleteTask)(req, res);
        }
        // POST /api/tasks/:id/complete - 完成任务
        if (pathname.match(/^\/api\/tasks\/[^/]+\/complete$/) && req.method === 'POST') {
            return (0, routes_1.completeTask)(req, res);
        }
        // POST /api/tasks/:id/transition - 状态变更
        if (pathname.match(/^\/api\/tasks\/[^/]+\/transition$/) && req.method === 'POST') {
            return (0, routes_1.transitionTask)(req, res);
        }
        // ==================== 日程路由 ====================
        // GET /api/events - 查询日程列表
        if (pathname === '/api/events' && req.method === 'GET') {
            return (0, routes_2.listEvents)(req, res);
        }
        // POST /api/events - 创建日程
        if (pathname === '/api/events' && req.method === 'POST') {
            return (0, routes_2.createEvent)(req, res);
        }
        // POST /api/events/sync-from-icloud - 从 iCloud 同步
        if (pathname === '/api/events/sync-from-icloud' && req.method === 'POST') {
            return (0, routes_2.syncFromICloud)(req, res);
        }
        // GET /api/events/:id - 获取单个日程
        if (pathname.match(/^\/api\/events\/[^/]+$/) && req.method === 'GET') {
            return (0, routes_2.getEvent)(req, res);
        }
        // PUT /api/events/:id - 更新日程
        if (pathname.match(/^\/api\/events\/[^/]+$/) && req.method === 'PUT') {
            return (0, routes_2.updateEvent)(req, res);
        }
        // DELETE /api/events/:id - 删除日程
        if (pathname.match(/^\/api\/events\/[^/]+$/) && req.method === 'DELETE') {
            return (0, routes_2.deleteEvent)(req, res);
        }
        // POST /api/events/sync-to-icloud/:id - 手动同步到 iCloud
        if (pathname.match(/^\/api\/events\/sync-to-icloud\/[^/]+$/) && req.method === 'POST') {
            return (0, routes_2.syncToICloud)(req, res);
        }
        // ==================== 语义理解 API ====================
        // POST /api/semantic/understand - 理解用户输入
        if (pathname === '/api/semantic/understand' && req.method === 'POST') {
            return (0, routes_3.semanticUnderstand)(req, res);
        }
        // POST /api/semantic/confirm - 确认并执行
        if (pathname === '/api/semantic/confirm' && req.method === 'POST') {
            return (0, routes_3.semanticConfirm)(req, res);
        }
        // GET /api/semantic/context/:contextId - 获取上下文状态
        if (pathname.match(/^\/api\/semantic\/context\/[^/]+$/) && req.method === 'GET') {
            return (0, routes_3.semanticGetContext)(req, res);
        }
        // ==================== 日志 API ====================
        // GET /api/logs/semantic - 查询语义日志
        if (pathname === '/api/logs/semantic' && req.method === 'GET') {
            return (0, routes_3.getSemanticLogs)(req, res);
        }
        // GET /api/logs/semantic/stats - 获取统计
        if (pathname === '/api/logs/semantic/stats' && req.method === 'GET') {
            return (0, routes_3.getSemanticStats)(req, res);
        }
        // GET /api/logs/semantic/:logId - 获取单个语义日志
        if (pathname.match(/^\/api\/logs\/semantic\/[^/]+$/) && req.method === 'GET') {
            return (0, routes_3.getSemanticLog)(req, res);
        }
        // GET /api/logs/trace/:traceId - 获取调用链路
        if (pathname.match(/^\/api\/logs\/trace\/[^/]+$/) && req.method === 'GET') {
            return (0, routes_3.getTrace)(req, res);
        }
        // GET /api/logs/traces - 查询追踪列表
        if (pathname === '/api/logs/traces' && req.method === 'GET') {
            return (0, routes_3.queryTraces)(req, res);
        }
        // GET /api/logs/traces/stats - 获取追踪统计
        if (pathname === '/api/logs/traces/stats' && req.method === 'GET') {
            return (0, routes_3.getTraceStats)(req, res);
        }
        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { code: 404, message: 'Not found' } }));
    }
    catch (e) {
        shared_1.logger.error('[Server] Request error:', e);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: { code: 500, message: 'Internal error' } }));
    }
}
function startServer() {
    // 加载配置
    try {
        shared_1.configManager.load();
        shared_1.logger.info('[Server] Config loaded');
    }
    catch (e) {
        console.error('[Server] Failed to load config:', e);
        process.exit(1);
    }
    // 创建服务器
    const server = (0, http_1.createServer)(handleRequest);
    // 启动飞书机器人服务（长连接模式）
    const feishuConfig = shared_1.configManager.get().feishu;
    if (feishuConfig?.appId && feishuConfig?.appSecret) {
        try {
            const connector = (0, connectors_1.createFeishuBotConnector)({
                appId: feishuConfig.appId,
                appSecret: feishuConfig.appSecret,
                botName: '秘书',
            });
            const botService = (0, services_1.createFeishuBotService)(connector);
            // 异步启动，不阻塞服务器
            botService.start().catch((err) => {
                shared_1.logger.error('[Server] Failed to start Feishu bot:', err);
            });
            shared_1.logger.info('[Server] Feishu bot service initialized');
        }
        catch (err) {
            shared_1.logger.error('[Server] Failed to initialize Feishu bot:', err);
        }
    }
    else {
        shared_1.logger.warn('[Server] Feishu bot not configured (missing appId or appSecret)');
    }
    // 启动 WebSocket 服务器
    (0, semantic_ws_1.createWebSocketServer)(server);
    // Wrap listen in a promise to properly handle errors
    new Promise((resolve, reject) => {
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error('[Server] Port', PORT, 'is already in use');
                reject(err);
            }
            else {
                shared_1.logger.error('[Server] Error:', err.message, 'Code:', err.code);
                console.error('[Server] Error:', err.message, 'Code:', err.code);
                reject(err);
            }
        });
        server.listen(PORT, HOST, () => {
            console.log(`========================================`);
            console.log(`Server running at http://${HOST}:${PORT}`);
            console.log(`WebSocket running at ws://${HOST}:${PORT}`);
            console.log(`========================================`);
            shared_1.logger.info(`[Server] Started on ${HOST}:${PORT}`);
            resolve();
        });
    }).catch((err) => {
        console.error('[Server] Failed to start due to error:', err.message);
        // Don't exit, just log
    });
}
startServer();
//# sourceMappingURL=server.js.map